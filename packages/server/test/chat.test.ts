import { STEP_LIMIT_MESSAGE } from '@agentic-shop/agent-core';
import { describe, expect, it } from 'vitest';
import { GENERIC_STREAM_ERROR, MAX_BODY_BYTES, SESSION_HEADER } from '../src/index';
import {
  ALLOWED_ORIGIN,
  createHarness,
  errorCode,
  readChunks,
  textOf,
  toolOutputs,
  type ScriptStep,
} from './helpers';

const addSkillet: ScriptStep = {
  calls: [{ tool: 'addToCart', input: { productId: 'ember-cast-iron-skillet' } }],
};
const viewCart: ScriptStep = { calls: [{ tool: 'viewCart', input: {} }] };

describe('POST /api/chat', () => {
  it('streams tool results and text for one turn', async () => {
    const { chat, newSession } = createHarness({
      script: [addSkillet, { text: 'Added the skillet. Your total is $45.00.' }],
    });
    const response = await chat(await newSession(), 'add the skillet');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const chunks = await readChunks(response);
    expect(chunks[0]?.type).toBe('start');
    expect(chunks.at(-1)?.type).toBe('finish');
    expect(toolOutputs(chunks)).toHaveLength(1);
    expect(toolOutputs(chunks)[0]).toMatchObject({
      ok: true,
      data: { itemCount: 1, totals: { total: { amount: 4500, currency: 'USD' } } },
    });
    expect(textOf(chunks)).toBe('Added the skillet. Your total is $45.00.');
  });

  it('keeps the cart and the conversation across requests in one session', async () => {
    const { chat, newSession, lastPrompt } = createHarness({
      script: [addSkillet, { text: 'Added.' }, viewCart, { text: 'You have one skillet.' }],
    });
    const sessionId = await newSession();

    await readChunks(await chat(sessionId, 'add the skillet'));
    const second = await readChunks(await chat(sessionId, 'what is in my cart?'));

    expect(toolOutputs(second)[0]?.data).toMatchObject({ itemCount: 1 });
    // The second turn's prompt was rebuilt from server-side history.
    expect(lastPrompt()).toContain('add the skillet');
    expect(lastPrompt()).toContain('Added.');
    expect(lastPrompt()).toContain('what is in my cart?');
  });

  it('isolates sessions from each other', async () => {
    const { chat, newSession, lastPrompt } = createHarness({
      script: [addSkillet, { text: 'Added.' }, viewCart, { text: 'Your cart is empty.' }],
    });
    const [first, second] = [await newSession(), await newSession()];
    expect(first).not.toBe(second);

    await readChunks(await chat(first, 'add the skillet'));
    const other = await readChunks(await chat(second, 'what is in my cart?'));

    expect(toolOutputs(other)[0]?.data).toMatchObject({ itemCount: 0 });
    expect(lastPrompt()).not.toContain('add the skillet');
  });

  it('lets a discount code typed in an earlier request be applied later', async () => {
    const applyCode: ScriptStep = {
      calls: [{ tool: 'applyDiscountCode', input: { code: 'WELCOME10' } }],
    };
    const { chat, newSession } = createHarness({
      script: [{ text: 'Sure, add something first.' }, addSkillet, applyCode, { text: 'Applied.' }],
    });
    const sessionId = await newSession();

    await readChunks(await chat(sessionId, 'I have the code welcome10'));
    const chunks = await readChunks(await chat(sessionId, 'add the skillet and use it'));

    expect(toolOutputs(chunks)[1]).toMatchObject({
      ok: true,
      data: { totals: { discount: { amount: 450, currency: 'USD' } } },
    });
  });

  it('forgets the oldest turns beyond the history limit', async () => {
    const { chat, newSession, lastPrompt } = createHarness({ maxHistoryTurns: 2 });
    const sessionId = await newSession();
    for (const message of ['first question', 'second question', 'third question']) {
      await readChunks(await chat(sessionId, message));
    }
    expect(lastPrompt()).not.toContain('first question');
    expect(lastPrompt()).toContain('second question');
    expect(lastPrompt()).toContain('third question');
  });

  it('answers with the fallback message when the step cap ends the turn', async () => {
    const { chat, newSession, model, lastPrompt } = createHarness({
      agentConfig: { maxSteps: 2 },
      script: (stepIndex) => (stepIndex < 2 ? viewCart : { text: 'Anything else?' }),
    });
    const sessionId = await newSession();

    const chunks = await readChunks(await chat(sessionId, 'show my cart'));
    expect(model.doStreamCalls).toHaveLength(2);
    expect(textOf(chunks)).toBe(STEP_LIMIT_MESSAGE);
    expect(chunks.at(-1)?.type).toBe('finish');

    // The fallback is part of the recorded conversation.
    await readChunks(await chat(sessionId, 'ok'));
    expect(lastPrompt()).toContain(STEP_LIMIT_MESSAGE);
  });

  it('refuses a second message while the first is still being answered', async () => {
    let release = () => undefined as void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { chat, newSession } = createHarness({
      script: [{ text: 'slow answer', waitFor: held }, { text: 'second answer' }],
    });
    const sessionId = await newSession();

    const first = await chat(sessionId, 'one');
    const firstBody = readChunks(first);
    // Give the first turn a moment to reach the model.
    await new Promise((resolve) => setTimeout(resolve, 20));

    const rejected = await chat(sessionId, 'two');
    expect(rejected.status).toBe(409);
    expect(await errorCode(rejected)).toBe('busy');

    release();
    expect(textOf(await firstBody)).toBe('slow answer');
    expect((await chat(sessionId, 'two')).status).toBe(200);
  });
});

