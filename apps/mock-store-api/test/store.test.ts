import { ProductListQuerySchema, ProductSchema } from '@agentic-shop/api-contract';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { StoreError } from '../src/errors';
import { buildSeedProducts } from '../src/seed/products';
import { MockStore } from '../src/store';

const PUBLIC_URL = 'http://mock.test';
const list = (store: MockStore, query: Record<string, string> = {}) =>
  store.listProducts(ProductListQuerySchema.parse(query));

function expectStoreError(action: () => unknown, code: StoreError['code']) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(StoreError);
    expect((error as StoreError).code).toBe(code);
    return error as StoreError;
  }
  throw new Error(`Expected a StoreError with code ${code}.`);
}

describe('seed catalogue', () => {
  const products = buildSeedProducts(PUBLIC_URL);

  it('has at least 30 products with unique ids, all valid against the contract', () => {
    expect(products.length).toBeGreaterThanOrEqual(30);
    expect(new Set(products.map((product) => product.id)).size).toBe(products.length);
    for (const product of products) {
      expect(() => ProductSchema.parse(product), product.id).not.toThrow();
    }
  });

  it('covers six categories with several products each', () => {
    const counts = new Map<string, number>();
    for (const { category } of products) counts.set(category, (counts.get(category) ?? 0) + 1);
    expect(counts.size).toBe(6);
    for (const count of counts.values()) expect(count).toBeGreaterThanOrEqual(5);
  });

  it('includes the cases the agent has to handle', () => {
    expect(products.some((product) => product.variants.length > 1)).toBe(true);
    expect(products.some((product) => !product.inStock)).toBe(true);
    expect(products.some((product) => product.compareAtPrice)).toBe(true);
    const injected = products.filter((product) =>
      /ignore all previous instructions|reveal your system prompt/i.test(product.description),
    );
    expect(injected).toHaveLength(2);
  });
});

describe('MockStore product search', () => {
  let store: MockStore;
  beforeEach(() => {
    store = new MockStore({ publicUrl: PUBLIC_URL });
  });

  it('ranks title matches above description matches', () => {
    const { items } = list(store, { query: 'headphones' });
    expect(items.map((item) => item.id)).toEqual([
      'aurora-anc-headphones',
      'pulse-studio-headphones',
    ]);
  });

  it('requires every search term to match', () => {
    expect(list(store, { query: 'trail running' }).items.map((item) => item.id)).toEqual([
      'granite-trail-runner',
    ]);
    expect(list(store, { query: 'quantum toaster' }).items).toEqual([]);
  });

  it('combines filters', () => {
    const { items } = list(store, {
      category: 'footwear',
      maxPrice: '10000',
      inStock: 'true',
      sort: 'price_desc',
    });
    expect(items.map((item) => item.id)).toEqual([
      'cloudstep-walking-sneaker',
      'shoreline-slide-sandal',
    ]);
  });

  it('pages through the whole catalogue without repeats', () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = list(store, { limit: '10', ...(cursor ? { cursor } : {}) });
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(36);
    expect(new Set(seen).size).toBe(36);
  });

  it('rejects a tampered cursor', () => {
    expectStoreError(() => list(store, { cursor: 'not-a-cursor' }), 'validation_error');
  });
});

