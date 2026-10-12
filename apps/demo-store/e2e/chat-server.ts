/**
 * A chat server with a scripted "model", for end-to-end tests and for trying
 * the demo without an API key. The agent, its tools, the guardrails, the chat
 * server and the store are all real; only the model's decisions are rules.
 *
 * It understands a handful of phrases (see `decide` below). It is NOT an AI.
 */
import { createRestAdapter } from '@agentic-shop/adapters';
import { createServer } from '@agentic-shop/server';
import { scriptedModel, type ScriptStep } from '@agentic-shop/server/testing';
import { serve } from '@hono/node-server';

interface PromptPart {
  type: string;
  text?: string;
  toolName?: string;
  output?: unknown;
}

interface PromptMessage {
  role: string;
  content: string | PromptPart[];
}

const KNOWN_PRODUCTS: [keyword: string, productId: string][] = [
  ['aurora', 'aurora-anc-headphones'],
  ['pulse', 'pulse-studio-headphones'],
  ['skillet', 'ember-cast-iron-skillet'],
  ['kettle', 'brewmaster-pour-over-kettle'],
  ['tent', 'basecamp-2p-tent'],
];

const SEARCH_WORDS = /\b(headphones|shoes|boots|jacket|tent|kettle|skillet|sunscreen|bottle)\b/;

const HELP_TEXT =
  'This demo runs on scripted replies, not a real AI. Try "show me headphones", ' +
  '"compare the aurora and pulse", "add the skillet", "apply code WELCOME10" or "checkout".';

const textOf = (message: PromptMessage) =>
  typeof message.content === 'string'
    ? message.content
    : message.content.map((part) => part.text ?? '').join(' ');

const call = (tool: string, input: unknown): ScriptStep => ({ calls: [{ tool, input }] });

/** What the model "says" after a tool has run. */
function afterTool(message: PromptMessage): ScriptStep {
  const part = typeof message.content === 'string' ? undefined : message.content[0];
  const ok = JSON.stringify(part?.output ?? '').includes('"ok":true');
  switch (part?.toolName) {
    case 'searchProducts':
      return { text: ok ? 'Here is what I found.' : 'I could not search the store just now.' };
    case 'compareProducts':
      return { text: 'Here they are side by side. The **bold** rows are where they differ.' };
    case 'addToCart':
      return { text: ok ? 'Added to your cart.' : 'Which option would you like?' };
    case 'applyDiscountCode':
      return { text: ok ? 'Your code is applied.' : 'Sorry, that code did not work.' };
    case 'getCheckoutLink':
      return {
        text: ok
          ? 'Here is your checkout link.'
          : 'Your cart is empty, so there is nothing to check out yet.',
      };
    case 'viewCart':
      return { text: 'Here is your cart.' };
    default:
      return { text: 'Done.' };
  }
}

/** What the model "decides" to do with a shopper message. */
function decide(said: string): ScriptStep {
  const lower = said.toLowerCase();
  const products = KNOWN_PRODUCTS.filter(([keyword]) => lower.includes(keyword));

  if (lower.includes('compare')) {
    const ids =
      products.length >= 2
        ? products.map(([, id]) => id)
        : ['aurora-anc-headphones', 'pulse-studio-headphones'];
    return call('compareProducts', { productIds: ids.slice(0, 4) });
  }

  const [firstProduct] = products;
  if (lower.includes('add') && firstProduct) {
    const productId = firstProduct[1];
    // The widget's variant buttons send: Add "Title" (Variant) to my cart.
    const variant = /\(([^)]+)\)/.exec(said)?.[1];
    const variantId = variant
      ? `${productId}-${variant.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      : undefined;
    return call('addToCart', { productId, ...(variantId ? { variantId } : {}) });
  }

  const code = /\bcode\s+([A-Za-z0-9_-]{3,})/i.exec(said)?.[1];
  if (code) return call('applyDiscountCode', { code });

  if (lower.includes('checkout') || lower.includes('check out') || lower.includes('pay')) {
    return call('getCheckoutLink', {});
  }
  if (lower.includes('cart')) return call('viewCart', {});
  if (lower.includes('best-rated') || lower.includes('best rated')) {
    return call('searchProducts', { sort: 'rating_desc' });
  }

  const query = SEARCH_WORDS.exec(lower)?.[1];
  if (query) return call('searchProducts', { query });
  if (lower.includes('gift') || lower.includes('under $50')) {
    return call('searchProducts', { maxPrice: 5000, inStock: true, sort: 'rating_desc' });
  }
  return { text: HELP_TEXT };
}

const port = Number(process.env.PORT ?? 3001);

const app = createServer({
  model: scriptedModel((_step, prompt) => {
    const last = (prompt as PromptMessage[]).at(-1);
    if (!last) return { text: 'Hello!' };
    return last.role === 'tool' ? afterTool(last) : decide(textOf(last));
  }),
  store: createRestAdapter({ baseUrl: process.env.STORE_API_BASE_URL ?? 'http://localhost:4000' }),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
  rateLimitPerMinute: 600,
  agentConfig: { storeName: 'Larkspur Supply' },
});

serve({ fetch: app.fetch, port }, () => {
  console.log(`scripted chat server (no AI) listening on http://localhost:${port}`);
});
