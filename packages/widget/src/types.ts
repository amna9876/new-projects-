/**
 * Shapes of the tool results the widget knows how to render.
 *
 * They mirror `@agentic-shop/agent-core`'s views, but are declared here so the
 * widget bundle has no runtime dependency on the agent. `test/types.test.ts`
 * fails to compile if the two drift apart.
 */

export interface Money {
  /** Minor units (for example cents). */
  amount: number;
  currency: string;
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
  variantCount: number;
}

export interface VariantOption {
  variantId: string;
  title: string;
  price: Money;
  inStock: boolean;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  attributes: Record<string, string | number | boolean>;
  variants: VariantOption[];
}

export interface ComparisonRow {
  attribute: string;
  label: string;
  values: (string | number | boolean | null)[];
  differs: boolean;
}

export interface ProductComparison {
  products: ProductSummary[];
  rows: ComparisonRow[];
}

export interface CartLine {
  itemId: string;
  productId: string;
  variantId: string;
  title: string;
  variantTitle?: string;
  image?: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface CartView {
  items: CartLine[];
  itemCount: number;
  discounts: { code: string; description?: string; amount: Money }[];
  totals: { subtotal: Money; discount: Money; total: Money };
}

export interface VariantChoice {
  productId: string;
  productTitle: string;
  options: VariantOption[];
}

export interface CheckoutLink {
  url: string;
  cart: CartView;
}

/** A tool result as it arrives on the wire. Its contents are untrusted until checked. */
export type ToolOutput =
  | { ok: true; data: unknown }
  | { ok: false; error: { code: string; message: string; details?: unknown } };
