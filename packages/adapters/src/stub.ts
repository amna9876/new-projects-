import { AdapterNotImplementedError } from './errors';
import type { StoreAdapter } from './types';

/** Builds an adapter whose every operation rejects with {@link AdapterNotImplementedError}. */
export function createStubAdapter(name: string): StoreAdapter {
  const reject = (operation: keyof StoreAdapter) => () =>
    Promise.reject(new AdapterNotImplementedError(name, operation));

  return {
    name,
    searchProducts: reject('searchProducts'),
    getProduct: reject('getProduct'),
    createCart: reject('createCart'),
    getCart: reject('getCart'),
    addCartItem: reject('addCartItem'),
    updateCartItem: reject('updateCartItem'),
    removeCartItem: reject('removeCartItem'),
    applyDiscount: reject('applyDiscount'),
    getCheckoutUrl: reject('getCheckoutUrl'),
  };
}
