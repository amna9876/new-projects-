# Contributing

Thank you for considering a contribution. This guide covers how to get set up, what a change needs before it can be merged, and where things live.

## Setup

You need Node.js 20.19 or newer and pnpm 9 or newer.

```bash
pnpm install
```

```bash
pnpm demo:scripted
```

That builds everything and serves the demo on `http://localhost:3100` with scripted replies, so you can work on most of the project without an API key. To run against a real model, copy `.env.example` to `.env`, fill in a provider, and use `pnpm dev`.

## Before you open a pull request

Run these; CI runs the same commands.

```bash
pnpm format
```

```bash
pnpm lint
```

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm e2e
```

`pnpm e2e` needs a browser the first time: `pnpm --filter @agentic-shop/demo-store exec playwright install chromium`.

If you changed a schema in `packages/api-contract`, regenerate the OpenAPI spec and commit it:

```bash
pnpm --filter @agentic-shop/api-contract openapi:generate
```

## What a good change looks like

- **Small and focused.** One concern per pull request.
- **Tested.** New behaviour comes with a test; a bug fix comes with a test that fails without the fix.
- **Strict TypeScript.** No `any`, no `@ts-ignore`. If a rule gets in the way, say why in the pull request.
- **No hardcoded secrets or model names.** Configuration goes through environment variables, documented in `.env.example`.
- **Docs updated** when behaviour, configuration or the contract changes.

### Changes that need extra care

| Area                                | Why                                                  | What we look for                                                                   |
| ----------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/api-contract`             | Every store implementation depends on it             | Backwards compatible, contract tests updated, spec regenerated                     |
| `packages/agent-core` guardrails    | They are the safety boundary                         | A scripted scenario proving the rule holds when the model misbehaves               |
| `packages/agent-core` system prompt | Prompt-only rules cannot be proven by scripted tests | The pinned-rule tests still pass; ideally `pnpm eval:live` output before and after |
| `packages/widget` rendering         | It displays untrusted store text                     | Text only, never HTML; no new clickable links                                      |
| `packages/server`                   | It is exposed to the internet                        | Limits, error containment and CORS behaviour unchanged or tested                   |

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/), checked by a commit hook and in CI:

```
feat(widget): add a typing indicator
fix(server): return 429 before parsing the body
docs: explain adapter error mapping
test(agent-core): cover expired discount codes
chore(ci): cache playwright browsers
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`. The scope is the package or app name.

If your change affects a published package, add a changeset:

```bash
pnpm changeset
```

## Where things live

| Path                    | Responsibility                                               |
| ----------------------- | ------------------------------------------------------------ |
| `packages/api-contract` | The Store API contract: schemas, OpenAPI, contract tests     |
| `packages/adapters`     | `StoreAdapter` and its implementations                       |
| `packages/agent-core`   | System prompt, tools, guardrails                             |
| `packages/server`       | Chat endpoint, sessions, rate limiting                       |
| `packages/widget`       | The embeddable UI                                            |
| `apps/mock-store-api`   | Reference store used in development and tests                |
| `apps/demo-store`       | Demo storefront and end-to-end tests                         |
| `docs/`                 | Architecture, contract, embedding and security documentation |

Start with [docs/architecture.md](./docs/architecture.md). Looking for something to work on? See [docs/good-first-issues.md](./docs/good-first-issues.md).

## Reporting bugs and proposing features

Use the issue templates. For anything that could be a security problem, do not open a public issue; follow [SECURITY.md](./SECURITY.md).

## Licence

By contributing you agree that your contributions are licensed under the [MIT Licence](./LICENSE).
