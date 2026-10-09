// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ChatClient, type ChatMessage } from '../src/chat/client';
import { API_URL, createBackend, memoryStorage } from './helpers';

/**
 * The chat client against a real chat server (scripted model, in-process mock
 * store). This is the same wire protocol the browser uses.
 */

const addSkillet = {
  calls: [{ tool: 'addToCart', input: { productId: 'ember-cast-iron-skillet' } }],
};

const textOf = (message: ChatMessage | undefined) =>
  message?.parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])).join('') ?? '';
const toolsOf = (message: ChatMessage | undefined) =>
  message?.parts.flatMap((part) => (part.kind === 'tool' ? [part] : [])) ?? [];

function setup(script: Parameters<typeof createBackend>[0], overrides = {}) {
  const backend = createBackend(script, overrides);
  const storage = memoryStorage();
  const client = new ChatClient({
    apiUrl: API_URL,
    fetch: backend.fetch,
    storage,
    storeId: 'demo',
  });
  return { ...backend, storage, client };
}

describe('ChatClient', () => {
  it('creates a session, sends only the new message, and streams the answer', async () => {
    const { client, requests } = setup([addSkillet, { text: 'Added the skillet.' }]);
    const statuses: string[] = [];
    client.subscribe(() => statuses.push(client.getState().status));

    await client.send('  add the skillet  ');

    expect(requests).toEqual([
      { path: '/api/sessions', body: undefined },
      { path: '/api/chat', body: { message: 'add the skillet' } },
    ]);
    const { messages, status, cart, error } = client.getState();
    expect(status).toBe('idle');
    expect(error).toBeUndefined();
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(textOf(messages[0])).toBe('add the skillet');
    expect(textOf(messages[1])).toBe('Added the skillet.');
    expect(toolsOf(messages[1])).toEqual([
      expect.objectContaining({ toolName: 'addToCart', state: 'done' }),
    ]);
    expect(cart).toMatchObject({ itemCount: 1, totals: { total: { amount: 4500 } } });
    expect(new Set(statuses)).toEqual(new Set(['sending', 'streaming', 'idle']));
  });

  it('reuses the session, so the server keeps the cart between messages', async () => {
    const { client, requests } = setup([
      addSkillet,
      { text: 'Added.' },
      addSkillet,
      { text: 'Added another.' },
    ]);
    await client.send('add the skillet');
    await client.send('one more');

    expect(requests.filter((request) => request.path === '/api/sessions')).toHaveLength(1);
    expect(client.getState().cart?.itemCount).toBe(2);
    expect(client.getState().messages).toHaveLength(4);
  });

  it('tracks the cart through a discount and the checkout link', async () => {
    const { client } = setup([
      addSkillet,
      { calls: [{ tool: 'applyDiscountCode', input: { code: 'WELCOME10' } }] },
      { calls: [{ tool: 'getCheckoutLink', input: {} }] },
      { text: 'Here is your link.' },
    ]);
    await client.send('add the skillet, use WELCOME10 and check out');

    expect(client.getState().cart?.totals).toEqual({
      subtotal: { amount: 4500, currency: 'USD' },
      discount: { amount: 450, currency: 'USD' },
      total: { amount: 4050, currency: 'USD' },
    });
    const tools = toolsOf(client.getState().messages[1]);
    expect(tools.map((tool) => tool.toolName)).toEqual([
      'addToCart',
      'applyDiscountCode',
      'getCheckoutLink',
    ]);
  });

  it('keeps a failed tool result without touching the cart', async () => {
    const { client } = setup([
      { calls: [{ tool: 'addToCart', input: { productId: 'aurora-anc-headphones' } }] },
      { text: 'Which colour?' },
    ]);
    await client.send('add the aurora headphones');

    const [tool] = toolsOf(client.getState().messages[1]);
    expect(tool?.output).toMatchObject({ ok: false, error: { code: 'needs_clarification' } });
    expect(client.getState().cart).toBeUndefined();
  });

  it('ignores empty messages and messages sent while busy', async () => {
    const { client, requests } = setup([{ text: 'one' }, { text: 'two' }]);
    await client.send('   ');
    expect(requests).toHaveLength(0);

    const first = client.send('first');
    await client.send('second');
    await first;
    expect(requests.filter((request) => request.path === '/api/chat')).toHaveLength(1);
  });
});

