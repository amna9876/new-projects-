import { randomUUID } from 'node:crypto';
import {
  CART_ITEM_MAX_QUANTITY,
  type AppliedDiscount,
  type Cart,
  type CartItem,
  type CheckoutUrlResponse,
  type Product,
  type ProductListQuery,
  type ProductListResponse,
  type ProductVariant,
} from '@agentic-shop/api-contract';
import { notFound, StoreError } from './errors';
import { SEED_DISCOUNTS, type DiscountRule } from './seed/discounts';
import { buildSeedProducts, STORE_CURRENCY } from './seed/products';

const CHECKOUT_LINK_TTL_MS = 30 * 60 * 1000;

interface CartLine {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
}

interface CartRecord {
  id: string;
  currency: string;
  lines: CartLine[];
  discountCode?: string;
  updatedAt: Date;
}

export interface MockStoreOptions {
  /** Origin used for image and checkout URLs, for example `http://localhost:4000`. */
  publicUrl: string;
  products?: Product[];
  discounts?: DiscountRule[];
  now?: () => Date;
}

const encodeCursor = (offset: number) => Buffer.from(String(offset)).toString('base64url');

function decodeCursor(cursor: string): number {
  const offset = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isInteger(offset) || offset < 0) {
    throw new StoreError(400, 'validation_error', 'The cursor is not valid.');
  }
  return offset;
}

/** Number of search terms found in the product, weighted towards the title. */
function relevance(product: Product, terms: string[]): number {
  const title = product.title.toLowerCase();
  const rest = [
    product.brand ?? '',
    product.category,
    product.description,
    ...Object.values(product.attributes).map(String),
  ]
    .join(' ')
    .toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 3;
    else if (rest.includes(term)) score += 1;
    else return 0; // every term must match somewhere
  }
  return score;
}

/** In-memory store backing the mock API. All prices and totals are computed here. */
export class MockStore {
  readonly publicUrl: string;
  private readonly products: Product[];
  private readonly discounts: DiscountRule[];
  private readonly carts = new Map<string, CartRecord>();
  private readonly now: () => Date;

  constructor(options: MockStoreOptions) {
    this.publicUrl = options.publicUrl.replace(/\/+$/, '');
    this.products = options.products ?? buildSeedProducts(this.publicUrl);
    this.discounts = options.discounts ?? SEED_DISCOUNTS;
    this.now = options.now ?? (() => new Date());
  }

  // --- Products --------------------------------------------------------------

  listProducts(query: ProductListQuery): ProductListResponse {
    const terms = query.query?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];

    let matches = this.products
      .map((product, index) => ({ product, index, score: relevance(product, terms) }))
      .filter(({ product, score }) => {
        if (terms.length > 0 && score === 0) return false;
        if (query.category && product.category !== query.category) return false;
        if (query.minPrice !== undefined && product.price.amount < query.minPrice) return false;
        if (query.maxPrice !== undefined && product.price.amount > query.maxPrice) return false;
        if (query.inStock !== undefined && product.inStock !== query.inStock) return false;
        return true;
      });

    const byPrice = (a: Product, b: Product) => a.price.amount - b.price.amount;
    matches = matches.sort((a, b) => {
      let order = 0;
      if (query.sort === 'price_asc') order = byPrice(a.product, b.product);
      if (query.sort === 'price_desc') order = byPrice(b.product, a.product);
      if (query.sort === 'rating_desc') {
        order = (b.product.rating?.average ?? 0) - (a.product.rating?.average ?? 0);
      }
      if (query.sort === 'newest') {
        order = (b.product.createdAt ?? '').localeCompare(a.product.createdAt ?? '');
      }
      if (query.sort === 'relevance') order = b.score - a.score;
      return order !== 0 ? order : a.index - b.index; // stable, so pagination never repeats
    });

