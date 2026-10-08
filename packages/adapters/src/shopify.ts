import { createStubAdapter } from './stub';
import type { StoreAdapter } from './types';

export interface ShopifyAdapterOptions {
  /** For example `my-shop.myshopify.com`. */
  shopDomain: string;
  /** Storefront API access token. */
  storefrontAccessToken: string;
  apiVersion?: string;
}

/**
 * STUB: not implemented yet. Contributions welcome.
 *
 * Intended mapping onto the Shopify Storefront GraphQL API:
 * - searchProducts / getProduct -> `products(query:)` and `product(id:)`; map
 *   `variants.nodes` to contract variants and `MoneyV2` decimals to minor units.
 * - carts -> `cartCreate`, `cartLinesAdd`, `cartLinesUpdate`, `cartLinesRemove`.
 * - applyDiscount -> `cartDiscountCodesUpdate`; a code with `applicable: false`
 *   becomes a `discount_invalid` error.
 * - getCheckoutUrl -> `cart.checkoutUrl`.
 */
export function createShopifyAdapter(_options: ShopifyAdapterOptions): StoreAdapter {
  return createStubAdapter('shopify');
}
