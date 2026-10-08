import type {
  Cart,
  CheckoutUrlResponse,
  Product,
  ProductListResponse,
  ProductSort,
} from '@agentic-shop/api-contract';

export interface ProductSearchParams {
  query?: string;
  category?: string;
  /** Minor units, inclusive. */
  minPrice?: number;
  /** Minor units, inclusive. */
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSort;
  limit?: number;
  cursor?: string;
}

export interface AddCartItemParams {
  productId: string;
  variantId?: string;
  quantity?: number;
}

/**
 * Everything the agent can do in a store. Implementations translate these
 * calls to a concrete platform and must return contract-shaped data.
 *
 * Failures are reported by throwing {@link StoreApiError} (the store said no)
 * or {@link StoreUnavailableError} (the store could not be reached or answered
 * with something that is not the contract).
 */
export interface StoreAdapter {
  /** Short identifier, for logs and diagnostics. */
  readonly name: string;
  searchProducts(params?: ProductSearchParams): Promise<ProductListResponse>;
  getProduct(productId: string): Promise<Product>;
  createCart(): Promise<Cart>;
  getCart(cartId: string): Promise<Cart>;
  addCartItem(cartId: string, item: AddCartItemParams): Promise<Cart>;
  updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart>;
  removeCartItem(cartId: string, itemId: string): Promise<Cart>;
  applyDiscount(cartId: string, code: string): Promise<Cart>;
  getCheckoutUrl(cartId: string): Promise<CheckoutUrlResponse>;
}
