import type { Context } from 'hono';
import { StoreError } from '../errors';

/** Converts an OpenAPI path template (`/carts/{id}`) to Hono syntax (`/carts/:id`). */
export const honoPath = (path: string) => path.replace(/\{(\w+)\}/g, ':$1');

/** Reads a JSON body. An empty body yields `{}` so optional bodies can be omitted. */
export async function readJsonBody(c: Context): Promise<unknown> {
  const text = await c.req.text();
  if (text.trim().length === 0) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new StoreError(400, 'validation_error', 'The request body is not valid JSON.');
  }
}

/** Path parameter that the router guarantees is present. */
export function param(c: Context, name: string): string {
  const value = c.req.param(name);
  if (value === undefined) throw new Error(`Route is missing the "${name}" parameter.`);
  return value;
}
