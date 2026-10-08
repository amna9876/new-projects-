import {
  buildPath,
  CartSchema,
  CheckoutUrlResponseSchema,
  ErrorResponseSchema,
  ProductListResponseSchema,
  ProductSchema,
  ROUTES,
  type OperationId,
} from '@agentic-shop/api-contract';
import type { z } from 'zod';
import { StoreApiError, StoreUnavailableError } from './errors';
import type { StoreAdapter } from './types';

export interface RestAdapterOptions {
  /** Base URL of a store that implements the Store API contract. */
  baseUrl: string;
  /** Sent as `Authorization: Bearer <apiKey>`. */
  apiKey?: string;
  /** Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Per-request timeout. Defaults to 10 seconds. */
  timeoutMs?: number;
  name?: string;
}

interface CallOptions {
  params?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** Adapter for any store that implements the Store API contract over HTTP. */
export function createRestAdapter(options: RestAdapterOptions): StoreAdapter {
  const doFetch = options.fetch ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function call<T extends z.ZodType>(
    operationId: OperationId,
    schema: T,
    { params, query, body }: CallOptions = {},
  ): Promise<z.output<T>> {
    const route = ROUTES[operationId];
    const url = new URL(baseUrl + buildPath(route.path, params));
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;

    let status: number;
    let payload: unknown;
    try {
      const response = await doFetch(url, {
        method: route.method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      status = response.status;
      const text = await response.text();
      payload = text.length > 0 ? (JSON.parse(text) as unknown) : undefined;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new StoreUnavailableError(
          'invalid_response',
          `${operationId}: the store did not answer with JSON.`,
          { cause: error },
        );
      }
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new StoreUnavailableError(
        timedOut ? 'timeout' : 'network',
        `${operationId}: ${timedOut ? 'the store took too long to answer' : 'the store could not be reached'}.`,
        { cause: error },
      );
    }

    if (status >= 400) {
      const failure = ErrorResponseSchema.safeParse(payload);
      if (failure.success) {
        const { code, message, details } = failure.data.error;
        throw new StoreApiError(status, code, message, details);
      }
      throw new StoreUnavailableError(
        'invalid_response',
        `${operationId}: the store answered ${status} without a contract error body.`,
      );
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new StoreUnavailableError(
        'invalid_response',
        `${operationId}: the store's response does not match the contract.`,
        { cause: parsed.error },
      );
    }
    return parsed.data;
  }

  return {
    name: options.name ?? 'rest',
    searchProducts: (params = {}) =>
      call('listProducts', ProductListResponseSchema, { query: { ...params } }),
    getProduct: (id) => call('getProduct', ProductSchema, { params: { id } }),
    createCart: () => call('createCart', CartSchema, { body: {} }),
    getCart: (id) => call('getCart', CartSchema, { params: { id } }),
    addCartItem: (id, item) => call('addCartItem', CartSchema, { params: { id }, body: item }),
    updateCartItem: (id, itemId, quantity) =>
      call('updateCartItem', CartSchema, { params: { id, itemId }, body: { quantity } }),
    removeCartItem: (id, itemId) => call('removeCartItem', CartSchema, { params: { id, itemId } }),
    applyDiscount: (id, code) =>
      call('applyDiscount', CartSchema, { params: { id }, body: { code } }),
    getCheckoutUrl: (id) => call('getCheckoutUrl', CheckoutUrlResponseSchema, { params: { id } }),
  };
}
