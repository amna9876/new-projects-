import { createRestAdapter, type RestAdapterOptions } from './rest';
import type { StoreAdapter } from './types';

export const MOCK_STORE_DEFAULT_URL = 'http://localhost:4000';

export type MockAdapterOptions = Partial<Omit<RestAdapterOptions, 'name'>>;

/**
 * Adapter for the bundled mock store (`apps/mock-store-api`). The mock store
 * speaks the Store API contract, so this is the REST adapter with defaults.
 */
export function createMockAdapter(options: MockAdapterOptions = {}): StoreAdapter {
  return createRestAdapter({
    ...options,
    baseUrl: options.baseUrl ?? MOCK_STORE_DEFAULT_URL,
    name: 'mock',
  });
}
