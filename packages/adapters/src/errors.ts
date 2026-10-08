import type { ErrorCode } from '@agentic-shop/api-contract';

/** The store understood the request and refused it with a contract error. */
export class StoreApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'StoreApiError';
  }
}

export type StoreUnavailableReason = 'network' | 'timeout' | 'invalid_response';

/** The store could not be reached, timed out, or did not answer with the contract. */
export class StoreUnavailableError extends Error {
  constructor(
    readonly reason: StoreUnavailableReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'StoreUnavailableError';
  }
}

/** Thrown by adapters that are scaffolded but not written yet. */
export class AdapterNotImplementedError extends Error {
  constructor(adapter: string, operation: string) {
    super(`The "${adapter}" adapter does not implement ${operation} yet.`);
    this.name = 'AdapterNotImplementedError';
  }
}
