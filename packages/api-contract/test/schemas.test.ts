import { describe, expect, it } from 'vitest';
import {
  AddCartItemRequestSchema,
  buildPath,
  ErrorResponseSchema,
  MoneySchema,
  pathParams,
  ProductListQuerySchema,
  ProductSchema,
  ROUTES,
} from '../src/index';

describe('MoneySchema', () => {
  it('accepts integer minor units', () => {
    expect(MoneySchema.parse({ amount: 1999, currency: 'USD' })).toEqual({
      amount: 1999,
      currency: 'USD',
    });
  });

  it('rejects floats and malformed currencies', () => {
    expect(MoneySchema.safeParse({ amount: 19.99, currency: 'USD' }).success).toBe(false);
    expect(MoneySchema.safeParse({ amount: 1999, currency: 'usd' }).success).toBe(false);
    expect(MoneySchema.safeParse({ amount: 1999, currency: 'DOLLARS' }).success).toBe(false);
  });
});

describe('ProductListQuerySchema', () => {
  it('applies defaults to an empty query string', () => {
    expect(ProductListQuerySchema.parse({})).toEqual({ sort: 'relevance', limit: 20 });
  });

  it('coerces query-string values', () => {
    const parsed = ProductListQuerySchema.parse({
      query: '  running shoes ',
      minPrice: '1000',
      maxPrice: '5000',
      inStock: 'false',
      limit: '5',
      sort: 'price_asc',
    });
    expect(parsed).toEqual({
      query: 'running shoes',
      minPrice: 1000,
      maxPrice: 5000,
      inStock: false,
      limit: 5,
      sort: 'price_asc',
    });
  });

  it.each([
    { limit: '0' },
    { limit: '51' },
    { limit: 'ten' },
    { minPrice: '-1' },
    { minPrice: '9.5' },
    { inStock: 'yes' },
    { sort: 'cheapest' },
  ])('rejects %o', (query) => {
    expect(ProductListQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('ProductSchema', () => {
  const product = {
    id: 'p1',
    title: 'Trail Shoe',
    description: 'Grippy.',
    category: 'footwear',
    images: ['https://example.com/p1.png'],
    price: { amount: 8900, currency: 'USD' },
    inStock: true,
    attributes: { weight_g: 280, waterproof: false, material: 'mesh' },
    variants: [
      {
        id: 'p1-42',
        title: '42',
        options: { size: '42' },
        price: { amount: 8900, currency: 'USD' },
        inStock: true,
      },
    ],
  };

  it('accepts a minimal product and ignores unknown fields', () => {
    expect(ProductSchema.parse({ ...product, vendorInternalNote: 'x' })).toEqual(product);
  });

  it('requires at least one variant', () => {
    expect(ProductSchema.safeParse({ ...product, variants: [] }).success).toBe(false);
  });
});

describe('AddCartItemRequestSchema', () => {
  it('defaults quantity to 1', () => {
    expect(AddCartItemRequestSchema.parse({ productId: 'p1' })).toEqual({
      productId: 'p1',
      quantity: 1,
    });
  });

  it.each([0, -1, 1.5, 100])('rejects quantity %s', (quantity) => {
    expect(AddCartItemRequestSchema.safeParse({ productId: 'p1', quantity }).success).toBe(false);
  });
});

describe('ErrorResponseSchema', () => {
  it('only allows documented error codes', () => {
    const ok = { error: { code: 'not_found', message: 'No such product.' } };
    expect(ErrorResponseSchema.safeParse(ok).success).toBe(true);
    const bad = { error: { code: 'teapot', message: 'No.' } };
    expect(ErrorResponseSchema.safeParse(bad).success).toBe(false);
  });
});

describe('routes', () => {
  it('extracts and fills path parameters', () => {
    expect(pathParams(ROUTES.updateCartItem.path)).toEqual(['id', 'itemId']);
    expect(buildPath(ROUTES.updateCartItem.path, { id: 'c 1', itemId: 'i/2' })).toBe(
      '/carts/c%201/items/i%2F2',
    );
  });

  it('throws when a path parameter is missing', () => {
    expect(() => buildPath(ROUTES.getProduct.path)).toThrow(/Missing path parameter "id"/);
  });
});
