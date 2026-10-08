import { createCartTools } from './cart';
import { createCatalogueTools } from './catalogue';
import type { ToolContext } from './context';

export type { ToolContext } from './context';

/** Builds the agent's tool set, bound to one store and one conversation's session. */
export function createTools(context: ToolContext) {
  return {
    ...createCatalogueTools(context),
    ...createCartTools(context),
  };
}

export type ShoppingTools = ReturnType<typeof createTools>;
export type ShoppingToolName = keyof ShoppingTools;

/** Tools that change the cart. Useful for UIs and audits. */
export const CART_MUTATION_TOOLS = [
  'addToCart',
  'updateCartItem',
  'removeFromCart',
  'applyDiscountCode',
] as const satisfies readonly ShoppingToolName[];