    const offset = query.cursor ? decodeCursor(query.cursor) : 0;
    const end = offset + query.limit;
    return {
      items: matches.slice(offset, end).map(({ product }) => product),
      nextCursor: end < matches.length ? encodeCursor(end) : null,
    };
  }

  getProduct(id: string): Product {
    const product = this.products.find((candidate) => candidate.id === id);
    if (!product) throw notFound('Product');
    return product;
  }

  // --- Carts -----------------------------------------------------------------

  createCart(currency: string = STORE_CURRENCY): Cart {
    if (currency !== STORE_CURRENCY) {
      throw new StoreError(400, 'validation_error', `This store only sells in ${STORE_CURRENCY}.`);
    }
    const record: CartRecord = {
      id: `cart_${randomUUID()}`,
      currency,
      lines: [],
      updatedAt: this.now(),
    };
    this.carts.set(record.id, record);
    return this.render(record);
  }

  getCart(id: string): Cart {
    return this.render(this.record(id));
  }

  addItem(
    cartId: string,
    input: { productId: string; variantId?: string; quantity: number },
  ): Cart {
    const record = this.record(cartId);
    const product = this.getProduct(input.productId);
    const variant = this.resolveVariant(product, input.variantId);

    const existing = record.lines.find((line) => line.variantId === variant.id);
    const quantity = (existing?.quantity ?? 0) + input.quantity;
    if (quantity > CART_ITEM_MAX_QUANTITY) {
      throw new StoreError(
        400,
        'validation_error',
        `You can order at most ${CART_ITEM_MAX_QUANTITY} of one item.`,
      );
    }

    if (existing) existing.quantity = quantity;
    else {
      record.lines.push({
        id: `item_${randomUUID()}`,
        productId: product.id,
        variantId: variant.id,
        quantity,
      });
    }
    return this.touch(record);
  }

  updateItem(cartId: string, itemId: string, quantity: number): Cart {
    const record = this.record(cartId);
    const line = record.lines.find((candidate) => candidate.id === itemId);
    if (!line) throw notFound('Cart item');
    this.resolveVariant(this.getProduct(line.productId), line.variantId);
    line.quantity = quantity;
    return this.touch(record);
  }

  removeItem(cartId: string, itemId: string): Cart {
    const record = this.record(cartId);
    const index = record.lines.findIndex((candidate) => candidate.id === itemId);
    if (index === -1) throw notFound('Cart item');
    record.lines.splice(index, 1);
    return this.touch(record);
  }

  applyDiscount(cartId: string, code: string): Cart {
    const record = this.record(cartId);
    const rule = this.discounts.find(
      (candidate) => candidate.code.toLowerCase() === code.toLowerCase(),
    );
    if (!rule) {
      throw new StoreError(422, 'discount_invalid', `The code "${code}" is not valid.`);
    }
    if (rule.kind === 'expired') {
      throw new StoreError(422, 'discount_expired', `The code "${rule.code}" has expired.`);
    }
    const subtotal = this.subtotal(record);
    if (rule.kind === 'fixed' && subtotal < rule.minSubtotal) {
      throw new StoreError(
        422,
        'discount_min_not_met',
        `The code "${rule.code}" needs a subtotal of at least ${formatMoney(rule.minSubtotal)}.`,
        { minSubtotal: { amount: rule.minSubtotal, currency: record.currency } },
      );
    }
    record.discountCode = rule.code;
    return this.touch(record);
  }

  checkoutUrl(cartId: string): CheckoutUrlResponse {
    const record = this.record(cartId);
    if (record.lines.length === 0) {
      throw new StoreError(
        409,
        'cart_empty',
        'The cart is empty, so there is nothing to check out.',
      );
    }
    return {
      url: `${this.publicUrl}/checkout/${record.id}`,
      expiresAt: new Date(this.now().getTime() + CHECKOUT_LINK_TTL_MS).toISOString(),
    };
  }

  // --- Internals -------------------------------------------------------------

  private record(id: string): CartRecord {
    const record = this.carts.get(id);
    if (!record) throw notFound('Cart');
    return record;
  }

  private touch(record: CartRecord): Cart {
    record.updatedAt = this.now();
    return this.render(record);
  }

  private resolveVariant(product: Product, variantId?: string): ProductVariant {
    let variant: ProductVariant | undefined;
    if (variantId) {
      variant = product.variants.find((candidate) => candidate.id === variantId);
      if (!variant) throw notFound('Variant');
    } else if (product.variants.length === 1) {
      variant = product.variants[0];
    }
    if (!variant) {
      throw new StoreError(
        409,
        'variant_required',
        `"${product.title}" comes in several options. Choose one of them.`,
        {
          variants: product.variants.map(({ id, title, inStock }) => ({ id, title, inStock })),
        },
      );
    }
    if (!variant.inStock) {
      const label = product.variants.length > 1 ? ` (${variant.title})` : '';
      throw new StoreError(409, 'out_of_stock', `"${product.title}"${label} is out of stock.`);
    }
    return variant;
  }

  private items(record: CartRecord): CartItem[] {
    return record.lines.map((line) => {
      const product = this.getProduct(line.productId);
      const variant = product.variants.find((candidate) => candidate.id === line.variantId);
      if (!variant) throw notFound('Variant');
      return {
        id: line.id,
        productId: product.id,
        variantId: variant.id,
        title: product.title,
        ...(product.variants.length > 1 ? { variantTitle: variant.title } : {}),
        ...(product.images[0] ? { image: product.images[0] } : {}),
        quantity: line.quantity,
        unitPrice: variant.price,
        lineTotal: { amount: variant.price.amount * line.quantity, currency: record.currency },
      };
    });
  }

  private subtotal(record: CartRecord): number {
    return this.items(record).reduce((sum, item) => sum + item.lineTotal.amount, 0);
  }

  /** Works out the discount for the current contents; drops a code that no longer qualifies. */
  private discountsFor(record: CartRecord, subtotal: number): AppliedDiscount[] {
    const rule = this.discounts.find((candidate) => candidate.code === record.discountCode);
    if (!rule || rule.kind === 'expired') return [];

    let amount: number;
    if (rule.kind === 'percent') {
      amount = Math.round((subtotal * rule.percent) / 100);
    } else if (subtotal >= rule.minSubtotal) {
      amount = Math.min(rule.amount, subtotal);
    } else {
      record.discountCode = undefined;
      return [];
    }
    return [
      {
        code: rule.code,
        description: rule.description,
        amount: { amount, currency: record.currency },
      },
    ];
  }

  private render(record: CartRecord): Cart {
    const money = (amount: number) => ({ amount, currency: record.currency });
    const items = this.items(record);
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal.amount, 0);
    const discounts = this.discountsFor(record, subtotal);
    const discount = discounts.reduce((sum, applied) => sum + applied.amount.amount, 0);

    return {
      id: record.id,
      currency: record.currency,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      discounts,
      totals: {
        subtotal: money(subtotal),
        discount: money(discount),
        total: money(subtotal - discount),
      },
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: STORE_CURRENCY }).format(
    amount / 100,
  );
}