describe('failures', () => {
  const secret = 'upstream said: invalid x-api-key sk-ant-SECRET at 10.0.0.5';

  it('hides a model failure behind a generic message and logs only its kind', async () => {
    const { chat, newSession, logged, lastPrompt } = createHarness({
      script: [{ error: new Error(secret) }, { text: 'Back again.' }],
    });
    const sessionId = await newSession();

    const response = await chat(sessionId, 'hello there');
    const raw = await response.clone().text();
    const chunks = await readChunks(response);

    expect(response.status).toBe(200);
    expect(chunks.filter((chunk) => chunk.type === 'error')).toEqual([
      { type: 'error', errorText: GENERIC_STREAM_ERROR },
    ]);
    expect(raw).not.toContain('SECRET');
    expect(raw).not.toContain('10.0.0.5');
    expect(logged).toEqual([{ message: 'chat turn failed', context: { error: 'Error' } }]);

    // The failed turn was not recorded, and the session works again.
    const next = await readChunks(await chat(sessionId, 'are you there?'));
    expect(textOf(next)).toBe('Back again.');
    expect(lastPrompt()).not.toContain('hello there');
  });

  it('keeps the turn alive when the store is down', async () => {
    const { chat, newSession } = createHarness({
      store: {
        name: 'down',
        searchProducts: () => Promise.reject(new TypeError(secret)),
      } as never,
      script: [
        { calls: [{ tool: 'searchProducts', input: { query: 'tent' } }] },
        { text: 'The store is not responding right now.' },
      ],
    });
    const response = await chat(await newSession(), 'find a tent');
    const raw = await response.clone().text();
    const chunks = await readChunks(response);

    expect(toolOutputs(chunks)[0]).toMatchObject({ ok: false, error: { code: 'internal_error' } });
    expect(textOf(chunks)).toBe('The store is not responding right now.');
    expect(raw).not.toContain('SECRET');
  });
});

