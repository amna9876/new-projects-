import { createRestAdapter } from '@agentic-shop/adapters';
import { createMockStoreFetch, IN_PROCESS_BASE_URL } from '@agentic-shop/mock-store-api';
import { createServer, type CreateServerOptions } from '@agentic-shop/server';
import { scriptedModel, type Script } from '@agentic-shop/server/testing';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import type { ChatController, ChatState } from '../src/chat/client';
import { WidgetProvider } from '../src/context';
import { createTranslator } from '../src/i18n/index';

export const API_URL = 'http://chat.test';

/**
 * A real chat server (scripted model, in-process mock store) behind a `fetch`.
 * Nothing touches the network.
 */
export function createBackend(script: Script, overrides: Partial<CreateServerOptions> = {}) {
  const model = scriptedModel(script);
  const app = createServer({
    model,
    store: createRestAdapter({ baseUrl: IN_PROCESS_BASE_URL, fetch: createMockStoreFetch() }),
    allowedOrigins: [],
    rateLimitPerMinute: 100,
    socketAddress: () => '203.0.113.1',
    logger: { error: () => undefined },
    ...overrides,
  });
  const requests: { path: string; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push({
      path: url.pathname,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    });
    return app.request(url.pathname, init);
  };
  return { fetch: fetchImpl, model, requests };
}

/** In-memory stand-in for sessionStorage. */
export function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

export const IDLE_STATE: ChatState = { messages: [], status: 'idle', sessionRestarted: false };

/** A controllable chat controller for component tests that do not need a server. */
export function fakeController(initial: Partial<ChatState> = {}) {
  let state: ChatState = { ...IDLE_STATE, ...initial };
  const listeners = new Set<() => void>();
  const controller: ChatController = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,
    send: vi.fn(() => Promise.resolve()),
    retry: vi.fn(() => Promise.resolve()),
  };
  return {
    controller,
    setState(patch: Partial<ChatState>) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
  };
}

/** Renders a result component inside the widget context. */
export function renderResult(
  ui: ReactElement,
  options: { busy?: boolean; language?: string } = {},
) {
  const send = vi.fn();
  const language = options.language ?? 'en';
  const view = render(
    <WidgetProvider
      value={{ t: createTranslator(language), locale: language, send, busy: options.busy ?? false }}
    >
      {ui}
    </WidgetProvider>,
  );
  return { ...view, send };
}

export const money = (amount: number, currency = 'USD') => ({ amount, currency });

export const HEADPHONES = {
  productId: 'aurora-anc-headphones',
  title: 'Aurora ANC Wireless Headphones',
  brand: 'Soniq',
  category: 'electronics',
  image: 'https://store.test/images/aurora.svg',
  price: money(19900),
  compareAtPrice: money(24900),
  inStock: true,
  rating: { average: 4.7, count: 2184 },
  variantCount: 3,
};

export const SKILLET = {
  productId: 'ember-cast-iron-skillet',
  title: 'Ember 10" Cast Iron Skillet',
  category: 'home-kitchen',
  price: money(4500),
  inStock: true,
  variantCount: 1,
};

export const CART = {
  items: [
    {
      itemId: 'item_1',
      productId: 'aurora-anc-headphones',
      variantId: 'aurora-anc-headphones-black',
      title: 'Aurora ANC Wireless Headphones',
      variantTitle: 'Black',
      quantity: 2,
      unitPrice: money(19900),
      lineTotal: money(39800),
    },
  ],
  itemCount: 2,
  discounts: [{ code: 'WELCOME10', description: '10% off your order', amount: money(3980) }],
  totals: { subtotal: money(39800), discount: money(3980), total: money(35820) },
};
