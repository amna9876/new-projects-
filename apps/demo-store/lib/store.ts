import { createRestAdapter, StoreApiError } from '@agentic-shop/adapters';
import type { Product } from '@agentic-shop/api-contract';

/** Display names for the demo catalogue's category slugs. */
export const CATEGORIES: Record<string, string> = {
  electronics: 'Electronics',
  apparel: 'Apparel',
  footwear: 'Footwear',
  'home-kitchen': 'Home & Kitchen',
  beauty: 'Beauty',
  'sports-outdoors': 'Sports & Outdoors',
};

export const categoryName = (slug: string) => CATEGORIES[slug] ?? slug;

/**
 * The storefront reads its catalogue from the same Store API the agent uses.
 * Read at request time so one build works against any store.
 */
function store() {
  return createRestAdapter({
    baseUrl: process.env.STORE_API_BASE_URL ?? 'http://localhost:4000',
    apiKey: process.env.STORE_API_KEY?.trim() ? process.env.STORE_API_KEY.trim() : undefined,
  });
}

export async function listProducts(filters: { category?: string; query?: string }) {
  const page = await store().searchProducts({
    category: filters.category,
    query: filters.query,
    limit: 50,
  });
  return page.items;
}

export async function findProduct(id: string): Promise<Product | undefined> {
  try {
    return await store().getProduct(id);
  } catch (error) {
    if (error instanceof StoreApiError && error.code === 'not_found') return undefined;
    throw error;
  }
}

/** Where the widget sends chat messages. */
export const chatApiUrl = () => process.env.CHAT_API_URL ?? 'http://localhost:3001';
