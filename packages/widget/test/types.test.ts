// @vitest-environment node
import { createRestAdapter } from '@agentic-shop/adapters';
import {
  buildComparison,
  detailProduct,
  summariseProduct,
  viewCart,
  type CartView as AgentCartView,
  type ProductComparison as AgentComparison,
  type ProductDetail as AgentDetail,
  type ProductSummary as AgentSummary,
} from '@agentic-shop/agent-core';
import { createMockStoreFetch, IN_PROCESS_BASE_URL } from '@agentic-shop/mock-store-api';
import { describe, expect, it } from 'vitest';
import { isCartView, isProductComparison, isProductDetail, isProductSummary } from '../src/guards';
import type { CartView, ProductComparison, ProductDetail, ProductSummary } from '../src/types';

/**
 * The widget declares its own copies of the agent's result shapes so that it
 * ships without the agent. These assignments stop compiling if the agent's
 * shapes change in a way the widget's do not follow.
 */
const _summary: ProductSummary = {} as AgentSummary;
const _detail: ProductDetail = {} as AgentDetail;
const _comparison: ProductComparison = {} as AgentComparison;
const _cart: CartView = {} as AgentCartView;
void [_summary, _detail, _comparison, _cart];

describe('widget guards accept what the agent really produces', () => {
  const store = createRestAdapter({ baseUrl: IN_PROCESS_BASE_URL, fetch: createMockStoreFetch() });

  it('accepts every product in the catalogue, as a summary and in detail', async () => {
    const { items } = await store.searchProducts({ limit: 50 });
    expect(items.length).toBeGreaterThanOrEqual(30);
    for (const product of items) {
      expect(isProductSummary(summariseProduct(product)), product.id).toBe(true);
      expect(isProductDetail(detailProduct(product)), product.id).toBe(true);
    }
    expect(isProductComparison(buildComparison(items.slice(0, 4)))).toBe(true);
  });

  it('accepts empty, filled and discounted carts', async () => {
    const cart = await store.createCart();
    expect(isCartView(viewCart(cart))).toBe(true);

    await store.addCartItem(cart.id, { productId: 'ember-cast-iron-skillet', quantity: 2 });
    const discounted = await store.applyDiscount(cart.id, 'WELCOME10');
    expect(isCartView(viewCart(discounted))).toBe(true);
  });

  it('rejects shapes that are close but wrong', () => {
    const valid = { productId: 'p', title: 't', category: 'c', inStock: true, variantCount: 1 };
    expect(isProductSummary({ ...valid, price: { amount: 100, currency: 'USD' } })).toBe(true);
    expect(isProductSummary({ ...valid, price: { amount: 1.5, currency: 'USD' } })).toBe(false);
    expect(isProductSummary({ ...valid, price: { amount: '100', currency: 'USD' } })).toBe(false);
    expect(isProductSummary({ ...valid, price: 100 })).toBe(false);
    expect(isProductSummary(null)).toBe(false);
    expect(isProductComparison({ products: [], rows: [{ values: [1] }] })).toBe(false);
  });
});
