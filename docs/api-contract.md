# Store API contract

The shopping agent never talks to a store's database or internals. It calls a small REST API that the store provides. This document describes that API and how to prove that your implementation of it is correct.

- **Source of truth:** the Zod schemas in [`packages/api-contract/src/schemas`](../packages/api-contract/src/schemas).
- **OpenAPI 3.1:** [`packages/api-contract/openapi/openapi.yaml`](../packages/api-contract/openapi/openapi.yaml), generated from those schemas. Never edit it by hand; run `pnpm --filter @agentic-shop/api-contract openapi:generate`.
- **Reference implementation:** [`apps/mock-store-api`](../apps/mock-store-api).

## Principles

1. **The store computes, the agent reports.** Prices, stock, discounts and totals always come from the store. Every cart mutation returns the full cart with fresh totals so the agent never has to do arithmetic.
2. **Money is an integer.** `{ "amount": 1999, "currency": "USD" }` means $19.99. Amounts are in the currency's minor unit and are never floats.
3. **Errors are machine-readable.** Every non-2xx response has the same envelope and a `code` from a fixed list, so the agent can turn it into a helpful message.
4. **The agent never handles payment.** It hands the shopper a checkout link and stops there.

## Endpoints

| Method   | Path                         | Purpose                                    | Success       |
| -------- | ---------------------------- | ------------------------------------------ | ------------- |
| `GET`    | `/products`                  | Search and filter products                 | `200` page    |
| `GET`    | `/products/{id}`             | One product                                | `200` product |
| `POST`   | `/carts`                     | Create an empty cart (body optional)       | `201` cart    |
| `GET`    | `/carts/{id}`                | Read a cart                                | `200` cart    |
| `POST`   | `/carts/{id}/items`          | Add `{ productId, variantId?, quantity? }` | `200` cart    |
| `PATCH`  | `/carts/{id}/items/{itemId}` | Set `{ quantity }` (1 to 99)               | `200` cart    |
| `DELETE` | `/carts/{id}/items/{itemId}` | Remove a line                              | `200` cart    |
| `POST`   | `/carts/{id}/discounts`      | Apply `{ code }`                           | `200` cart    |
| `GET`    | `/carts/{id}/checkout-url`   | Checkout hand-off link                     | `200` link    |

### `GET /products` query parameters

| Parameter  | Type                                                        | Default     | Notes                                           |
| ---------- | ----------------------------------------------------------- | ----------- | ----------------------------------------------- |
| `query`    | string                                                      |             | Free-text search                                |
| `category` | string                                                      |             | Exact category slug                             |
| `minPrice` | integer                                                     |             | Minor units, inclusive                          |
| `maxPrice` | integer                                                     |             | Minor units, inclusive                          |
| `inStock`  | `true` \| `false`                                           |             |                                                 |
| `sort`     | `relevance` `price_asc` `price_desc` `rating_desc` `newest` | `relevance` |                                                 |
| `limit`    | integer, 1 to 50                                            | `20`        |                                                 |
| `cursor`   | string                                                      |             | Opaque; use `nextCursor` from the previous page |

The response is `{ "items": Product[], "nextCursor": string | null }`.

## Data model

- **Product**: `id`, `title`, `description`, `category`, `images[]`, `price`, `inStock`, flat `attributes` (used for side-by-side comparison) and at least one **variant**. Optional: `brand`, `compareAtPrice`, `rating`, `url`, `createdAt`.
- **Variant**: `id`, `title`, `options` (for example `{ "size": "M" }`), `price`, `inStock`. A product with a single variant can be added to a cart without naming it; a product with several requires `variantId`.
- **Cart**: `id`, `currency`, `items[]`, `itemCount`, `discounts[]`, `totals { subtotal, discount, total }`, `updatedAt`.

Stores may return extra fields; clients ignore what they do not know.

## Errors

```json
{ "error": { "code": "variant_required", "message": "…", "details": {} } }
```

| Status | `code`                                                       | When                                                  |
| ------ | ------------------------------------------------------------ | ----------------------------------------------------- |
| 400    | `validation_error`                                           | Malformed query, body or cursor                       |
| 401    | `unauthorized`                                               | The store requires an API key and it is missing/wrong |
| 404    | `not_found`                                                  | Unknown product, variant, cart or cart line           |
| 409    | `variant_required`                                           | Product has several variants and none was chosen      |
| 409    | `out_of_stock`                                               | The variant cannot be purchased                       |
| 409    | `cart_empty`                                                 | Checkout link requested for an empty cart             |
| 422    | `discount_invalid` `discount_expired` `discount_min_not_met` | The discount code was rejected                        |
| 429    | `rate_limited`                                               | Too many requests                                     |
| 500    | `internal_error`                                             | Anything else                                         |

`message` should be safe to show to a shopper.

## Authentication

Optional. If your store needs it, require `Authorization: Bearer <key>` and give the same key to the chat server as `STORE_API_KEY`.

## Verifying your implementation

The contract ships with a test suite that any store can run. It is data-agnostic: it discovers products through `GET /products`, validates every response against the schemas, checks the arithmetic of cart totals, and exercises the failure paths. Your store only needs **one product with an in-stock variant**.

### Against a running store

```bash
STORE_API_BASE_URL=https://your-store.example/api pnpm contract:test
```

Optional environment variables:

| Variable                       | Purpose                                                                 |
| ------------------------------ | ----------------------------------------------------------------------- |
| `STORE_API_KEY`                | Sent as a Bearer token; also enables the "missing key is rejected" test |
| `CONTRACT_VALID_DISCOUNT_CODE` | A code your store accepts; enables the "valid discount" test            |

### Inside your own test suite

```ts
import { defineContractTests } from '@agentic-shop/api-contract/contract-tests';

defineContractTests({
  baseUrl: 'http://localhost:8080',
  fixtures: { validDiscountCode: 'WELCOME10' },
});
```

Pass a custom `fetch` to call your app in-process, as the mock store does in [`apps/mock-store-api/test/contract.test.ts`](../apps/mock-store-api/test/contract.test.ts).

Tests that need data your store does not have (a product with several variants, an out-of-stock variant, a valid discount code) are reported as skipped, not failed.

## The mock store

`pnpm dev` starts it on `http://localhost:4000` with 36 products in six categories.

| Discount code | Behaviour                               |
| ------------- | --------------------------------------- |
| `WELCOME10`   | 10% off                                 |
| `SAVE20`      | $20 off a subtotal of $100 or more      |
| `EXPIRED`     | Always rejected with `discount_expired` |

Two products (`cedar-beard-oil` and `hydra-insulated-bottle`) carry prompt-injection text in their descriptions on purpose. They exist to test that the agent treats store data as untrusted.
