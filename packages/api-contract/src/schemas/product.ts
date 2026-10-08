import { z } from 'zod';
import { MoneySchema } from './common';

export const ProductVariantSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).describe('Display name of the variant, for example "Black / M".'),
    sku: z.string().optional(),
    options: z
      .record(z.string(), z.string())
      .describe('Option name to value, for example { "color": "Black", "size": "M" }.'),
    price: MoneySchema,
    inStock: z.boolean(),
  })
  .describe('A purchasable version of a product.');
export type ProductVariant = z.infer<typeof ProductVariantSchema>;

export const ProductRatingSchema = z.object({
  average: z.number().min(0).max(5),
  count: z.number().int().min(0),
});

export const ProductSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    brand: z.string().optional(),
    category: z.string().min(1),
    images: z.array(z.url()).describe('Absolute image URLs, primary image first.'),
    price: MoneySchema.describe('Lowest price across the variants.'),
    compareAtPrice: MoneySchema.optional().describe('Original price when the product is on sale.'),
    inStock: z.boolean().describe('True when at least one variant can be purchased.'),
    rating: ProductRatingSchema.optional(),
    attributes: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .describe('Flat specification attributes, used for side-by-side comparison.'),
    variants: z
      .array(ProductVariantSchema)
      .min(1)
      .describe('Every product has at least one variant.'),
    url: z.url().optional().describe('Product page on the storefront.'),
    createdAt: z.iso.datetime().optional(),
  })
  .describe('A product in the store catalogue.');
export type Product = z.infer<typeof ProductSchema>;

export const PRODUCT_SORTS = [
  'relevance',
  'price_asc',
  'price_desc',
  'rating_desc',
  'newest',
] as const;
export const ProductSortSchema = z.enum(PRODUCT_SORTS);
export type ProductSort = z.infer<typeof ProductSortSchema>;

export const PRODUCT_LIST_DEFAULT_LIMIT = 20;
export const PRODUCT_LIST_MAX_LIMIT = 50;

/** Query string of `GET /products`. Values arrive as strings and are coerced. */
export const ProductListQuerySchema = z.object({
  query: z.string().trim().min(1).max(200).optional().describe('Free-text search.'),
  category: z.string().trim().min(1).optional().describe('Exact category slug.'),
  minPrice: z.coerce.number().int().min(0).optional().describe('Minimum price in minor units.'),
  maxPrice: z.coerce.number().int().min(0).optional().describe('Maximum price in minor units.'),
  inStock: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional()
    .describe('When "true", only products that can be purchased.'),
  sort: ProductSortSchema.default('relevance').describe('Result ordering.'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PRODUCT_LIST_MAX_LIMIT)
    .default(PRODUCT_LIST_DEFAULT_LIMIT)
    .describe('Page size.'),
  cursor: z.string().min(1).optional().describe('Opaque cursor from a previous `nextCursor`.'),
});
export type ProductListQuery = z.output<typeof ProductListQuerySchema>;
export type ProductListQueryInput = z.input<typeof ProductListQuerySchema>;

export const ProductListResponseSchema = z
  .object({
    items: z.array(ProductSchema),
    nextCursor: z
      .string()
      .nullable()
      .describe('Pass as `cursor` to fetch the next page; null on the last page.'),
  })
  .describe('One page of products.');
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;
