export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RouteDefinition {
  readonly method: HttpMethod;
  /** OpenAPI-style path template, for example `/carts/{id}/items/{itemId}`. */
  readonly path: string;
}

/** Every endpoint of the Store API contract, keyed by operation id. */
export const ROUTES = {
  listProducts: { method: 'GET', path: '/products' },
  getProduct: { method: 'GET', path: '/products/{id}' },
  createCart: { method: 'POST', path: '/carts' },
  getCart: { method: 'GET', path: '/carts/{id}' },
  addCartItem: { method: 'POST', path: '/carts/{id}/items' },
  updateCartItem: { method: 'PATCH', path: '/carts/{id}/items/{itemId}' },
  removeCartItem: { method: 'DELETE', path: '/carts/{id}/items/{itemId}' },
  applyDiscount: { method: 'POST', path: '/carts/{id}/discounts' },
  getCheckoutUrl: { method: 'GET', path: '/carts/{id}/checkout-url' },
} as const satisfies Record<string, RouteDefinition>;

export type OperationId = keyof typeof ROUTES;

/** Names of the `{param}` placeholders in a path template. */
export function pathParams(path: string): string[] {
  return [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '');
}

/** Fills a path template, URL-encoding each parameter. */
export function buildPath(path: string, params: Record<string, string> = {}): string {
  return path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing path parameter "${name}" for ${path}`);
    }
    return encodeURIComponent(value);
  });
}
