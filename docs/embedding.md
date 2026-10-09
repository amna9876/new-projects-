# Embedding the widget

The widget is a floating button that opens a chat panel. It talks to your chat server (`packages/server`), which in turn talks to your store. There are two ways to add it to a page.

## 1. Script tag

Build the widget, host `packages/widget/dist/widget.js` with your site's static files, and add:

```html
<script src="/widget.js" data-store-id="demo" data-api-url="https://your-server" async></script>
```

That is all. The script reads its own `data-*` attributes and mounts itself. It bundles everything it needs (about 76 kB gzipped) and does not require React on your page.

Remember to add your site's origin to `ALLOWED_ORIGINS` on the chat server, or the browser will be refused.

### Attributes

| Attribute            | Purpose                                                                    | Default                  |
| -------------------- | -------------------------------------------------------------------------- | ------------------------ |
| `data-api-url`       | Base URL of the chat server. **Required.**                                 |                          |
| `data-store-id`      | Namespaces the saved conversation, so two stores on one origin stay apart  | `default`                |
| `data-primary-color` | Brand colour as a hex value (`#0f766e`). Text on it is chosen for contrast | `#2563eb`                |
| `data-position`      | `bottom-right` or `bottom-left`. Mirrored in right-to-left languages       | `bottom-right`           |
| `data-greeting`      | First message shown in the panel                                           | Built-in greeting        |
| `data-language`      | UI language (BCP 47 tag such as `en` or `ar`)                              | `<html lang>`, else `en` |

### Mounting it yourself

If you load the script some other way (a tag manager, a consent tool), call the global it exposes:

```html
<script src="/widget.js"></script>
<script>
  const widget = AgenticShopWidget.mount({
    apiUrl: 'https://your-server',
    storeId: 'demo',
    language: 'en',
  });
  // widget.unmount() removes it again.
</script>
```

## 2. React component

```tsx
import { ShoppingAssistant } from '@agentic-shop/widget';

export function Layout() {
  return (
    <>
      {/* your page */}
      <ShoppingAssistant apiUrl="https://your-server" storeId="demo" primaryColor="#0f766e" />
    </>
  );
}
```

React 18 or 19 is a peer dependency. The component renders into its own Shadow DOM, so it needs the browser: in Next.js, use it from a client component.

Props mirror the attributes above (`apiUrl`, `storeId`, `primaryColor`, `position`, `greeting`, `language`), plus `strings` to override individual UI texts and `defaultOpen`.

## Theming

The widget lives in a Shadow DOM: your CSS cannot break it and its CSS cannot leak into your page. To restyle it, set CSS variables on the host element from your own stylesheet:

```css
[data-agentic-shop-widget] {
  --asa-primary: #0f766e; /* buttons, header, shopper bubbles */
  --asa-on-primary: #ffffff; /* text on the primary colour */
  --asa-bg: #ffffff; /* panel background */
  --asa-surface: #f3f4f6; /* assistant bubbles, table header */
  --asa-text: #111827;
  --asa-muted: #4b5563;
  --asa-border: #d1d5db;
  --asa-radius: 14px;
  --asa-font: 'Inter', system-ui, sans-serif;
  --asa-offset: 20px; /* distance from the screen edges */
  --asa-z: 2147483000;
}
```

`data-primary-color` sets `--asa-primary` and picks `--asa-on-primary` for you. If you set `--asa-primary` yourself, check that your `--asa-on-primary` has enough contrast.

## Languages and right-to-left

English and Arabic strings are bundled. Direction follows the language: Arabic, Hebrew, Persian, Urdu and other right-to-left languages flip the layout, including which side the launcher sits on. A language without bundled strings shows English text in the correct direction.

To add or change texts without rebuilding, pass `strings`:

```tsx
<ShoppingAssistant apiUrl="…" language="ur" strings={{ title: 'خریداری معاون', send: 'بھیجیں' }} />
```

To bundle a language, add it to `LANGUAGES` in `packages/widget/src/i18n/index.ts`. The assistant's replies are written by the model, which answers in the shopper's language regardless of the UI language.

## What the widget does

- **Streams** the assistant's reply as it is written, with a typing indicator before the first word.
- **Product cards** for search results, with image, price, sale price, rating and an add-to-cart button.
- **Comparison table** for side-by-side comparisons; rows where the products differ are emphasised.
- **Live cart**: a badge on the cart button and a drawer with the lines, discounts and totals from the store.
- **Variant buttons** when a product comes in several options and the assistant needs to know which.
- **Checkout button** that opens the store's own checkout. The widget never collects payment details.

Add-to-cart and variant buttons send an ordinary chat message on the shopper's behalf ("Add … to my cart"), so every cart change is visible in the conversation and passes through the same guardrails as typed requests.

The conversation is kept in `sessionStorage`: it survives navigation within your site and ends when the tab is closed. The server forgets a session after 30 minutes of inactivity; the widget then starts a fresh one and says so.

## Accessibility

- The launcher is a button with `aria-expanded`; the panel is a labelled dialog.
- Opening the panel moves focus to the message field. Escape closes it and returns focus to the launcher.
- New messages are announced through a polite live region; progress and typing use status roles.
- Every control is reachable by keyboard, has a visible focus ring and is at least 40 px tall.
- Animations are disabled when the visitor prefers reduced motion.
- At 480 px and below the panel fills the screen; the layout is verified down to 360 px.

## Security properties

- Store text (titles, descriptions, anything the assistant repeats) is rendered as text, never as HTML. In replies only `**bold**` and line breaks are interpreted; links and markup stay literal.
- The only link the widget ever renders is the checkout button, taken from the tool result and limited to `http`/`https`.
- Image URLs are limited to `http`/`https`; anything else shows a placeholder.
- Tool results are shape-checked before rendering. A malformed result renders nothing.
- `data-primary-color` accepts only a hex colour, so an attribute cannot inject CSS.

## Developing the widget

```bash
pnpm dev
```

This starts the mock store, the chat server and a playground at `http://localhost:5173` with the widget mounted on a page whose own CSS is deliberately hostile. Try `?lang=ar`, `?position=bottom-left` and `?color=%230f766e`.

The build fails if `widget.js` grows past the gzip budget in `packages/widget/package.json`.
