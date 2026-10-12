## What and why

<!-- What does this change, and what problem does it solve? Link the issue if there is one. -->

## How it was tested

<!-- Which tests cover it? For UI changes, add a screenshot or a short description of what you checked. -->

## Checklist

- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass
- [ ] `pnpm e2e` passes (for widget, server, agent or storefront changes)
- [ ] New behaviour has a test; a bug fix has a test that fails without the fix
- [ ] Docs and `.env.example` are updated if behaviour or configuration changed
- [ ] Commit messages follow Conventional Commits

## Sensitive areas

<!-- Tick what applies and say how you handled it. Delete the section if none apply. -->

- [ ] **Contract** (`packages/api-contract`): backwards compatible, contract tests updated, OpenAPI spec regenerated
- [ ] **Guardrails or tools** (`packages/agent-core`): a scripted scenario proves the rule holds when the model misbehaves
- [ ] **System prompt**: pinned-rule tests still pass; `pnpm eval:live` compared before and after
- [ ] **Widget rendering**: store and model text is still rendered as text only, with no new links