describe('persistence', () => {
  it('restores the conversation, cart and session after a reload', async () => {
    const { client, storage, fetch, requests } = setup([
      addSkillet,
      { text: 'Added.' },
      { calls: [{ tool: 'viewCart', input: {} }] },
      { text: 'One skillet.' },
    ]);
    await client.send('add the skillet');

    const reloaded = new ChatClient({ apiUrl: API_URL, fetch, storage, storeId: 'demo' });
    expect(reloaded.getState().messages).toHaveLength(2);
    expect(reloaded.getState().cart?.itemCount).toBe(1);

    await reloaded.send('what is in my cart?');
    expect(requests.filter((request) => request.path === '/api/sessions')).toHaveLength(1);
    expect(reloaded.getState().cart?.itemCount).toBe(1);
  });

  it('keeps stores apart and survives corrupt or missing storage', () => {
    const { fetch, storage } = setup([]);
    storage.setItem('agentic-shop:demo', '{not json');
    storage.setItem('agentic-shop:other', JSON.stringify({ sessionId: 's', messages: 'nope' }));

    for (const storeId of ['demo', 'other', 'third']) {
      const client = new ChatClient({ apiUrl: API_URL, fetch, storage, storeId });
      expect(client.getState().messages).toEqual([]);
    }
    expect(() => new ChatClient({ apiUrl: API_URL, fetch, storage: null })).not.toThrow();
  });
});

describe('failure handling', () => {
  it('starts a new session when the old one has expired', async () => {
    const { fetch, requests } = setup([{ text: 'Hello again.' }]);
    const storage = memoryStorage({
      'agentic-shop:demo': JSON.stringify({ sessionId: 'expired-session', messages: [] }),
    });
    const client = new ChatClient({ apiUrl: API_URL, fetch, storage, storeId: 'demo' });

    await client.send('hi');

    expect(requests.map((request) => request.path)).toEqual([
      '/api/chat',
      '/api/sessions',
      '/api/chat',
    ]);
    expect(client.getState().sessionRestarted).toBe(true);
    expect(client.getState().error).toBeUndefined();
    expect(textOf(client.getState().messages[1])).toBe('Hello again.');
  });

  it('reports rate limiting with the wait time, then recovers with retry', async () => {
    let now = 0;
    const { client } = setup([{ text: 'first' }, { text: 'second' }], {
      rateLimitPerMinute: 2,
      now: () => now,
    });
    await client.send('one'); // uses both per-IP requests: session + chat
    await client.send('two');

    const state = client.getState();
    expect(state.error).toEqual({ kind: 'rate_limited', retryAfterSeconds: 60 });
    expect(state.messages.at(-1)).toMatchObject({ role: 'user', failed: true });

    now = 61_000;
    await client.retry();
    expect(client.getState().error).toBeUndefined();
    expect(client.getState().messages.filter((message) => message.failed)).toEqual([]);
    expect(textOf(client.getState().messages.at(-1))).toBe('second');
  });

  it('reports a failure in the middle of a stream as a generic error', async () => {
    const { client } = setup([{ error: new Error('provider exploded: key sk-SECRET') }]);
    await client.send('hello');

    expect(client.getState().error).toEqual({ kind: 'generic' });
    expect(JSON.stringify(client.getState())).not.toContain('SECRET');
    expect(client.getState().status).toBe('idle');
  });

  it('reports an unreachable server as offline', async () => {
    const client = new ChatClient({
      apiUrl: API_URL,
      storage: null,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await client.send('hello');
    expect(client.getState().error).toEqual({ kind: 'offline' });
    expect(client.getState().messages[0]?.failed).toBe(true);
  });

  it('skips malformed stream events and unknown chunk types', async () => {
    const body = [
      'data: {"type":"start"}',
      'data: not json at all',
      'data: {"type":"from-the-future","x":1}',
      'data: {"type":"text-delta","id":"t","delta":"still "}',
      'data: {"type":"text-delta","id":"t","delta":"works"}',
      'data: [DONE]',
    ].join('\n\n');
    const client = new ChatClient({
      apiUrl: API_URL,
      storage: null,
      fetch: (input) =>
        Promise.resolve(
          (input as string).endsWith('/api/sessions')
            ? Response.json({ sessionId: 's' }, { status: 201 })
            : new Response(body + '\n\n', { headers: { 'content-type': 'text/event-stream' } }),
        ),
    });
    await client.send('hello');
    expect(textOf(client.getState().messages[1])).toBe('still works');
    expect(client.getState().error).toBeUndefined();
  });
});