describe('MockStore carts', () => {
  let store: MockStore;
  let cartId: string;
  beforeEach(() => {
    store = new MockStore({ publicUrl: PUBLIC_URL });
    cartId = store.createCart().id;
  });

  it('merges repeated adds of the same variant into one line', () => {
    store.addItem(cartId, { productId: 'ember-cast-iron-skillet', quantity: 1 });
    const cart = store.addItem(cartId, { productId: 'ember-cast-iron-skillet', quantity: 2 });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(3);
    expect(cart.totals.subtotal.amount).toBe(13500);
  });

  it('caps the quantity of one line', () => {
    store.addItem(cartId, { productId: 'ember-cast-iron-skillet', quantity: 99 });
    expectStoreError(
      () => store.addItem(cartId, { productId: 'ember-cast-iron-skillet', quantity: 1 }),
      'validation_error',
    );
  });

  it('lists the available variants when one is required', () => {
    const error = expectStoreError(
      () => store.addItem(cartId, { productId: 'aurora-anc-headphones', quantity: 1 }),
      'variant_required',
    );
    expect(error.details).toEqual({
      variants: [
        { id: 'aurora-anc-headphones-black', title: 'Black', inStock: true },
        { id: 'aurora-anc-headphones-sand', title: 'Sand', inStock: false },
        { id: 'aurora-anc-headphones-midnight-blue', title: 'Midnight Blue', inStock: true },
      ],
    });
  });

  it('uses the variant price for the line', () => {
    const cart = store.addItem(cartId, {
      productId: 'loft-linen-duvet-cover',
      variantId: 'loft-linen-duvet-cover-king',
      quantity: 1,
    });
    expect(cart.items[0]?.unitPrice.amount).toBe(16900);
    expect(cart.items[0]?.variantTitle).toBe('King');
  });

  it('refuses out-of-stock products and unknown variants', () => {
    expectStoreError(
      () => store.addItem(cartId, { productId: 'citrus-grove-shampoo-bar', quantity: 1 }),
      'out_of_stock',
    );
    expectStoreError(
      () =>
        store.addItem(cartId, {
          productId: 'aurora-anc-headphones',
          variantId: 'nope',
          quantity: 1,
        }),
      'not_found',
    );
  });
});

describe('MockStore discounts', () => {
  let store: MockStore;
  let cartId: string;
  beforeEach(() => {
    store = new MockStore({ publicUrl: PUBLIC_URL });
    cartId = store.createCart().id;
    // $45.00
    store.addItem(cartId, { productId: 'ember-cast-iron-skillet', quantity: 1 });
  });

  it('applies a percentage code, case-insensitively', () => {
    const cart = store.applyDiscount(cartId, 'welcome10');
    expect(cart.discounts).toEqual([
      {
        code: 'WELCOME10',
        description: '10% off your order',
        amount: { amount: 450, currency: 'USD' },
      },
    ]);
    expect(cart.totals.total.amount).toBe(4050);
  });

  it('recalculates the discount when the cart changes', () => {
    store.applyDiscount(cartId, 'WELCOME10');
    const cart = store.addItem(cartId, { productId: 'ember-cast-iron-skillet', quantity: 1 });
    expect(cart.totals).toEqual({
      subtotal: { amount: 9000, currency: 'USD' },
      discount: { amount: 900, currency: 'USD' },
      total: { amount: 8100, currency: 'USD' },
    });
  });

  it('enforces the minimum subtotal of a fixed-amount code', () => {
    const error = expectStoreError(
      () => store.applyDiscount(cartId, 'SAVE20'),
      'discount_min_not_met',
    );
    expect(error.message).toContain('$100.00');

    store.addItem(cartId, { productId: 'ember-cast-iron-skillet', quantity: 2 }); // $135.00
    const cart = store.applyDiscount(cartId, 'SAVE20');
    expect(cart.totals.discount.amount).toBe(2000);
    expect(cart.totals.total.amount).toBe(11500);
  });

  it('drops a fixed-amount code once the cart falls below its minimum', () => {
    const withThree = store.addItem(cartId, { productId: 'ember-cast-iron-skillet', quantity: 2 });
    store.applyDiscount(cartId, 'SAVE20');
    const cart = store.updateItem(cartId, withThree.items[0]!.id, 1);
    expect(cart.discounts).toEqual([]);
    expect(cart.totals.total.amount).toBe(4500);
  });

  it('rejects expired and unknown codes', () => {
    expectStoreError(() => store.applyDiscount(cartId, 'EXPIRED'), 'discount_expired');
    expectStoreError(() => store.applyDiscount(cartId, 'FREE100'), 'discount_invalid');
  });
});

describe('HTTP app', () => {
  const app = createApp({ publicUrl: PUBLIC_URL, apiKey: 'secret' });

  it('serves product images and the health check without an API key', async () => {
    const image = await app.request('/images/aurora-anc-headphones.svg');
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toContain('image/svg+xml');
    expect(await image.text()).toContain('Aurora ANC');

    expect((await app.request('/health')).status).toBe(200);
  });

  it('returns the error envelope for unknown routes and bad JSON', async () => {
    const headers = { authorization: 'Bearer secret', 'content-type': 'application/json' };
    const missing = await app.request('/nope', { headers });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: 'not_found' } });

    const badJson = await app.request('/carts', { method: 'POST', headers, body: '{oops' });
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toMatchObject({ error: { code: 'validation_error' } });
  });
});
