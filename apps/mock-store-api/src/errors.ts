import type { ErrorCode } from '@agentic-shop/api-contract';

/** A failure that maps directly onto the contract's error envelope. */
export class StoreError extends Error {
  constructor(
    readonly status: 400 | 401 | 404 | 409 | 422,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

export const notFound = (what: string) => new StoreError(404, 'not_found', `${what} not found.`);
