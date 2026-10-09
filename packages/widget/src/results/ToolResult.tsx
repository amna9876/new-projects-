import type { MessagePart } from '../chat/client';
import { useWidget } from '../context';
import {
  isCartView,
  isCheckoutLink,
  isProductComparison,
  isProductDetail,
  isProductSummary,
  isVariantChoice,
} from '../guards';
import type { StringKey } from '../i18n/index';
import { CartSummary, CheckoutButton } from './CartSummary';
import { ComparisonTable } from './ComparisonTable';
import { ProductGrid } from './ProductCard';
import { VariantPicker } from './VariantPicker';

type ToolPart = Extract<MessagePart, { kind: 'tool' }>;

const CART_TOOLS = [
  'addToCart',
  'updateCartItem',
  'removeFromCart',
  'viewCart',
  'applyDiscountCode',
];

function progressKey(toolName: string): StringKey {
  if (toolName === 'searchProducts' || toolName === 'getProduct') return 'toolSearching';
  if (toolName === 'compareProducts') return 'toolComparing';
  if (CART_TOOLS.includes(toolName)) return 'toolCart';
  return 'toolWorking';
}

/**
 * Renders one tool call. Unknown tools, failed calls and results that do not
 * pass their shape check render nothing: the assistant's text explains those.
 */
export function ToolResult({ part }: { part: ToolPart }) {
  const { t } = useWidget();

  if (part.state === 'running') {
    return (
      <p className="asa-progress" role="status">
        {t(progressKey(part.toolName))}
      </p>
    );
  }

  const { output, toolName } = part;
  if (!output) return null;

  if (!output.ok) {
    return toolName === 'addToCart' &&
      output.error.code === 'needs_clarification' &&
      isVariantChoice(output.error.details) ? (
      <VariantPicker choice={output.error.details} />
    ) : null;
  }

  const { data } = output;
  if (toolName === 'searchProducts') {
    const products =
      typeof data === 'object' && data !== null
        ? (data as { products?: unknown }).products
        : undefined;
    return Array.isArray(products) ? (
      <ProductGrid products={products.filter(isProductSummary)} />
    ) : null;
  }
  if (toolName === 'getProduct') {
    return isProductDetail(data) ? <ProductGrid products={[data]} /> : null;
  }
  if (toolName === 'compareProducts') {
    return isProductComparison(data) ? <ComparisonTable comparison={data} /> : null;
  }
  if (toolName === 'getCheckoutLink') {
    return isCheckoutLink(data) ? <CheckoutButton checkout={data} /> : null;
  }
  if (CART_TOOLS.includes(toolName)) {
    return isCartView(data) ? <CartSummary cart={data} /> : null;
  }
  return null;
}
