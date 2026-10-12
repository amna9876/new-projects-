# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: on the repository page, open the **Security** tab and choose **Report a vulnerability**. That creates a private advisory visible only to the maintainers.

Include, as far as you can:

- what an attacker can achieve (for example "apply a discount the shopper never typed" or "read another session's cart");
- the steps or a minimal script to reproduce it;
- the commit or version you tested;
- whether it needs a particular model, store or configuration.

You can expect an acknowledgement within a week. Please give us reasonable time to fix the problem before disclosing it publicly; we will credit you in the advisory unless you prefer otherwise.

## Supported versions

The project is pre-1.0. Only the latest commit on `main` receives security fixes.

## What counts

In scope:

- Bypassing a code-level guardrail: cart ownership, discount-code provenance, the step cap, input limits.
- Getting the widget to render store or model text as HTML, or to show a clickable link other than the checkout button.
- Leaking secrets, other sessions' data or internal error details to a client or to the model.
- Bypassing rate limiting or the CORS origin check.
- Flaws in the contract test suite that let a non-compliant store pass in a way that breaks a guardrail.

Out of scope:

- A language model saying something wrong or being persuaded to break a **prompt-only** rule (for example adding an item the shopper did not clearly ask for). These are known limits of the approach, described in [docs/security.md](./docs/security.md). Reports are still welcome as ordinary issues, ideally with `pnpm eval:live` output.
- Vulnerabilities in a store's own API or in a model provider.
- Denial of service that requires more traffic than the configured rate limits allow from one client.
- The deliberately hostile product descriptions in the mock store's seed data.

## Design notes

How the system defends itself, and what it deliberately does not attempt, is documented in [docs/security.md](./docs/security.md).
