import { ProductSortSchema } from '@agentic-shop/api-contract';
import { tool } from 'ai';
import { z } from 'zod';
import { buildComparison, COMPARE_MAX_PRODUCTS, COMPARE_MIN_PRODUCTS } from '../compare';
import { safely, success } from '../guardrails/result';
import { detailProduct, summariseProduct } from '../views';
import type { ToolContext } from './context';

const productId = z.string().min(1).describe('A productId taken from an earlier tool result.');

export function createCatalogueTools({ store, config }: ToolContext) {
  return {
    searchProducts: tool({
      description:
        'Search and filter the store catalogue. Returns product summaries. Use this whenever the shopper is looking for something; never answer product questions from memory.',
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe('Keywords, for example "wireless headphones". Every word must match.'),
        category: z
          .string()
          .min(1)
          .optional()
          .describe(
            'Exact category slug as it appears in earlier results. Prefer query when unsure.',
          ),
        minPrice: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Minimum price in the smallest currency unit (5000 = $50.00).'),
        maxPrice: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Maximum price in the smallest currency unit (5000 = $50.00).'),
        inStock: z.boolean().optional().describe('true to return only purchasable products.'),
        sort: ProductSortSchema.optional(),
        limit: z.number().int().min(1).max(config.maxSearchResults).optional(),
        cursor: z.string().min(1).optional().describe('nextCursor from the previous page.'),
      }),
      execute: (input) =>
        safely(async () => {
          const page = await store.searchProducts({
            ...input,
            limit: input.limit ?? config.maxSearchResults,
          });
          return success({
            products: page.items.map(summariseProduct),
            nextCursor: page.nextCursor,
          });
        }),
    }),

    getProduct: tool({
      description:
        'Get the full details of one product: description, attributes and the variants (with variantId, price and stock) needed to add it to the cart.',
      inputSchema: z.object({ productId }),
      execute: (input) =>
        safely(async () => success(detailProduct(await store.getProduct(input.productId)))),
    }),

    compareProducts: tool({
      description: `Compare ${COMPARE_MIN_PRODUCTS} to ${COMPARE_MAX_PRODUCTS} products side by side. Returns a table with one row per attribute and one value per product (null when a product lacks it).`,
      inputSchema: z.object({
        productIds: z.array(productId).min(COMPARE_MIN_PRODUCTS).max(COMPARE_MAX_PRODUCTS),
      }),
      execute: (input) =>
        safely(async () => {
          const ids = [...new Set(input.productIds)];
          const products = await Promise.all(ids.map((id) => store.getProduct(id)));
          return success(buildComparison(products));
        }),
    }),
  };
}
