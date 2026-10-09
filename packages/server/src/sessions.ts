import { randomBytes } from 'node:crypto';
import type { AgentSession } from '@agentic-shop/agent-core';
import type { ModelMessage } from 'ai';

export interface ChatSession {
  readonly id: string;
  /** Cart state owned by the agent. */
  agent: AgentSession;
  /** The conversation as the server recorded it. Clients cannot edit this. */
  history: ModelMessage[];
  /** True while a turn is streaming, so turns in one session never interleave. */
  busy: boolean;
  lastSeenAt: number;
}

/** Holds chat sessions. Swap the implementation to share sessions across processes. */
export interface SessionStore {
  /** Returns undefined when the store is full. */
  create(): ChatSession | undefined;
  /** Returns the session and refreshes its expiry, or undefined when unknown or expired. */
  get(id: string): ChatSession | undefined;
  readonly size: number;
}

export interface MemorySessionStoreOptions {
  /** Idle time after which a session is forgotten. */
  ttlMs?: number;
  /** Upper bound on live sessions, to keep memory bounded. */
  maxSessions?: number;
  now?: () => number;
}

export const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_MAX_SESSIONS = 10_000;

/** 192 bits from the OS CSPRNG: the id is the only credential for a session. */
const newSessionId = () => randomBytes(24).toString('base64url');

export function createMemorySessionStore(options: MemorySessionStoreOptions = {}): SessionStore {
  const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
  const now = options.now ?? Date.now;
  const sessions = new Map<string, ChatSession>();

  const isExpired = (session: ChatSession, time: number) =>
    !session.busy && time - session.lastSeenAt > ttlMs;

  function evictExpired(time: number) {
    for (const [id, session] of sessions) {
      if (isExpired(session, time)) sessions.delete(id);
    }
  }

  return {
    create() {
      const time = now();
      if (sessions.size >= maxSessions) evictExpired(time);
      if (sessions.size >= maxSessions) return undefined;
      const session: ChatSession = {
        id: newSessionId(),
        agent: {},
        history: [],
        busy: false,
        lastSeenAt: time,
      };
      sessions.set(session.id, session);
      return session;
    },
    get(id) {
      const session = sessions.get(id);
      if (!session) return undefined;
      const time = now();
      if (isExpired(session, time)) {
        sessions.delete(id);
        return undefined;
      }
      session.lastSeenAt = time;
      return session;
    },
    get size() {
      return sessions.size;
    },
  };
}

/**
 * Keeps the most recent `maxTurns` shopper turns. Cutting only at a user
 * message keeps every tool call together with its result.
 */
export function trimHistory(history: ModelMessage[], maxTurns: number): ModelMessage[] {
  const userIndexes = history.flatMap((message, index) => (message.role === 'user' ? [index] : []));
  if (userIndexes.length <= maxTurns) return history;
  return history.slice(userIndexes[userIndexes.length - maxTurns]);
}
