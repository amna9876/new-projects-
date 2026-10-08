import type { Product } from '@agentic-shop/api-contract';
import { summariseProduct, type ProductSummary } from './views';

export type AttributeValue = string | number | boolean | null;

export interface ComparisonRow {
  /** Attribute key as the store names it, for example `battery_hours`. */
  attribute: string;
  /** Human-readable label, for example "Battery hours". */
  label: string;
  /** One value per product, in the same order as `products`; null when the product lacks it. */
  values: AttributeValue[];
  /** True when the products do not all share the same value. */
  differs: boolean;
}

export interface ProductComparison {
  products: ProductSummary[];
  rows: ComparisonRow[];
}

export const COMPARE_MIN_PRODUCTS = 2;
export const COMPARE_MAX_PRODUCTS = 4;

function humanise(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Builds a side-by-side table from the products' flat attributes.
 * Rows cover the union of all attribute keys, in first-seen order, so the
 * table has no gaps in its shape; a missing value is an explicit null.
 * Values are copied as the store returned them: nothing is computed or ranked.
 */
export function buildComparison(products: readonly Product[]): ProductComparison {
  const keys: string[] = [];
  for (const product of products) {
    for (const key of Object.keys(product.attributes)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }

  const rows = keys.map((attribute) => {
    const values = products.map((product) => product.attributes[attribute] ?? null);
    return {
      attribute,
      label: humanise(attribute),
      values,
      differs: new Set(values).size > 1,
    };
  });

  return { products: products.map(summariseProduct), rows };
}
