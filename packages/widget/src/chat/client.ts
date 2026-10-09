import { asToolOutput, cartFromTool } from '../guards';
import type { CartView, ToolOutput } from '../types';

export type MessagePart =
  | { kind: 'text'; id: string; text: string }
  | {
      kind: 'tool';
      toolCallId: string;
      toolName: string;
      state: 'running' | 'done' | 'failed';
      output?: ToolOutput;
    };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  /** A user message the server did not accept. */
  failed?: boolean;
}

export type ChatError =
  | { kind: 'generic' }
  | { kind: 'offline' }
  | { kind: 'busy' }
  | { kind: 'rate_limited'; retryAfterSeconds: number };

export interface ChatState {
  messages: ChatMessage[];
  /** idle: ready for input. sending: waiting for the first byte. streaming: receiving the answer. */
  status: 'idle' | 'sending' | 'streaming';
  error?: ChatError;
  /** The latest cart reported by any tool. */
  cart?: CartView;
  /** True after an expired session was replaced, so the UI can say the context was lost. */
  sessionRestarted: boolean;
}

/** The subset of Web Storage the client needs. */
export type ChatStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface ChatClientOptions {
  /** Base URL of the chat server, for example `https://chat.example.com`. */
  apiUrl: string;
  /** Namespaces persisted state, so two stores on one origin do not share a conversation. */
  storeId?: string;
  fetch?: typeof fetch;
  /** Where the session id and visible messages are kept. Pass null to disable persistence. */
  storage?: ChatStorage | null;
}

const SESSION_HEADER = 'x-session-id';
const MAX_PERSISTED_MESSAGES = 50;

interface Persisted {
  sessionId?: string;
  messages: ChatMessage[];
  cart?: CartView;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    readonly retryAfterSeconds: number,
  ) {
    super(`HTTP ${status}`);
  }
}

