import type { StoreAdapter } from '@agentic-shop/adapters';
import {
  createShoppingAgent,
  STEP_LIMIT_MESSAGE,
  type AgentConfig,
} from '@agentic-shop/agent-core';
import { getConnInfo } from '@hono/node-server/conninfo';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type LanguageModel,
  type ModelMessage,
} from 'ai';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { createSlidingWindowLimiter } from './rate-limit';
import {
  createMemorySessionStore,
  DEFAULT_SESSION_TTL_MS,
  trimHistory,
  type SessionStore,
} from './sessions';

export const SESSION_HEADER = 'x-session-id';
export const MAX_BODY_BYTES = 16 * 1024;
export const DEFAULT_MAX_MESSAGE_CHARS = 2000;
export const DEFAULT_MAX_HISTORY_TURNS = 12;

/** The only text a client ever sees when a turn fails. Details go to the server log. */
export const GENERIC_STREAM_ERROR =
  'Sorry, something went wrong on our side. Please try again in a moment.';

export type ServerErrorCode =
  | 'validation_error'
  | 'session_required'
  | 'session_not_found'
  | 'origin_not_allowed'
  | 'rate_limited'
  | 'busy'
  | 'payload_too_large'
  | 'unavailable'
  | 'not_found'
  | 'internal_error';

export interface ServerLogger {
  error(message: string, context?: Record<string, unknown>): void;
}

export interface CreateServerOptions {
  /** The language model that drives the agent. Injected so tests can script it. */
  model: LanguageModel;
  store: StoreAdapter;
  /** Exact origins allowed to call the API from a browser. */
  allowedOrigins: string[];
  /** Applied separately per client IP and per session. */
  rateLimitPerMinute: number;
  agentConfig?: AgentConfig;
  /** Use the first X-Forwarded-For address as the client IP. Only behind a trusted proxy. */
  trustProxy?: boolean;
  sessions?: SessionStore;
  maxMessageChars?: number;
  maxHistoryTurns?: number;
  /** Resolves the socket address. Overridable for runtimes other than Node. */
  socketAddress?: (c: Context) => string | undefined;
  now?: () => number;
  logger?: ServerLogger;
}

const nodeSocketAddress = (c: Context): string | undefined => {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    return undefined; // not running on a Node socket (for example in-process tests)
  }
};

/** What is safe to log about a failure: its kind, never request or response content. */
function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { error: typeof error };
  const status = (error as { statusCode?: unknown }).statusCode;
  return { error: error.name, ...(typeof status === 'number' ? { status } : {}) };
}