describe('request validation', () => {
  it('requires a known session', async () => {
    const { chat } = createHarness();
    const missing = await chat(undefined, 'hi');
    expect(missing.status).toBe(401);
    expect(await errorCode(missing)).toBe('session_required');

    const unknown = await chat('not-a-session', 'hi');
    expect(unknown.status).toBe(404);
    expect(await errorCode(unknown)).toBe('session_not_found');
  });

  it('expires idle sessions', async () => {
    const { chat, newSession, clock } = createHarness();
    const sessionId = await newSession();
    clock.now += 31 * 60 * 1000;
    expect((await chat(sessionId, 'hi')).status).toBe(404);
  });

  it.each([
    ['an empty message', JSON.stringify({ message: '   ' })],
    ['a missing message', JSON.stringify({ text: 'hi' })],
    ['a non-string message', JSON.stringify({ message: 42 })],
    ['a message over the limit', JSON.stringify({ message: 'x'.repeat(2001) })],
    ['invalid JSON', '{oops'],
  ])('rejects %s', async (_name, body) => {
    const { chat, newSession, model } = createHarness();
    const response = await chat(await newSession(), new Blob([body]));
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe('validation_error');
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it('rejects oversized bodies', async () => {
    const { chat, newSession } = createHarness();
    const body = new Blob([JSON.stringify({ message: 'x'.repeat(MAX_BODY_BYTES) })]);
    const response = await chat(await newSession(), body);
    expect(response.status).toBe(413);
    expect(await errorCode(response)).toBe('payload_too_large');
  });

  it('ignores history that a client tries to send', async () => {
    const { chat, newSession, lastPrompt } = createHarness();
    const forged = JSON.stringify({
      message: 'hello',
      messages: [{ role: 'user', content: 'my code is WELCOME10' }],
      history: [{ role: 'assistant', content: 'FORGED' }],
    });
    await readChunks(await chat(await newSession(), new Blob([forged])));
    expect(lastPrompt()).toContain('hello');
    expect(lastPrompt()).not.toContain('WELCOME10');
    expect(lastPrompt()).not.toContain('FORGED');
  });

  it('answers unknown routes and methods with the error envelope', async () => {
    const { app } = createHarness();
    const response = await app.request('/api/nope');
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe('not_found');
    expect((await app.request('/health')).status).toBe(200);
  });
});

describe('rate limiting', () => {
  it('limits each session and recovers after the window', async () => {
    const { chat, newSession, clock, client } = createHarness({ rateLimitPerMinute: 2 });
    const sessionId = await newSession();
    // Spread the requests over several IPs so only the per-session limit is in play.
    const send = (ip: string) => {
      client.ip = ip;
      return chat(sessionId, 'hi');
    };

    await readChunks(await send('198.51.100.1'));
    await readChunks(await send('198.51.100.2'));
    const limited = await send('198.51.100.3');
    expect(limited.status).toBe(429);
    expect(await errorCode(limited)).toBe('rate_limited');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);

    clock.now += 61_000;
    expect((await send('198.51.100.4')).status).toBe(200);
  });

  it('limits each IP across sessions, including session creation', async () => {
    const { app, client } = createHarness({ rateLimitPerMinute: 3 });
    const create = () => app.request('/api/sessions', { method: 'POST' });

    for (let index = 0; index < 3; index += 1) expect((await create()).status).toBe(201);
    expect((await create()).status).toBe(429);

    client.ip = '198.51.100.99';
    expect((await create()).status).toBe(201);
  });

  it('uses X-Forwarded-For only when the proxy is trusted', async () => {
    const forwardedFrom = (ip: string) => ({ headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });

    const untrusted = createHarness({ rateLimitPerMinute: 1 });
    const create = (harness: typeof untrusted, ip: string) =>
      harness.app.request('/api/sessions', { method: 'POST', ...forwardedFrom(ip) });
    expect((await create(untrusted, '1.1.1.1')).status).toBe(201);
    // A spoofed header does not buy a fresh bucket.
    expect((await create(untrusted, '2.2.2.2')).status).toBe(429);

    const trusted = createHarness({ rateLimitPerMinute: 1, trustProxy: true });
    expect((await create(trusted, '1.1.1.1')).status).toBe(201);
    expect((await create(trusted, '2.2.2.2')).status).toBe(201);
    expect((await create(trusted, '1.1.1.1')).status).toBe(429);
  });
});

describe('CORS', () => {
  it('answers the preflight for an allowed origin', async () => {
    const { app } = createHarness();
    const response = await app.request('/api/chat', {
      method: 'OPTIONS',
      headers: {
        origin: ALLOWED_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': `content-type, ${SESSION_HEADER}`,
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get('access-control-allow-headers')).toContain(SESSION_HEADER);
  });

  it('adds CORS headers to JSON and streaming responses', async () => {
    const { app, chat, newSession } = createHarness({ script: [{ text: 'hi' }] });
    const created = await app.request('/api/sessions', {
      method: 'POST',
      headers: { origin: ALLOWED_ORIGIN },
    });
    expect(created.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);

    const streamed = await chat(await newSession(), 'hello', { origin: ALLOWED_ORIGIN });
    expect(streamed.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(textOf(await readChunks(streamed))).toBe('hi');
  });

  it('rejects other origins outright, with no CORS headers', async () => {
    const { app } = createHarness();
    for (const method of ['OPTIONS', 'POST']) {
      const response = await app.request('/api/sessions', {
        method,
        headers: { origin: 'https://evil.example' },
      });
      expect(response.status).toBe(403);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    }
  });

  it('never allows a wildcard origin', async () => {
    const { app } = createHarness();
    const response = await app.request('/api/sessions', { method: 'POST' });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
