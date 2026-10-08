import type { Cart, Money, Product } from '@agentic-shop/api-contract';

/** Long descriptions cost tokens and are the main carrier of injected text. */
export const DESCRIPTION_MAX_CHARS = 600;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export interface ProductSummary {
  productId: string;
  title: string;
  brand?: string;
  category: string;
  image?: string;
  price: Money;
  compareAtPrice?: Money;
  inStock: boolean;
  rating?: { average: number; count: number };
  /** Number of variants; when above 1 a variant must be chosen before adding to the cart. */
  variantCount: number;
}

/** The compact shape used in search results and product cards. */
export function summariseProduct(product: Product): ProductSummary {
  return {
    productId: product.id,
    title: product.title,
    ...(product.brand ? { brand: product.brand } : {}),
    category: product.category,
    ...(product.images[0] ? { image: product.images[0] } : {}),
    price: product.price,
    ...(product.compareAtPrice ? { compareAtPrice: product.compareAtPrice } : {}),
    inStock: product.inStock,
    ...(product.rating ? { rating: product.rating } : {}),
    variantCount: product.variants.length,
  };
}

export interface ProductDetail extends ProductSummary {
  description: string;
  attributes: Product['attributes'];
  variants: { variantId: string; title: string; price: Money; inStock: boolean }[];
  url?: string;
}

export function detailProduct(product: Product): ProductDetail {
  return {
    ...summariseProduct(product),
    description: clip(product.description, DESCRIPTION_MAX_CHARS),
    attributes: product.attributes,
    variants: product.variants.map((variant) => ({
      variantId: variant.id,
      title: variant.title,
      price: variant.price,
      inStock: variant.inStock,
    })),
    ...(product.url ? { url: product.url } : {}),
  };
}

export interface CartView {
  items: {
    itemId: string;
    productId: string;
    variantId: string;
    title: string;
    variantTitle?: string;
    image?: string;
    quantity: number;
    unitPrice: Money;
    lineTotal: Money;
  }[];
  itemCount: number;
  discounts: Cart['discounts'];
  totals: Cart['totals'];
}

/** The cart as the model and the widget see it. The cart id stays server-side. */
export function viewCart(cart: Cart): CartView {
  return {
    items: cart.items.map(({ id, ...item }) => ({ itemId: id, ...item })),
    itemCount: cart.itemCount,
    discounts: cart.discounts,
    totals: cart.totals,
  };
}
