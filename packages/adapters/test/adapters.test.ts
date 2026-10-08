import { createMockStoreFetch, IN_PROCESS_BASE_URL } from '@agentic-shop/mock-store-api';
import { describe, expect, it, vi } from 'vitest';
import {
  AdapterNotImplementedError,
  createMockAdapter,
  createRestAdapter,
  createShopifyAdapter,
  createWooCommerceAdapter,
  StoreApiError,
  StoreUnavailableError,
} from '../src/index';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function inProcessAdapter() {
  return createRestAdapter({ baseUrl: IN_PROCESS_BASE_URL, fetch: createMockStoreFetch() });
}

describe('REST adapter against the mock store', () => {
  it('searches with typed filters', async () => {
    const store = inProcessAdapter();
    const page = await store.searchProducts({
      category: 'footwear',
      maxPrice: 10000,
      inStock: true,
      sort: 'price_asc',
      limit: 5,
    });
    expect(page.items.map((item) => item.id)).toEqual([
      'shoreline-slide-sandal',
      'cloudstep-walking-sneaker',
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('walks a cart through its whole life', async () => {
    const store = inProcessAdapter();
    const cart = await store.createCart();
    const withItem = await store.addCartItem(cart.id, { productId: 'ember-cast-iron-skillet' });
    const itemId = withItem.items[0]!.id;

    expect((await store.updateCartItem(cart.id, itemId, 3)).totals.subtotal.amount).toBe(13500);
    expect((await store.applyDiscount(cart.id, 'SAVE20')).totals.total.amount).toBe(11500);
    expect((await store.getCheckoutUrl(cart.id)).url).toContain(cart.id);
    expect((await store.removeCartItem(cart.id, itemId)).items).toEqual([]);
    expect((await store.getCart(cart.id)).itemCount).toBe(0);
  });

  it('turns contract errors into StoreApiError', async () => {
    const store = inProcessAdapter();
    await expect(store.getProduct('nope')).rejects.toMatchObject({
      name: 'StoreApiError',
      status: 404,
      code: 'not_found',
    });

    const cart = await store.createCart();
    const error = await store
      .addCartItem(cart.id, { productId: 'aurora-anc-headphones' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StoreApiError);
    expect((error as StoreApiError).code).toBe('variant_required');
    expect((error as StoreApiError).details).toHaveProperty('variants');
  });

  it('sends the API key as a Bearer token', async () => {
    const fetch = createMockStoreFetch({ apiKey: 'secret' });
    const authorised = createRestAdapter({ baseUrl: IN_PROCESS_BASE_URL, fetch, apiKey: 'secret' });
    const anonymous = createRestAdapter({ baseUrl: IN_PROCESS_BASE_URL, fetch });

    await expect(authorised.getProduct('ember-cast-iron-skillet')).resolves.toHaveProperty('id');
    await expect(anonymous.getProduct('ember-cast-iron-skillet')).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });
});

describe('REST adapter failure handling', () => {
  const adapterWith = (fetch: typeof globalThis.fetch, timeoutMs?: number) =>
    createRestAdapter({ baseUrl: 'http://store.test/', fetch, timeoutMs });

  it('reports an unreachable store', async () => {
    const store = adapterWith(() => Promise.reject(new TypeError('fetch failed')));
    const error = await store.searchProducts().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StoreUnavailableError);
    expect((error as StoreUnavailableError).reason).toBe('network');
  });

  it('times out slow stores', async () => {
    const slow: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason as Error));
      });
    await expect(adapterWith(slow, 20).searchProducts()).rejects.toMatchObject({
      reason: 'timeout',
    });
  });

  it.each([
    ['a body that is not JSON', () => new Response('<html>502</html>', { status: 502 })],
    ['an error without the contract envelope', () => jsonResponse({ oops: true }, 500)],
    ['a success body that breaks the contract', () => jsonResponse({ items: 'many' })],
  ])('rejects %s', async (_name, respond) => {
    const store = adapterWith(() => Promise.resolve(respond()));
    await expect(store.searchProducts()).rejects.toMatchObject({ reason: 'invalid_response' });
  });

  it('builds URLs from the base URL, path parameters and query', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(jsonResponse({ items: [], nextCursor: null })),
    );
    await adapterWith(fetch).searchProducts({ query: 'red shoes', inStock: false });
    expect((fetch.mock.calls[0]?.[0] as URL).href).toBe(
      'http://store.test/products?query=red+shoes&inStock=false',
    );
  });
});

describe('preset and stub adapters', () => {
  it('names the mock adapter and points it at the local mock store', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(jsonResponse({ items: [], nextCursor: null })),
    );
    const store = createMockAdapter({ fetch });
    expect(store.name).toBe('mock');
    await store.searchProducts();
    expect((fetch.mock.calls[0]?.[0] as URL).href).toBe('http://localhost:4000/products');
  });

  it('rejects every operation of the scaffolded adapters', async () => {
    const shopify = createShopifyAdapter({
      shopDomain: 'x.myshopify.com',
      storefrontAccessToken: 't',
    });
    const woo = createWooCommerceAdapter({ siteUrl: 'https://shop.example' });
    await expect(shopify.searchProducts()).rejects.toBeInstanceOf(AdapterNotImplementedError);
    await expect(woo.getCheckoutUrl('c')).rejects.toThrow(
      'The "woocommerce" adapter does not implement getCheckoutUrl yet.',
    );
  });
});
