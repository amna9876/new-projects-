import type { ModelMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  createMemorySessionStore,
  createModel,
  PROVIDER_NAMES,
  PROVIDERS,
  createSlidingWindowLimiter,
  EnvError,
  readEnv,
  trimHistory,
} from '../src/index';

const VALID_ENV = { AI_MODEL: 'some-model', ANTHROPIC_API_KEY: 'sk-test-value' };

describe('readEnv', () => {
  it('applies defaults when only the model and key are set', () => {
    expect(readEnv(VALID_ENV)).toEqual({
      provider: 'anthropic',
      model: 'some-model',
      apiKey: 'sk-test-value',
      providerBaseUrl: undefined,
      storeApiBaseUrl: 'http://localhost:4000',
      storeApiKey: undefined,
      allowedOrigins: ['http://localhost:3000'],
      rateLimitPerMinute: 20,
      port: 3001,
      trustProxy: false,
      storeName: undefined,
    });
  });

  it('parses every documented variable', () => {
    const env = readEnv({
      ...VALID_ENV,
      AI_PROVIDER: 'anthropic',
      STORE_API_BASE_URL: 'https://store.example/api',
      STORE_API_KEY: ' key ',
      ALLOWED_ORIGINS: 'https://shop.example/, https://www.shop.example ,',
      RATE_LIMIT_PER_MINUTE: '5',
      PORT: '8080',
      TRUST_PROXY: 'true',
      STORE_NAME: 'Acme Outdoors',
    });
    expect(env).toMatchObject({
      storeApiBaseUrl: 'https://store.example/api',
      storeApiKey: 'key',
      allowedOrigins: ['https://shop.example', 'https://www.shop.example'],
      rateLimitPerMinute: 5,
      port: 8080,
      trustProxy: true,
      storeName: 'Acme Outdoors',
    });
  });

  it('treats blank values as unset', () => {
    const env = readEnv({ ...VALID_ENV, STORE_API_KEY: '', PORT: ' ', RATE_LIMIT_PER_MINUTE: '' });
    expect(env).toMatchObject({ storeApiKey: undefined, port: 3001, rateLimitPerMinute: 20 });
  });

  function problemsOf(source: Record<string, string>): string[] {
    try {
      readEnv(source);
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      return (error as EnvError).problems;
    }
    throw new Error('Expected readEnv to throw.');
  }

  it('names every missing variable at once', () => {
    expect(problemsOf({ AI_MODEL: '', ANTHROPIC_API_KEY: '  ' })).toEqual([
      'AI_MODEL is required',
      'ANTHROPIC_API_KEY is required when AI_PROVIDER is "anthropic"',
    ]);
  });

  it('rejects malformed values', () => {
    const problems = problemsOf({
      ...VALID_ENV,
      STORE_API_BASE_URL: 'not a url',
      RATE_LIMIT_PER_MINUTE: 'lots',
      TRUST_PROXY: 'yes',
    });
    expect(problems).toEqual([
      'STORE_API_BASE_URL must be a URL',
      'RATE_LIMIT_PER_MINUTE must be a whole number',
      'TRUST_PROXY must be "true" or "false"',
    ]);
  });

  it('rejects an unknown provider and a wildcard origin', () => {
    expect(problemsOf({ ...VALID_ENV, AI_PROVIDER: 'skynet' })[0]).toContain('AI_PROVIDER');
    expect(problemsOf({ ...VALID_ENV, ALLOWED_ORIGINS: '*' })[0]).toContain('"*" is not allowed');
  });

  it.each([
    ['google', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    ['groq', 'GROQ_API_KEY'],
  ])('requires the %s key under its own variable name', (provider, variable) => {
    expect(
      problemsOf({ AI_MODEL: 'm', AI_PROVIDER: provider, ANTHROPIC_API_KEY: 'unused' }),
    ).toEqual([`${variable} is required when AI_PROVIDER is "${provider}"`]);
    const env = readEnv({ AI_MODEL: 'm', AI_PROVIDER: provider, [variable]: ' key ' });
    expect(env).toMatchObject({ provider, apiKey: 'key' });
  });

  it('runs a local Ollama model without any key', () => {
    const env = readEnv({ AI_MODEL: 'some-local-model', AI_PROVIDER: 'ollama' });
    expect(env).toMatchObject({
      provider: 'ollama',
      apiKey: undefined,
      providerBaseUrl: 'http://localhost:11434/v1',
    });
    expect(
      readEnv({ AI_MODEL: 'm', AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://gpu-box:11434/v1' })
        .providerBaseUrl,
    ).toBe('http://gpu-box:11434/v1');
    expect(problemsOf({ AI_MODEL: 'm', AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'nope' })).toEqual([
      'OLLAMA_BASE_URL must be a URL',
    ]);
  });

  it('never puts a value into the error message', () => {
    try {
      readEnv({ AI_PROVIDER: 'skynet', ANTHROPIC_API_KEY: 'sk-live-do-not-print', AI_MODEL: '' });
    } catch (error) {
      expect((error as Error).message).not.toContain('sk-live-do-not-print');
      return;
    }
    throw new Error('Expected readEnv to throw.');
  });
});

describe('createModel', () => {
  it.each(PROVIDER_NAMES)('builds a %s model without contacting the provider', (provider) => {
    const model = createModel({ provider, model: 'model-under-test', apiKey: 'placeholder' });
    expect(model).toMatchObject({ modelId: 'model-under-test', specificationVersion: 'v3' });
  });

  it('has a definition for every provider name', () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual([...PROVIDER_NAMES].sort());
  });
});

describe('sliding window limiter', () => {
  it('allows the limit, then blocks until the oldest request leaves the window', () => {
    let now = 0;
    const limiter = createSlidingWindowLimiter({ limit: 2, windowMs: 60_000, now: () => now });

    expect(limiter.check('a')).toEqual({ allowed: true, retryAfterSeconds: 0 });
    now = 30_000;
    expect(limiter.check('a').allowed).toBe(true);
    now = 45_000;
    expect(limiter.check('a')).toEqual({ allowed: false, retryAfterSeconds: 15 });
    // Blocked requests do not extend the block.
    now = 60_001;
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a')).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });

  it('tracks keys independently', () => {
    const limiter = createSlidingWindowLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
  });
});

describe('memory session store', () => {
  it('issues long, unique, URL-safe ids', () => {
    const store = createMemorySessionStore();
    const ids = Array.from({ length: 50 }, () => store.create()!.id);
    expect(new Set(ids).size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('expires idle sessions and refreshes active ones', () => {
    let now = 0;
    const store = createMemorySessionStore({ ttlMs: 1000, now: () => now });
    const { id } = store.create()!;

    now = 900;
    expect(store.get(id)).toBeDefined();
    now = 1800; // 900 ms since the last access
    expect(store.get(id)).toBeDefined();
    now = 2801;
    expect(store.get(id)).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('refuses new sessions when full, after evicting expired ones', () => {
    let now = 0;
    const store = createMemorySessionStore({ maxSessions: 2, ttlMs: 1000, now: () => now });
    store.create();
    store.create();
    expect(store.create()).toBeUndefined();
    now = 2000;
    expect(store.create()).toBeDefined();
    expect(store.size).toBe(1);
  });

  it('does not expire a session while a turn is running', () => {
    let now = 0;
    const store = createMemorySessionStore({ ttlMs: 1000, now: () => now });
    const session = store.create()!;
    session.busy = true;
    now = 5000;
    expect(store.get(session.id)).toBe(session);
  });
});

describe('trimHistory', () => {
  const user = (content: string): ModelMessage => ({ role: 'user', content });
  const assistant = (content: string): ModelMessage => ({ role: 'assistant', content });
  const history = [user('1'), assistant('a'), assistant('b'), user('2'), assistant('c'), user('3')];

  it('keeps whole turns from the most recent user messages', () => {
    expect(trimHistory(history, 2)).toEqual([user('2'), assistant('c'), user('3')]);
    expect(trimHistory(history, 1)).toEqual([user('3')]);
  });

  it('returns the history unchanged when it is short enough', () => {
    expect(trimHistory(history, 3)).toBe(history);
    expect(trimHistory([], 5)).toEqual([]);
  });
});
