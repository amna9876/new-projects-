# Good first issues

Five well-scoped tasks for a first contribution. Each lists where to look, what "done" means and how to test it. Copy one into a GitHub issue with the `good first issue` label when you start on it.

## 1. Bundle Urdu (or another language) in the widget

**Why:** the widget ships English and Arabic strings. Any right-to-left language already gets the right layout, but shows English text.

**Where:** `packages/widget/src/i18n/index.ts`

**Done when:**

- A new entry in `LANGUAGES` translates every key (TypeScript enforces completeness through the `Strings` type).
- A test in `packages/widget/test/widget.test.tsx` renders the widget in that language and checks the direction and two or three strings.
- `docs/embedding.md` lists the language.

**Size:** small. No logic changes.

## 2. Add a "clear conversation" button to the widget

**Why:** a shopper cannot start over without closing the tab.

**Where:** `packages/widget/src/chat/client.ts` (a `reset()` method that clears messages, cart and session id and removes the saved state), `packages/widget/src/components/Widget.tsx` (a header button), `packages/widget/src/i18n/index.ts` (its label).

**Done when:**

- The button is keyboard reachable, has an accessible name and is disabled while an answer is streaming.
- After a reset, the next message creates a new server session (assert on the requests in `test/client.test.ts`).
- The starter suggestions come back.

**Size:** small to medium.

## 3. Add a `sale` filter to the Store API contract

**Why:** "what's on sale?" is a common question, and the agent can only approximate it today.

**Where:** `packages/api-contract/src/schemas/product.ts` (an optional `onSale` query parameter), `apps/mock-store-api/src/store.ts` (filter on `compareAtPrice`), `packages/agent-core/src/tools/catalogue.ts` (expose it on `searchProducts`), `packages/adapters/src/types.ts`.

**Done when:**

- The contract test suite covers the new parameter and stays data-agnostic: it must pass for a store with no sale items.
- The OpenAPI spec is regenerated and committed.
- A scripted scenario in `packages/agent-core/test/scenarios.test.ts` uses it.
- `docs/api-contract.md` documents it.

**Size:** medium. A good tour of how a contract change flows through every layer.

## 4. Show a per-line remove button in the cart drawer

**Why:** removing an item means typing a message.

**Where:** `packages/widget/src/results/CartSummary.tsx`

**Done when:**

- Each line has a remove button that sends a chat message as the shopper (for example `Remove "Ember 10" Cast Iron Skillet" from my cart.`), the same way add-to-cart works. Do **not** call the store directly: every cart change goes through the agent and its guardrails.
- The button has an accessible name that includes the product title, and is disabled while busy.
- Tests cover the message that is sent, and an end-to-end test in `apps/demo-store/e2e/flows.spec.ts` removes an item.

**Size:** small to medium.

## 5. Add a Redis-backed rate limiter

**Why:** the built-in limiter is per process, so several server instances each allow the full limit.

**Where:** `packages/server/src/rate-limit.ts` defines the one-method `RateLimiter` interface. Add an implementation next to it and let `createServer` accept limiters through its options.

**Done when:**

- The implementation uses an atomic sliding-window (a sorted set with a Lua script, or `MULTI`) so concurrent requests cannot both slip under the limit.
- The existing limiter tests are turned into a shared suite that runs against both implementations (use a fake or an in-memory Redis for CI; do not require a real server).
- `REDIS_URL` is documented in `.env.example` and `docs/security.md`; with it unset, behaviour is unchanged.

**Size:** medium to large. Coordinate in an issue first.