function defaultStorage(): ChatStorage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null; // storage can be blocked (private mode, sandboxed iframes)
  }
}

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter += 1)}`;

/**
 * Talks to the chat server and holds the conversation state. It has no
 * dependency on React or the DOM, so it can be tested and reused on its own.
 *
 * The server keeps the real history. The client sends only the new message
 * and keeps a copy of what was shown, purely for display.
 */
export class ChatClient {
  private state: ChatState;
  private sessionId: string | undefined;
  private readonly listeners = new Set<() => void>();
  private readonly apiUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly storage: ChatStorage | null;
  private readonly storageKey: string;

  constructor(options: ChatClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.storageKey = `agentic-shop:${options.storeId ?? 'default'}`;

    const persisted = this.load();
    this.sessionId = persisted.sessionId;
    this.state = {
      messages: persisted.messages,
      status: 'idle',
      cart: persisted.cart,
      sessionRestarted: false,
    };
  }

  // --- Store interface (for useSyncExternalStore) ------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): ChatState => this.state;

  // --- Actions -----------------------------------------------------------------

  /** Sends a shopper message and streams the answer into the state. */
  async send(text: string): Promise<void> {
    const message = text.trim();
    if (!message || this.state.status !== 'idle') return;

    const userMessage: ChatMessage = {
      id: nextId('user'),
      role: 'user',
      parts: [{ kind: 'text', id: 'text', text: message }],
    };
    this.update({
      messages: [...this.state.messages.filter((item) => !item.failed), userMessage],
      status: 'sending',
      error: undefined,
    });

    try {
      const response = await this.postChat(message);
      await this.readStream(response);
    } catch (error) {
      this.update({
        messages: this.state.messages.map((item) =>
          item.id === userMessage.id ? { ...item, failed: true } : item,
        ),
        error: toChatError(error),
      });
    } finally {
      this.update({ status: 'idle' });
      this.save();
    }
  }

  /** Resends the last message that failed. */
  async retry(): Promise<void> {
    const failed = [...this.state.messages].reverse().find((item) => item.failed);
    const part = failed?.parts[0];
    if (part?.kind === 'text') await this.send(part.text);
  }

  dismissError(): void {
    this.update({ error: undefined });
  }

  // --- Networking --------------------------------------------------------------

  private async createSession(): Promise<string> {
    const response = await this.fetchImpl(`${this.apiUrl}/api/sessions`, { method: 'POST' });
    if (!response.ok) throw await toHttpError(response);
    const body = (await response.json()) as { sessionId?: unknown };
    if (typeof body.sessionId !== 'string') throw new Error('Malformed session response');
    return body.sessionId;
  }

  private async postChat(message: string, isRetry = false): Promise<Response> {
    this.sessionId ??= await this.createSession();
    const response = await this.fetchImpl(`${this.apiUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SESSION_HEADER]: this.sessionId },
      body: JSON.stringify({ message }),
    });
    if (response.ok) return response;

    const error = await toHttpError(response);
    const sessionGone = error.code === 'session_not_found' || error.code === 'session_required';
    if (sessionGone && !isRetry) {
      // The server forgot this conversation (idle timeout or restart). Start over once.
      this.sessionId = undefined;
      this.update({ sessionRestarted: true, cart: undefined });
      return this.postChat(message, true);
    }
    throw error;
  }

  private async readStream(response: Response): Promise<void> {
    if (!response.body) throw new Error('The response has no body');
    const assistant: ChatMessage = { id: nextId('assistant'), role: 'assistant', parts: [] };
    let streamFailed = false;

    const apply = (chunk: Record<string, unknown>) => {
      const type = chunk.type;
      if (type === 'text-delta' && typeof chunk.delta === 'string') {
        const id = String(chunk.id);
        const last = assistant.parts.at(-1);
        if (last?.kind === 'text' && last.id === id) {
          assistant.parts = [
            ...assistant.parts.slice(0, -1),
            { ...last, text: last.text + chunk.delta },
          ];
        } else {
          assistant.parts = [...assistant.parts, { kind: 'text', id, text: chunk.delta }];
        }
      } else if (
        (type === 'tool-input-start' || type === 'tool-input-available') &&
        typeof chunk.toolCallId === 'string' &&
        typeof chunk.toolName === 'string'
      ) {
        const { toolCallId, toolName } = chunk;
        if (
          !assistant.parts.some((part) => part.kind === 'tool' && part.toolCallId === toolCallId)
        ) {
          assistant.parts = [
            ...assistant.parts,
            { kind: 'tool', toolCallId, toolName, state: 'running' },
          ];
        }
      } else if (
        type === 'tool-output-available' ||
        type === 'tool-output-error' ||
        type === 'tool-input-error'
      ) {
        const output = type === 'tool-output-available' ? asToolOutput(chunk.output) : undefined;
        assistant.parts = assistant.parts.map((part) =>
          part.kind === 'tool' && part.toolCallId === chunk.toolCallId
            ? { ...part, state: output ? ('done' as const) : ('failed' as const), output }
            : part,
        );
        const tool = assistant.parts.find(
          (part) => part.kind === 'tool' && part.toolCallId === chunk.toolCallId,
        );
        const cart = tool?.kind === 'tool' ? cartFromTool(tool.toolName, output) : undefined;
        if (cart) this.update({ cart });
      } else if (type === 'error') {
        streamFailed = true;
        return;
      } else {
        return; // start, finish, step markers and anything from a newer protocol version
      }

      const others = this.state.messages.filter((item) => item.id !== assistant.id);
      this.update({ messages: [...others, { ...assistant }], status: 'streaming' });
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice('data:'.length).trim();
          if (!data || data === '[DONE]') continue;
          try {
            apply(JSON.parse(data) as Record<string, unknown>);
          } catch {
            // A malformed event is skipped; the rest of the answer is still useful.
          }
        }
      }
      if (done) break;
    }

    if (streamFailed) this.update({ error: { kind: 'generic' } });
  }

  // --- State and persistence ---------------------------------------------------

  private update(patch: Partial<ChatState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private load(): Persisted {
    try {
      const raw = this.storage?.getItem(this.storageKey);
      const parsed = raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
      return {
        sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined,
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        cart: parsed.cart,
      };
    } catch {
      return { messages: [] };
    }
  }

  private save(): void {
    try {
      const persisted: Persisted = {
        sessionId: this.sessionId,
        messages: this.state.messages.filter((item) => !item.failed).slice(-MAX_PERSISTED_MESSAGES),
        cart: this.state.cart,
      };
      this.storage?.setItem(this.storageKey, JSON.stringify(persisted));
    } catch {
      // Storage full or unavailable: the conversation simply will not survive a reload.
    }
  }
}

async function toHttpError(response: Response): Promise<HttpError> {
  let code: string | undefined;
  try {
    const body = (await response.json()) as { error?: { code?: unknown } };
    if (typeof body.error?.code === 'string') code = body.error.code;
  } catch {
    // Not JSON: fall back to the status code.
  }
  const retryAfter = Number(response.headers.get('retry-after'));
  return new HttpError(response.status, code, Number.isFinite(retryAfter) ? retryAfter : 0);
}

function toChatError(error: unknown): ChatError {
  if (error instanceof HttpError) {
    if (error.status === 429) {
      return { kind: 'rate_limited', retryAfterSeconds: Math.max(1, error.retryAfterSeconds) };
    }
    if (error.code === 'busy') return { kind: 'busy' };
    return { kind: 'generic' };
  }
  // fetch rejects with a TypeError when the network or CORS blocks the request.
  return error instanceof TypeError ? { kind: 'offline' } : { kind: 'generic' };
}

/** What the UI needs from a chat client. Lets tests and hosts supply their own. */
export type ChatController = Pick<ChatClient, 'subscribe' | 'getState' | 'send' | 'retry'>;
