import { createApp, type CreateAppOptions } from './app';

export { createApp, type CreateAppOptions } from './app';
export { MockStore, type MockStoreOptions } from './store';

/** Base URL to pair with {@link createMockStoreFetch}; no network is involved. */
export const IN_PROCESS_BASE_URL = 'http://mock-store.test';

/**
 * Returns a `fetch` that serves a fresh mock store in-process, for tests that
 * need a contract-compliant store without opening a port.
 */
export function createMockStoreFetch(options: CreateAppOptions = {}): typeof fetch {
  const app = createApp({ publicUrl: IN_PROCESS_BASE_URL, ...options });
  return async (input, init) => app.fetch(new Request(input, init));
}
