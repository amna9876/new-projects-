import type {
  CartLine,
  CartView,
  CheckoutLink,
  ComparisonRow,
  Money,
  ProductComparison,
  ProductDetail,
  ProductSummary,
  ToolOutput,
  VariantChoice,
  VariantOption,
} from './types';

/**
 * Runtime checks for everything the widget renders. Tool results cross a
 * network and originate in a store, so nothing is trusted to have the right
 * shape: a value that fails its check is simply not rendered.
 */

type Rec = Record<string, unknown>;

const isRecord = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isOptional = <T>(value: unknown, check: (inner: unknown) => inner is T) =>
  value === undefined || check(value);
const isArrayOf = <T>(value: unknown, check: (inner: unknown) => inner is T): value is T[] =>
  Array.isArray(value) && value.every(check);

export const isMoney = (value: unknown): value is Money =>
  isRecord(value) && Number.isInteger(value.amount) && isString(value.currency);

export const isProductSummary = (value: unknown): value is ProductSummary =>
  isRecord(value) &&
  isString(value.productId) &&
  isString(value.title) &&
  isString(value.category) &&
  isMoney(value.price) &&
  typeof value.inStock === 'boolean' &&
  isNumber(value.variantCount) &&
  isOptional(value.brand, isString) &&
  isOptional(value.image, isString) &&
  isOptional(value.compareAtPrice, isMoney) &&
  isOptional(
    value.rating,
    (rating): rating is ProductSummary['rating'] =>
      isRecord(rating) && isNumber(rating.average) && isNumber(rating.count),
  );

export const isVariantOption = (value: unknown): value is VariantOption =>
  isRecord(value) &&
  isString(value.variantId) &&
  isString(value.title) &&
  isMoney(value.price) &&
  typeof value.inStock === 'boolean';

const isAttributeValue = (value: unknown): value is string | number | boolean =>
  isString(value) || isNumber(value) || typeof value === 'boolean';

export const isProductDetail = (value: unknown): value is ProductDetail =>
  isRecord(value) &&
  isProductSummary(value) &&
  isString(value.description) &&
  isRecord(value.attributes) &&
  Object.values(value.attributes).every(isAttributeValue) &&
  isArrayOf(value.variants, isVariantOption);

const isComparisonRow = (value: unknown): value is ComparisonRow =>
  isRecord(value) &&
  isString(value.attribute) &&
  isString(value.label) &&
  typeof value.differs === 'boolean' &&
  isArrayOf(
    value.values,
    (cell): cell is string | number | boolean | null => cell === null || isAttributeValue(cell),
  );

export const isProductComparison = (value: unknown): value is ProductComparison =>
  isRecord(value) &&
  isArrayOf(value.products, isProductSummary) &&
  isArrayOf(value.rows, isComparisonRow) &&
  value.rows.every((row) => row.values.length === (value.products as unknown[]).length);

const isCartLine = (value: unknown): value is CartLine =>
  isRecord(value) &&
  isString(value.itemId) &&
  isString(value.productId) &&
  isString(value.variantId) &&
  isString(value.title) &&
  isNumber(value.quantity) &&
  isMoney(value.unitPrice) &&
  isMoney(value.lineTotal) &&
  isOptional(value.variantTitle, isString) &&
  isOptional(value.image, isString);

export const isCartView = (value: unknown): value is CartView =>
  isRecord(value) &&
  isArrayOf(value.items, isCartLine) &&
  isNumber(value.itemCount) &&
  isArrayOf(
    value.discounts,
    (discount): discount is CartView['discounts'][number] =>
      isRecord(discount) &&
      isString(discount.code) &&
      isMoney(discount.amount) &&
      isOptional(discount.description, isString),
  ) &&
  isRecord(value.totals) &&
  isMoney(value.totals.subtotal) &&
  isMoney(value.totals.discount) &&
  isMoney(value.totals.total);

export const isVariantChoice = (value: unknown): value is VariantChoice =>
  isRecord(value) &&
  isString(value.productId) &&
  isString(value.productTitle) &&
  isArrayOf(value.options, isVariantOption);

/** Only http(s) links are ever turned into something clickable. */
export function isHttpUrl(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export const isCheckoutLink = (value: unknown): value is CheckoutLink =>
  isRecord(value) && isHttpUrl(value.url) && isCartView(value.cart);

export function asToolOutput(value: unknown): ToolOutput | undefined {
  if (!isRecord(value)) return undefined;
  if (value.ok === true && 'data' in value) return { ok: true, data: value.data };
  if (
    value.ok === false &&
    isRecord(value.error) &&
    isString(value.error.code) &&
    isString(value.error.message)
  ) {
    return {
      ok: false,
      error: {
        code: value.error.code,
        message: value.error.message,
        details: value.error.details,
      },
    };
  }
  return undefined;
}

/** The cart carried by a successful cart tool result, if any. */
export function cartFromTool(
  toolName: string,
  output: ToolOutput | undefined,
): CartView | undefined {
  if (!output?.ok) return undefined;
  if (toolName === 'getCheckoutLink') {
    return isCheckoutLink(output.data) ? output.data.cart : undefined;
  }
  const cartTools = [
    'addToCart',
    'updateCartItem',
    'removeFromCart',
    'viewCart',
    'applyDiscountCode',
  ];
  return cartTools.includes(toolName) && isCartView(output.data) ? output.data : undefined;
}
