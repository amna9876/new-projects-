import type { ErrorCode, ErrorResponse } from '@agentic-shop/api-contract';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { StoreError } from './errors';
import { cartRoutes } from './routes/carts';
import { imageRoutes } from './routes/images';
import { productRoutes } from './routes/products';
import { MockStore } from './store';

export interface CreateAppOptions {
  /** Origin used in image and checkout URLs. Ignored when `store` is given. */
  publicUrl?: string;
  /** When set, every API request must send `Authorization: Bearer <apiKey>`. */
  apiKey?: string;
  store?: MockStore;
}

const errorBody = (code: ErrorCode, message: string, details?: unknown): ErrorResponse => ({
  error: { code, message, ...(details === undefined ? {} : { details }) },
});

/** Builds the mock store HTTP app. Each call gets its own in-memory state. */
export function createApp(options: CreateAppOptions = {}): Hono {
  const store =
    options.store ?? new MockStore({ publicUrl: options.publicUrl ?? 'http://localhost:4000' });
  const app = new Hono();

  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/', imageRoutes(store));

  if (options.apiKey) {
    const expected = `Bearer ${options.apiKey}`;
    app.use('*', async (c, next) => {
      if (c.req.header('authorization') !== expected) {
        throw new StoreError(401, 'unauthorized', 'A valid API key is required.');
      }
      await next();
    });
  }

  app.route('/', productRoutes(store));
  app.route('/', cartRoutes(store));

  app.notFound((c) => c.json(errorBody('not_found', 'No such endpoint.'), 404));

  app.onError((error, c) => {
    if (error instanceof StoreError) {
      return c.json(
        errorBody(error.code, error.message, error.details),
        error.status as ContentfulStatusCode,
      );
    }
    if (error instanceof ZodError) {
      return c.json(
        errorBody('validation_error', 'The request is not valid.', { issues: error.issues }),
        400,
      );
    }
    console.error(error);
    return c.json(errorBody('internal_error', 'Something went wrong.'), 500);
  });

  return app;
}
