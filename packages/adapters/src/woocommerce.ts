import { createStubAdapter } from './stub';
import type { StoreAdapter } from './types';

export interface WooCommerceAdapterOptions {
  /** Base URL of the WordPress site, for example `https://shop.example`. */
  siteUrl: string;
}

/**
 * STUB: not implemented yet. Contributions welcome.
 *
 * Intended mapping onto the WooCommerce Store API (`/wp-json/wc/store/v1`):
 * - searchProducts / getProduct -> `GET /products` (`search`, `category`,
 *   `min_price`, `max_price`, `stock_status`, `orderby`) and `GET /products/{id}`.
 *   Prices already arrive in minor units (`currency_minor_unit`).
 * - carts -> `/cart`, `/cart/add-item`, `/cart/update-item`, `/cart/remove-item`.
 *   The cart is identified by the `Cart-Token` header, which becomes the cart id.
 * - applyDiscount -> `POST /cart/apply-coupon`; coupon errors map to `discount_*`.
 * - getCheckoutUrl -> the site's checkout page URL with the cart token.
 */
export function createWooCommerceAdapter(_options: WooCommerceAdapterOptions): StoreAdapter {
  return createStubAdapter('woocommerce');
}
