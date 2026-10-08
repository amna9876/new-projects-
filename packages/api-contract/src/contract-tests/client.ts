import type { HttpMethod } from '../routes';

export interface ContractFixtures {
  /**
   * A discount code the store accepts for a cart holding one in-stock product.
   * When omitted, the "valid discount" test is skipped.
   */
  validDiscountCode?: string;
  /** A code the store must reject. Defaults to a random-looking string. */
  invalidDiscountCode?: string;
}

export interface ContractTestOptions {
  /** Base URL of the store under test, without a trailing slash. */
  baseUrl: string;
  /** Sent as `Authorization: Bearer <apiKey>` when the store requires a key. */
  apiKey?: string;
  /** Custom fetch, for example to call an app in-process. Defaults to global fetch. */
  fetch?: typeof fetch;
  fixtures?: ContractFixtures;
}

export interface ContractResponse {
  status: number;
  contentType: string;
  body: unknown;
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Set to false to send the request without the API key. */
  authenticated?: boolean;
}

export interface ContractClient {
  request(method: HttpMethod, path: string, options?: RequestOptions): Promise<ContractResponse>;
}

export function createContractClient(options: ContractTestOptions): ContractClient {
  const doFetch = options.fetch ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, '');

  return {
    async request(method, path, requestOptions = {}) {
      const url = new URL(baseUrl + path);
      for (const [key, value] of Object.entries(requestOptions.query ?? {})) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }

      const headers: Record<string, string> = { accept: 'application/json' };
      if (requestOptions.body !== undefined) headers['content-type'] = 'application/json';
      if (options.apiKey && requestOptions.authenticated !== false) {
        headers.authorization = `Bearer ${options.apiKey}`;
      }

      const response = await doFetch(url, {
        method,
        headers,
        body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
      });

      const text = await response.text();
      let body: unknown = undefined;
      if (text.length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new Error(
            `${method} ${path} returned a non-JSON body (status ${response.status}): ${text.slice(0, 200)}`,
          );
        }
      }
      return {
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
        body,
      };
    },
  };
}
