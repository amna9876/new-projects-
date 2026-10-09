import { createRestAdapter } from '@agentic-shop/adapters';
import { createMockStoreFetch, IN_PROCESS_BASE_URL } from '@agentic-shop/mock-store-api';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { createServer, SESSION_HEADER, type CreateServerOptions } from '../src/index';

/** One scripted model step: tool calls, a text answer, or a failure. */
export interface ScriptStep {
  calls?: { tool: string; input: unknown }[];
  text?: string;
  error?: Error;
  /** Resolves before the step starts streaming; lets a test hold a turn open. */
  waitFor?: Promise<void>;
}

type Script = ScriptStep[] | ((stepIndex: number) => ScriptStep);

const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

/** A streaming model that replays a script; once an array script runs out it says "Done.". */
export function scriptedModel(script: Script): MockLanguageModelV3 {
  let stepIndex = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      const step =
        typeof script === 'function' ? script(stepIndex) : (script[stepIndex] ?? { text: 'Done.' });
      stepIndex += 1;
      await step.waitFor;
      if (step.error) throw step.error;

      const body = step.calls?.length
        ? step.calls.map((call, index) => ({
            type: 'tool-call' as const,
            toolCallId: `call-${stepIndex}-${index}`,
            toolName: call.tool,
            input: JSON.stringify(call.input),
          }))
        : [
            { type: 'text-start' as const, id: 'text' },
            { type: 'text-delta' as const, id: 'text', delta: step.text ?? '' },
            { type: 'text-end' as const, id: 'text' },
          ];

      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start' as const, warnings: [] },
            ...body,
            {
              type: 'finish' as const,
              finishReason: {
                unified: step.calls?.length ? ('tool-calls' as const) : ('stop' as const),
                raw: undefined,
              },
              usage: USAGE,
            },
          ],
        }),
      };
    },
  });
}

export interface StreamChunk {
  type: string;
  [key: string]: unknown;
}

/** Parses a UI message stream (server-sent events) into its chunks. */
export async function readChunks(response: Response): Promise<StreamChunk[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))
    .filter((data) => data !== '[DONE]')
    .map((data) => JSON.parse(data) as StreamChunk);
}

export const textOf = (chunks: StreamChunk[]) =>
  chunks
    .filter((chunk) => chunk.type === 'text-delta')
    .map((chunk) => String(chunk.delta))
    .join('');

export const toolOutputs = (chunks: StreamChunk[]) =>
  chunks
    .filter((chunk) => chunk.type === 'tool-output-available')
    .map((chunk) => chunk.output as { ok: boolean; data?: unknown; error?: { code: string } });

export const ALLOWED_ORIGIN = 'http://localhost:3000';

export interface HarnessOptions extends Partial<CreateServerOptions> {
  script?: Script;
}

/** A chat server wired to a scripted model and an in-process mock store. */
export function createHarness(options: HarnessOptions = {}) {
  const { script = [], ...overrides } = options;
  const model = scriptedModel(script);
  const logged: { message: string; context?: Record<string, unknown> }[] = [];
  const clock = { now: Date.UTC(2026, 0, 1) };
  const client = { ip: '203.0.113.7' };

  const app = createServer({
    model,
    store: createRestAdapter({ baseUrl: IN_PROCESS_BASE_URL, fetch: createMockStoreFetch() }),
    allowedOrigins: [ALLOWED_ORIGIN],
    rateLimitPerMinute: 100,
    socketAddress: () => client.ip,
    now: () => clock.now,
    logger: { error: (message, context) => logged.push({ message, context }) },
    ...overrides,
  });

  async function newSession(): Promise<string> {
    const response = await app.request('/api/sessions', { method: 'POST' });
    const body = (await response.json()) as { sessionId: string };
    return body.sessionId;
  }

  function chat(sessionId: string | undefined, message: unknown, headers = {}) {
    return app.request('/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(sessionId ? { [SESSION_HEADER]: sessionId } : {}),
        ...headers,
      },
      body: typeof message === 'string' ? JSON.stringify({ message }) : (message as Blob),
    });
  }

  /** Everything the model was shown on its most recent step, as one string. */
  const lastPrompt = () => JSON.stringify(model.doStreamCalls.at(-1)?.prompt ?? []);

  return { app, model, logged, clock, client, newSession, chat, lastPrompt };
}

export async function errorCode(response: Response): Promise<string> {
  const body = (await response.json()) as { error: { code: string } };
  return body.error.code;
}