/** Builds the chat server. Every dependency is injected, so the app is fully testable in-process. */
export function createServer(options: CreateServerOptions): Hono {
  const now = options.now ?? Date.now;
  const logger = options.logger ?? console;
  const sessions = options.sessions ?? createMemorySessionStore({ now });
  const maxHistoryTurns = options.maxHistoryTurns ?? DEFAULT_MAX_HISTORY_TURNS;
  const socketAddress = options.socketAddress ?? nodeSocketAddress;
  const allowedOrigins = new Set(options.allowedOrigins);

  const limiterOptions = { limit: options.rateLimitPerMinute, windowMs: 60_000, now };
  const ipLimiter = createSlidingWindowLimiter(limiterOptions);
  const sessionLimiter = createSlidingWindowLimiter(limiterOptions);

  const ChatRequestSchema = z.object({
    message: z
      .string()
      .trim()
      .min(1)
      .max(options.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS),
  });

  const fail = (c: Context, status: ContentfulStatusCode, code: ServerErrorCode, message: string) =>
    c.json({ error: { code, message } }, status);

  const rateLimited = (c: Context, retryAfterSeconds: number) => {
    c.header('Retry-After', String(retryAfterSeconds));
    return fail(c, 429, 'rate_limited', 'Too many requests. Please slow down and try again.');
  };

  function clientIp(c: Context): string {
    if (options.trustProxy) {
      const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
      if (forwarded) return forwarded;
    }
    return socketAddress(c) ?? 'unknown';
  }

  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  // --- /api: origin check, CORS, per-IP limit, body size --------------------

  const originGuard: MiddlewareHandler = async (c, next) => {
    const origin = c.req.header('origin');
    if (origin && !allowedOrigins.has(origin)) {
      return fail(c, 403, 'origin_not_allowed', 'This origin is not allowed to use the chat API.');
    }
    await next();
  };
  app.use('/api/*', originGuard);

  app.use(
    '/api/*',
    cors({
      origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['content-type', SESSION_HEADER],
      exposeHeaders: ['retry-after'],
      maxAge: 600,
    }),
  );

  const ipRateLimit: MiddlewareHandler = async (c, next) => {
    const decision = ipLimiter.check(clientIp(c));
    if (!decision.allowed) return rateLimited(c, decision.retryAfterSeconds);
    await next();
  };
  app.use('/api/*', ipRateLimit);

  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => fail(c, 413, 'payload_too_large', 'The request is too large.'),
    }),
  );

  // --- Sessions --------------------------------------------------------------

  app.post('/api/sessions', (c) => {
    const session = sessions.create();
    if (!session) {
      return fail(c, 503, 'unavailable', 'The assistant is busy right now. Please try again soon.');
    }
    return c.json(
      { sessionId: session.id, expiresInSeconds: Math.floor(DEFAULT_SESSION_TTL_MS / 1000) },
      201,
    );
  });

  // --- Chat ------------------------------------------------------------------

  app.post('/api/chat', async (c) => {
    const sessionId = c.req.header(SESSION_HEADER);
    if (!sessionId) {
      return fail(c, 401, 'session_required', `Send the ${SESSION_HEADER} header.`);
    }
    const session = sessions.get(sessionId);
    if (!session) {
      return fail(c, 404, 'session_not_found', 'The session has expired. Start a new one.');
    }

    const decision = sessionLimiter.check(session.id);
    if (!decision.allowed) return rateLimited(c, decision.retryAfterSeconds);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return fail(c, 400, 'validation_error', 'The request body must be JSON.');
    }
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        c,
        400,
        'validation_error',
        'Send { "message": string } with 1 to ' +
          `${options.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS} characters.`,
      );
    }

    if (session.busy) {
      return fail(c, 409, 'busy', 'The previous message is still being answered.');
    }
    session.busy = true;

    const agent = createShoppingAgent({
      store: options.store,
      session: session.agent,
      config: options.agentConfig,
    });
    const messages = trimHistory(
      [...session.history, { role: 'user', content: parsed.data.message }],
      maxHistoryTurns,
    );
    const logFailure = (error: unknown) => {
      logger.error('chat turn failed', describeError(error));
      return GENERIC_STREAM_ERROR;
    };

    const stream = createUIMessageStream({
      onError: logFailure,
      execute: async ({ writer }) => {
        try {
          const result = streamText({
            model: options.model,
            messages,
            abortSignal: c.req.raw.signal,
            ...agent.settings,
            // Failures surface as an error chunk below; this stops the SDK's own console dump.
            onError: () => undefined,
          });

          let failed = false;
          const chunks = result.toUIMessageStream({
            sendFinish: false,
            sendReasoning: false,
            onError: logFailure,
          });
          for await (const chunk of chunks) {
            if (chunk.type === 'error') failed = true;
            writer.write(chunk);
          }

          if (!failed) {
            const turn: ModelMessage[] = [...(await result.response).messages];
            const lastStep = (await result.steps).at(-1);
            if (!lastStep?.text.trim()) {
              // The step cap ended the turn mid-work. Always leave the shopper with an answer.
              writer.write({ type: 'text-start', id: 'step-limit' });
              writer.write({ type: 'text-delta', id: 'step-limit', delta: STEP_LIMIT_MESSAGE });
              writer.write({ type: 'text-end', id: 'step-limit' });
              turn.push({ role: 'assistant', content: STEP_LIMIT_MESSAGE });
            }
            // Only a completed turn becomes history, so a failure never leaves it half-written.
            session.history = trimHistory([...messages, ...turn], maxHistoryTurns);
          }
          writer.write({ type: 'finish' });
        } finally {
          session.busy = false;
        }
      },
    });

    return createUIMessageStreamResponse({ stream });
  });

  app.notFound((c) => fail(c, 404, 'not_found', 'No such endpoint.'));

  app.onError((error, c) => {
    logger.error('request failed', describeError(error));
    return fail(c, 500, 'internal_error', 'Something went wrong.');
  });

  return app;
}
