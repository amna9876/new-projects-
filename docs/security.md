# Security notes

This document describes what the chat server and the agent protect against, how, and what is deliberately out of scope. For how to report a vulnerability, see `SECURITY.md` (added with the open-source polish phase).

## Trust boundaries

| Source                                    | Trusted?     | Handling                                                                                                      |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| Operator configuration (`.env`)           | yes          | Validated at start-up; the server refuses to start when it is incomplete.                                     |
| The shopper's messages                    | as a shopper | They can ask the agent to act on their own cart. Length-limited and rate-limited.                             |
| Anything else a browser sends             | no           | The server accepts `{ message }` and a session id. History, roles and tool results from a client are ignored. |
| Store data (titles, descriptions, errors) | no           | Reported to the shopper as data. Never treated as instructions; see below.                                    |
| The model's decisions                     | no           | Every tool validates its input and enforces its own rules, whatever the model asks for.                       |

## Prompt injection through store data

Product text is written by merchants, suppliers and sometimes customers, so it can contain instructions aimed at the model. The seed catalogue contains two such products on purpose.

Defences, strongest first:

1. **Capability limits.** The agent has nine tools and nothing else. It cannot browse, send messages, read other carts, change prices or take payment, so there is little for injected text to gain.
2. **Code-level checks on the valuable actions.** `applyDiscountCode` only accepts a code that appears in a message the shopper wrote, checked against history the server recorded. Injected text cannot cause a discount to be applied even if the model is fully fooled.
3. **Marked data.** Every tool result carries a notice that its `data` is untrusted, and long descriptions are clipped.
4. **The system prompt** tells the model to treat tool results as data and to act only on the shopper's own words.

What remains: a fooled model could still _say_ something untrue (for example repeat a false claim from a description) or add an item the shopper did not ask for. The first cannot charge anyone, because checkout happens on the store with the store's own prices. The second is visible in the cart before payment. `pnpm eval:live` measures how a real model behaves on these cases.

## Sessions

- A session id is 192 random bits from the operating system's CSPRNG and is the only credential for a conversation and its cart. Treat it like a cookie value: send it only over HTTPS in production.
- It is sent in the `x-session-id` header, not a cookie, so the API is not exposed to cross-site request forgery.
- Sessions expire after 30 minutes without activity and live in memory. Restarting the server ends all conversations.
- The cart id never leaves the server as a tool input: no tool accepts one, so the model cannot be talked into touching another shopper's cart.
- One turn at a time per session; a second message while one is streaming gets `409 busy`.

## Rate limiting

`RATE_LIMIT_PER_MINUTE` is enforced twice, with an exact sliding window: per client IP on every `/api` request (including session creation), and per session on chat messages. Over the limit, the server answers `429` with `Retry-After`.

`X-Forwarded-For` is ignored unless `TRUST_PROXY=true`. Enable that only behind a proxy you control that overwrites the header; otherwise any client could pick its own "IP".

The limiter is in memory and per process. If you run several instances, put a shared limiter (or your gateway's) in front; `RateLimiter` is a one-method interface for that purpose.

Each turn is also bounded: at most `maxSteps` model calls (default 8), a 2,000-character message, a 16 KB body, and the 12 most recent turns of history.

## CORS

Only the exact origins in `ALLOWED_ORIGINS` receive CORS headers, and a request that carries any other `Origin` is rejected with `403` before it reaches a handler. A wildcard is refused at start-up. CORS is a browser control, not authentication: a non-browser client can still call the API, which is why rate limiting does not depend on it.

## Secrets and errors

- The provider key and the store key are read from the environment, held in memory and never logged, returned or placed in a prompt. Configuration errors name the variable and never print a value.
- When a turn fails, the client receives one fixed sentence. The server log records the kind of error (its class name and HTTP status), not its message, the conversation or any payload.
- Store infrastructure failures (network, timeout, 5xx, auth, malformed responses) are collapsed into one generic tool result, so hostnames and stack traces never reach the model either.

## Payments

The agent has no payment tool. `getCheckoutLink` returns the store's own URL and the shopper pays there. Do not add tools that accept card data.

## Out of scope today

- Authentication of shoppers (the session is anonymous).
- Persistence, multi-instance session sharing and distributed rate limiting.
- Content moderation of shopper messages beyond what the model provider applies.
- Abuse that stays within the limits, such as many IPs each sending a few messages. Put a gateway or bot protection in front for public deployments, and set a spending limit with your model provider.
