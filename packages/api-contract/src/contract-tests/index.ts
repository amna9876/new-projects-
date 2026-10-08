import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildPath, ROUTES, type OperationId } from '../routes';
import { CartSchema, CheckoutUrlResponseSchema, type Cart } from '../schemas/cart';
import { ErrorResponseSchema, type ErrorCode } from '../schemas/common';
import {
  ProductListResponseSchema,
  ProductSchema,
  type Product,
  type ProductVariant,
} from '../schemas/product';
import {
  createContractClient,
  type ContractClient,
  type ContractResponse,
  type ContractTestOptions,
  type RequestOptions,
} from './client';

export type { ContractFixtures, ContractTestOptions } from './client';

type OptionsInput =
  ContractTestOptions | (() => ContractTestOptions | Promise<ContractTestOptions>);

const UNKNOWN_ID = 'contract-test-unknown-id';
const DEFAULT_INVALID_CODE = 'CONTRACT-TEST-NOT-A-REAL-CODE';
const DISCOVERY_PAGE_LIMIT = 10;

/** Asserts the status and validates the body against the schema, returning the typed body. */
function expectBody<T extends z.ZodType>(
  response: ContractResponse,
  status: number,
  schema: T,
): z.output<T> {
  expect(response.status, `unexpected status, body: ${JSON.stringify(response.body)}`).toBe(status);
  expect(response.contentType).toContain('application/json');
  const parsed = schema.safeParse(response.body);
  if (!parsed.success) {
    throw new Error(`Response does not match the contract:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

function expectError(response: ContractResponse, status: number, codes: ErrorCode | ErrorCode[]) {
  const body = expectBody(response, status, ErrorResponseSchema);
  expect([codes].flat()).toContain(body.error.code);
  expect(body.error.message.length).toBeGreaterThan(0);
}

/** Checks the arithmetic every store must get right, whatever its pricing rules are. */
function expectConsistentCart(cart: Cart) {
  for (const item of cart.items) {
    expect(item.unitPrice.currency).toBe(cart.currency);
    expect(item.lineTotal.amount).toBe(item.unitPrice.amount * item.quantity);
  }
  const subtotal = cart.items.reduce((sum, item) => sum + item.lineTotal.amount, 0);
  const discount = cart.discounts.reduce((sum, applied) => sum + applied.amount.amount, 0);
  expect(cart.totals.subtotal.amount).toBe(subtotal);
  expect(cart.totals.discount.amount).toBe(discount);
  expect(cart.totals.total.amount).toBe(subtotal - discount);
  expect(cart.totals.total.amount).toBeGreaterThanOrEqual(0);
  expect(cart.itemCount).toBe(cart.items.reduce((sum, item) => sum + item.quantity, 0));
}

/**
 * Registers the Store API contract suite with Vitest.
 *
 * The suite is data-agnostic: it discovers products through `GET /products`
 * and only needs the store to have at least one product that is in stock.
 *
 * @example
 * // store.contract.test.ts
 * import { defineContractTests } from '@agentic-shop/api-contract/contract-tests';
 * defineContractTests({ baseUrl: 'https://my-store.example/api' });
 */
export function defineContractTests(optionsInput: OptionsInput): void {
  describe('Store API contract', () => {
    let options: ContractTestOptions;
    let client: ContractClient;
    const catalogue: Product[] = [];
    let purchasable: { product: Product; variant: ProductVariant };

    const call = (
      operationId: OperationId,
      params: Record<string, string> = {},
      requestOptions?: RequestOptions,
    ) => {
      const route = ROUTES[operationId];
      return client.request(route.method, buildPath(route.path, params), requestOptions);
    };

    const createCart = async () => expectBody(await call('createCart'), 201, CartSchema);

    const createCartWithItem = async (quantity = 1) => {
      const cart = await createCart();
      const response = await call(
        'addCartItem',
        { id: cart.id },
        {
          body: {
            productId: purchasable.product.id,
            variantId: purchasable.variant.id,
            quantity,
          },
        },
      );
      return expectBody(response, 200, CartSchema);
    };

    beforeAll(async () => {
      options = typeof optionsInput === 'function' ? await optionsInput() : optionsInput;
      client = createContractClient(options);

      // Walk a few pages so the variant and stock tests can find suitable products.
      let cursor: string | undefined;
      for (let page = 0; page < DISCOVERY_PAGE_LIMIT; page += 1) {
        const response = await call('listProducts', {}, { query: { limit: 50, cursor } });
        const body = expectBody(response, 200, ProductListResponseSchema);
        catalogue.push(...body.items);
        if (!body.nextCursor) break;
        cursor = body.nextCursor;
      }

      const found = catalogue
        .flatMap((product) => product.variants.map((variant) => ({ product, variant })))
        .find(({ variant }) => variant.inStock);
      if (!found) {
        throw new Error(
          'The contract suite needs at least one product with an in-stock variant in GET /products.',
        );
      }
      purchasable = found;
    });

    describe('GET /products', () => {
      it('returns a page of products matching the schema', async () => {
        const body = expectBody(await call('listProducts'), 200, ProductListResponseSchema);
        expect(body.items.length).toBeGreaterThan(0);
        expect(body.items.length).toBeLessThanOrEqual(20);
      });

      it('respects limit and paginates with an opaque cursor', async (context) => {
        const first = expectBody(
          await call('listProducts', {}, { query: { limit: 1 } }),
          200,
          ProductListResponseSchema,
        );
        expect(first.items).toHaveLength(1);
        if (catalogue.length < 2) return context.skip();

        expect(first.nextCursor).toEqual(expect.any(String));
        const second = expectBody(
          await call('listProducts', {}, { query: { limit: 1, cursor: first.nextCursor! } }),
          200,
          ProductListResponseSchema,
        );
        expect(second.items).toHaveLength(1);
        expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
      });

      it('rejects out-of-range and malformed parameters', async () => {
        expectError(
          await call('listProducts', {}, { query: { limit: 0 } }),
          400,
          'validation_error',
        );
        expectError(
          await call('listProducts', {}, { query: { limit: 1000 } }),
          400,
          'validation_error',
        );
        expectError(
          await call('listProducts', {}, { query: { sort: 'not-a-sort' } }),
          400,
          'validation_error',
        );
        expectError(
          await call('listProducts', {}, { query: { minPrice: 'cheap' } }),
          400,
          'validation_error',
        );
      });

      it('filters by category', async () => {
        const category = purchasable.product.category;
        const body = expectBody(
          await call('listProducts', {}, { query: { category } }),
          200,
          ProductListResponseSchema,
        );
        expect(body.items.length).toBeGreaterThan(0);
        for (const item of body.items) expect(item.category).toBe(category);
      });

      it('filters by price range', async () => {
        const price = purchasable.product.price.amount;
        const body = expectBody(
          await call('listProducts', {}, { query: { minPrice: price, maxPrice: price } }),
          200,
          ProductListResponseSchema,
        );
        expect(body.items.length).toBeGreaterThan(0);
        for (const item of body.items) expect(item.price.amount).toBe(price);
      });

      it('filters by stock', async () => {
        const body = expectBody(
          await call('listProducts', {}, { query: { inStock: true } }),
          200,
          ProductListResponseSchema,
        );
        expect(body.items.length).toBeGreaterThan(0);
        for (const item of body.items) expect(item.inStock).toBe(true);
      });

      it('sorts by price in both directions', async () => {
        const ascending = expectBody(
          await call('listProducts', {}, { query: { sort: 'price_asc', limit: 50 } }),
          200,
          ProductListResponseSchema,
        ).items.map((item) => item.price.amount);
        expect(ascending).toEqual([...ascending].sort((a, b) => a - b));

        const descending = expectBody(
          await call('listProducts', {}, { query: { sort: 'price_desc', limit: 50 } }),
          200,
          ProductListResponseSchema,
        ).items.map((item) => item.price.amount);
        expect(descending).toEqual([...descending].sort((a, b) => b - a));
      });

      it('finds a product by a word from its title', async () => {
        const word = purchasable.product.title
          .split(/\s+/)
          .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ''))
          .sort((a, b) => b.length - a.length)[0];
        const body = expectBody(
          await call('listProducts', {}, { query: { query: word, limit: 50 } }),
          200,
          ProductListResponseSchema,
        );
        expect(body.items.length).toBeGreaterThan(0);
      });
    });

    describe('GET /products/{id}', () => {
      it('returns the product', async () => {
        const id = purchasable.product.id;
        const body = expectBody(await call('getProduct', { id }), 200, ProductSchema);
        expect(body.id).toBe(id);
      });

      it('returns 404 for an unknown id', async () => {
        expectError(await call('getProduct', { id: UNKNOWN_ID }), 404, 'not_found');
      });
    });

    describe('carts', () => {
      it('creates an empty cart with zero totals', async () => {
        const cart = await createCart();
        expect(cart.items).toEqual([]);
        expect(cart.discounts).toEqual([]);
        expect(cart.totals.total.amount).toBe(0);
        expectConsistentCart(cart);
      });

      it('returns a cart by id and 404 for an unknown one', async () => {
        const cart = await createCart();
        const fetched = expectBody(await call('getCart', { id: cart.id }), 200, CartSchema);
        expect(fetched.id).toBe(cart.id);
        expectError(await call('getCart', { id: UNKNOWN_ID }), 404, 'not_found');
      });

      it('adds an item and computes the totals', async () => {
        const cart = await createCartWithItem(2);
        expect(cart.items).toHaveLength(1);
        const item = cart.items[0]!;
        expect(item.productId).toBe(purchasable.product.id);
        expect(item.variantId).toBe(purchasable.variant.id);
        expect(item.quantity).toBe(2);
        expect(item.unitPrice).toEqual(purchasable.variant.price);
        expectConsistentCart(cart);

        const fetched = expectBody(await call('getCart', { id: cart.id }), 200, CartSchema);
        expect(fetched.items).toEqual(cart.items);
      });

      it('rejects invalid add-to-cart requests', async () => {
        const cart = await createCart();
        const productId = purchasable.product.id;
        const variantId = purchasable.variant.id;
        expectError(
          await call(
            'addCartItem',
            { id: cart.id },
            { body: { productId, variantId, quantity: 0 } },
          ),
          400,
          'validation_error',
        );
        expectError(
          await call('addCartItem', { id: cart.id }, { body: { quantity: 1 } }),
          400,
          'validation_error',
        );
        expectError(
          await call('addCartItem', { id: cart.id }, { body: { productId: UNKNOWN_ID } }),
          404,
          'not_found',
        );
        expectError(
          await call('addCartItem', { id: UNKNOWN_ID }, { body: { productId, variantId } }),
          404,
          'not_found',
        );
      });

      it('requires a variant when the product has several', async (context) => {
        const multi = catalogue.find((product) => product.variants.length > 1);
        if (!multi) return context.skip();
        const cart = await createCart();
        expectError(
          await call('addCartItem', { id: cart.id }, { body: { productId: multi.id } }),
          409,
          'variant_required',
        );
      });

      it('refuses to add an out-of-stock variant', async (context) => {
        const soldOut = catalogue
          .flatMap((product) => product.variants.map((variant) => ({ product, variant })))
          .find(({ variant }) => !variant.inStock);
        if (!soldOut) return context.skip();
        const cart = await createCart();
        expectError(
          await call(
            'addCartItem',
            { id: cart.id },
            { body: { productId: soldOut.product.id, variantId: soldOut.variant.id } },
          ),
          409,
          'out_of_stock',
        );
      });

      it('updates the quantity of a line', async () => {
        const cart = await createCartWithItem(1);
        const itemId = cart.items[0]!.id;
        const updated = expectBody(
          await call('updateCartItem', { id: cart.id, itemId }, { body: { quantity: 3 } }),
          200,
          CartSchema,
        );
        expect(updated.items[0]?.quantity).toBe(3);
        expectConsistentCart(updated);

        expectError(
          await call('updateCartItem', { id: cart.id, itemId }, { body: { quantity: 0 } }),
          400,
          'validation_error',
        );
        expectError(
          await call(
            'updateCartItem',
            { id: cart.id, itemId: UNKNOWN_ID },
            { body: { quantity: 1 } },
          ),
          404,
          'not_found',
        );
      });

      it('removes a line', async () => {
        const cart = await createCartWithItem(1);
        const itemId = cart.items[0]!.id;
        const updated = expectBody(
          await call('removeCartItem', { id: cart.id, itemId }),
          200,
          CartSchema,
        );
        expect(updated.items).toEqual([]);
        expectConsistentCart(updated);
        expectError(await call('removeCartItem', { id: cart.id, itemId }), 404, 'not_found');
      });
    });

    describe('POST /carts/{id}/discounts', () => {
      it('rejects an invalid code and leaves the cart unchanged', async () => {
        const cart = await createCartWithItem(1);
        const code = options.fixtures?.invalidDiscountCode ?? DEFAULT_INVALID_CODE;
        expectError(
          await call('applyDiscount', { id: cart.id }, { body: { code } }),
          422,
          'discount_invalid',
        );
        const after = expectBody(await call('getCart', { id: cart.id }), 200, CartSchema);
        expect(after.discounts).toEqual([]);
        expect(after.totals).toEqual(cart.totals);
      });

      it('rejects a malformed body and an unknown cart', async () => {
        const cart = await createCart();
        expectError(
          await call('applyDiscount', { id: cart.id }, { body: {} }),
          400,
          'validation_error',
        );
        expectError(
          await call('applyDiscount', { id: UNKNOWN_ID }, { body: { code: DEFAULT_INVALID_CODE } }),
          404,
          'not_found',
        );
      });

      it('applies a valid code and returns the updated totals', async (context) => {
        const code = options.fixtures?.validDiscountCode;
        if (!code) return context.skip();
        const cart = await createCartWithItem(1);
        const discounted = expectBody(
          await call('applyDiscount', { id: cart.id }, { body: { code } }),
          200,
          CartSchema,
        );
        expect(discounted.discounts).toHaveLength(1);
        expect(discounted.discounts[0]?.code.toLowerCase()).toBe(code.toLowerCase());
        expect(discounted.totals.discount.amount).toBeGreaterThan(0);
        expect(discounted.totals.total.amount).toBeLessThan(cart.totals.total.amount);
        expectConsistentCart(discounted);
      });
    });

    describe('GET /carts/{id}/checkout-url', () => {
      it('returns a checkout link for a cart with items', async () => {
        const cart = await createCartWithItem(1);
        const body = expectBody(
          await call('getCheckoutUrl', { id: cart.id }),
          200,
          CheckoutUrlResponseSchema,
        );
        expect(body.url).toMatch(/^https?:\/\//);
      });

      it('refuses an empty cart and an unknown cart', async () => {
        const cart = await createCart();
        expectError(await call('getCheckoutUrl', { id: cart.id }), 409, 'cart_empty');
        expectError(await call('getCheckoutUrl', { id: UNKNOWN_ID }), 404, 'not_found');
      });
    });

    describe('authentication', () => {
      it('rejects requests without the API key when one is configured', async (context) => {
        if (!options.apiKey) return context.skip();
        expectError(await call('listProducts', {}, { authenticated: false }), 401, 'unauthorized');
      });
    });
  });
}
