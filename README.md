# Agentic Shopping Assistant

An embeddable chat widget whose AI agent performs store actions (search, filter, compare, cart, discounts) through tool calls against a store-provided REST API.

> **Status:** Phase 5 of 6 (demo store and end-to-end tests). Everything works end to end: store API contract, mock store, agent, chat server, widget and a demo storefront. Open-source polish (full README, contribution docs, licence) is next.

## Requirements

- Node.js 20.19 or newer
- pnpm 9 or newer
- A model provider: Anthropic (default), Google Gemini or Groq with an API key, or a local model through Ollama with no key

## Quick start

```bash
pnpm install
```

Copy `.env.example` to `.env`, choose `AI_PROVIDER`, and set `AI_MODEL` and that provider's key. Every other variable has a working default.

```bash
pnpm dev
```

This starts the mock store (`:4000`), the chat server (`:3001`), the demo storefront (`:3000`) and a widget playground (`:5173`). Open **http://localhost:3000** and click the chat button in the corner.

### No API key yet?

```bash
pnpm demo:scripted
```

This builds everything and serves the storefront on `http://localhost:3100` with **scripted replies instead of an AI model**. The agent's tools, the chat server and the store are all real, but the assistant only understands a few phrases ("show me headphones", "compare the aurora and pulse", "add the skillet", "apply code WELCOME10", "checkout"). It is what the end-to-end tests run against.

To talk to the chat server directly:

```bash
curl -s -X POST http://localhost:3001/api/sessions
```

```bash
curl -N -X POST http://localhost:3001/api/chat -H "content-type: application/json" -H "x-session-id: <sessionId from above>" -d '{"message":"wireless headphones under $150?"}'
```

## Scripts

| Command              | What it does                                                           |
| -------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`           | Run the mock store, chat server, demo storefront and widget playground |
| `pnpm demo:scripted` | Build and serve the demo with scripted replies (no API key)            |
| `pnpm e2e`           | Playwright end-to-end tests against the scripted demo                  |
| `pnpm build`         | Build all packages and apps                                            |
| `pnpm test`          | Unit, integration and contract tests (no network, no API key)          |
| `pnpm lint`          | ESLint                                                                 |
| `pnpm typecheck`     | TypeScript in strict mode                                              |
| `pnpm contract:test` | Run the contract suite against `STORE_API_BASE_URL` (any store)        |
| `pnpm eval:live`     | Run agent scenarios against the real model in `.env` (uses tokens)     |

## Repository layout

```
apps/demo-store          Next.js storefront that embeds the widget; Playwright end-to-end tests
apps/mock-store-api      Reference implementation of the Store API contract
packages/api-contract    Zod schemas, generated OpenAPI 3.1 spec, contract tests
packages/adapters        StoreAdapter interface, REST adapter, Shopify/WooCommerce stubs
packages/agent-core      System prompt, tool definitions and guardrails
packages/server          Streaming chat endpoint, sessions, rate limiting, CORS
packages/widget          Embeddable chat widget: script tag bundle and React component
docs/                    architecture.md, api-contract.md, embedding.md, security.md
```

## Licence

MIT
