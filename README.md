# Agentic Shopping Assistant

An embeddable chat widget whose AI agent performs store actions (search, filter, compare, cart, discounts) through tool calls against a store-provided REST API.

> **Status:** Phase 3 of 6 (chat server). The Store API contract, a reference mock store, store adapters, the agent and a streaming chat server are in place. The widget and demo storefront follow in later phases.

## Requirements

- Node.js 20.19 or newer
- pnpm 9 or newer
- An API key for a supported model provider (Anthropic by default)

## Quick start

```bash
pnpm install
```

Copy `.env.example` to `.env` and set `AI_MODEL` and `ANTHROPIC_API_KEY`. Every other variable has a working default.

```bash
pnpm dev
```

This starts the mock store on `http://localhost:4000` and the chat server on `http://localhost:3001`. To talk to the agent before the widget exists:

```bash
curl -s -X POST http://localhost:3001/api/sessions
```

```bash
curl -N -X POST http://localhost:3001/api/chat -H "content-type: application/json" -H "x-session-id: <sessionId from above>" -d '{"message":"wireless headphones under $150?"}'
```

## Scripts

| Command              | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `pnpm dev`           | Run the mock store and the chat server in watch mode               |
| `pnpm build`         | Build all packages and apps                                        |
| `pnpm test`          | Unit, integration and contract tests (no network, no API key)      |
| `pnpm lint`          | ESLint                                                             |
| `pnpm typecheck`     | TypeScript in strict mode                                          |
| `pnpm contract:test` | Run the contract suite against `STORE_API_BASE_URL` (any store)    |
| `pnpm eval:live`     | Run agent scenarios against the real model in `.env` (uses tokens) |

## Repository layout

```
apps/mock-store-api      Reference implementation of the Store API contract
packages/api-contract    Zod schemas, generated OpenAPI 3.1 spec, contract tests
packages/adapters        StoreAdapter interface, REST adapter, Shopify/WooCommerce stubs
packages/agent-core      System prompt, tool definitions and guardrails
packages/server          Streaming chat endpoint, sessions, rate limiting, CORS
docs/                    architecture.md, api-contract.md, security.md
```

## Licence

MIT
