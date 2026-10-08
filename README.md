# Agentic Shopping Assistant

An embeddable chat widget whose AI agent performs store actions (search, filter, compare, cart, discounts) through tool calls against a store-provided REST API.

> **Status:** Phase 1 of 6 (foundation). The Store API contract, a reference mock store and the contract test suite are in place. The agent, chat server, widget and demo storefront follow in later phases.

## Requirements

- Node.js 20.19 or newer
- pnpm 9 or newer

## Quick start

```bash
pnpm install
```

```bash
pnpm dev
```

The mock store then listens on `http://localhost:4000` (try `/products?query=headphones`).

## Scripts

| Command              | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `pnpm dev`           | Run every app in watch mode                                     |
| `pnpm build`         | Build all packages and apps                                     |
| `pnpm test`          | Unit, integration and contract tests                            |
| `pnpm lint`          | ESLint                                                          |
| `pnpm typecheck`     | TypeScript in strict mode                                       |
| `pnpm contract:test` | Run the contract suite against `STORE_API_BASE_URL` (any store) |

## Repository layout

```
apps/mock-store-api      Reference implementation of the Store API contract
packages/api-contract    Zod schemas, generated OpenAPI 3.1 spec, contract tests
docs/                    Guides (start with docs/api-contract.md)
```

## Licence

MIT
