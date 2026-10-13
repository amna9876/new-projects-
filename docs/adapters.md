# Connecting a store

The assistant works with any store that can answer nine requests: search products, get a product, create and read a cart, add, update and remove cart items, apply a discount code, and return a checkout link. There are two ways to provide them.

## Option 1: implement the contract over HTTP

Use this when your store has its own backend, in any language.

1. Add the nine endpoints described in [api-contract.md](./api-contract.md) (or the [OpenAPI spec](../packages/api-contract/openapi/openapi.yaml)).
2. Prove they are correct with the contract test suite:

   ```bash
   STORE_API_BASE_URL=https://your-store.example/api pnpm contract:test
   ```

3. Point the chat server at your store by setting `STORE_API_BASE_URL` (and `STORE_API_KEY` if you require one).

Nothing else is needed. The built-in REST adapter does the rest.

## Option 2: write a store adapter

Use this when you would rather call a platform SDK directly from TypeScript than expose new HTTP endpoints.

An adapter is an object that implements `StoreAdapter` from `@agentic-shop/adapters`:

```ts
import { StoreApiError, type StoreAdapter } from '@agentic-shop/adapters';

export function createMyStoreAdapter(client: MyStoreClient): StoreAdapter {
  return {
    name: 'my-store',

    async searchProducts(params) {
      const result = await client.products.search(params);
      return { items: result.products.map(toContractProduct), nextCursor: result.next ?? null };
    },

    async addCartItem(cartId, item) {
      const product = await client.products.get(item.productId);
      if (product.variants.length > 1 && !item.variantId) {
        throw new StoreApiError(409, 'variant_required', 'Choose an option first.');
      }
      return toContractCart(await client.carts.add(cartId, item));
    },

    // getProduct, createCart, getCart, updateCartItem, removeCartItem,
    // applyDiscount, getCheckoutUrl
  };
}
```

Then pass it to the chat server:

```ts
import { createServer } from '@agentic-shop/server';

const app = createServer({
  store: createMyStoreAdapter(client),
  model,
  allowedOrigins,
  rateLimitPerMinute,
});
```

### Rules for an adapter

- **Return contract-shaped objects.** The Zod schemas in `@agentic-shop/api-contract` are the reference; parse your output with them in your tests.
- **Money is an integer.** `{ amount: 1999, currency: 'USD' }` means $19.99. Amounts are in the currency's minor unit, never a float.
- **The store computes every total.** Subtotals, discounts and totals must come from your platform. The agent only reports what you return.
- **Use the two error types.**
  - `StoreApiError` for refusals a shopper should hear about: `not_found`, `out_of_stock`, `variant_required`, `discount_invalid`, `discount_expired`, `discount_min_not_met`, `cart_empty`. Its message is shown to the shopper, so write it for them.
  - `StoreUnavailableError` for everything else (network failures, timeouts, unexpected responses). The shopper sees a generic message and no internal detail.
- **Require a variant when there is a choice.** If a product has several variants and none was given, throw `variant_required`. The agent then asks the shopper which one they want.

### Existing adapters

| Adapter       | Status | Notes                                                                  |
| ------------- | ------ | ---------------------------------------------------------------------- |
| `rest`        | Ready  | Any store that implements the contract over HTTP                       |
| `mock`        | Ready  | The `rest` adapter preconfigured for the bundled mock store            |
| `shopify`     | Stub   | `packages/adapters/src/shopify.ts` sketches the Storefront API mapping |
| `woocommerce` | Stub   | `packages/adapters/src/woocommerce.ts` sketches the Store API mapping  |

Contributions that turn a stub into a working adapter are very welcome.
