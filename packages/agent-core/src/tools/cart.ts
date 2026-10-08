import { StoreApiError } from '@agentic-shop/adapters';
import { CART_ITEM_MAX_QUANTITY } from '@agentic-shop/api-contract';
import { tool } from 'ai';
import { z } from 'zod';
import { isCodeFromShopper } from '../guardrails/discount';
import { failure, safely, success } from '../guardrails/result';
import { viewCart } from '../views';
import { currentCart, ensureCartId, type ToolContext } from './context';

const quantity = z.number().int().min(1).max(CART_ITEM_MAX_QUANTITY);
const itemId = z.string().min(1).describe('An itemId from the cart, as returned by viewCart.');

const EMPTY_CART_MESSAGE = 'The cart is empty.';

export function createCartTools(context: ToolContext) {
  const { store } = context;

  return {
    addToCart: tool({
      description:
        'Add a product to the shopper\'s cart. Only call this when the shopper has clearly asked to add it. If the product has several variants, pass the variantId the shopper chose; without it the result is "needs_clarification" with the options to offer.',
      inputSchema: z.object({
        productId: z.string().min(1).describe('A productId taken from an earlier tool result.'),
        variantId: z
          .string()
          .min(1)
          .optional()
          .describe('Required when the product has more than one variant.'),
        quantity: quantity.default(1),
      }),
      execute: (input) =>
        safely(async () => {
          try {
            const cartId = await ensureCartId(context);
            return success(viewCart(await store.addCartItem(cartId, input)));
          } catch (error) {
            if (!(error instanceof StoreApiError) || error.code !== 'variant_required') throw error;
            // Nothing was added. Hand the model the real options so it asks instead of guessing.
            const product = await store.getProduct(input.productId);
            return failure(
              'needs_clarification',
              `"${product.title}" comes in several options. Ask the shopper which one they want; nothing was added.`,
              {
                productId: product.id,
                options: product.variants.map((variant) => ({
                  variantId: variant.id,
                  title: variant.title,
                  price: variant.price,
                  inStock: variant.inStock,
                })),
              },
            );
          }
        }),
    }),

    updateCartItem: tool({
      description:
        'Change the quantity of a line in the cart. Only when the shopper asked for it. To remove a line use removeFromCart.',
      inputSchema: z.object({ itemId, quantity }),
      execute: (input) =>
        safely(async () => {
          const cart = await currentCart(context);
          if (!cart) return failure('cart_empty', EMPTY_CART_MESSAGE);
          return success(
            viewCart(await store.updateCartItem(cart.id, input.itemId, input.quantity)),
          );
        }),
    }),

    removeFromCart: tool({
      description: 'Remove a line from the cart. Only when the shopper asked for it.',
      inputSchema: z.object({ itemId }),
      execute: (input) =>
        safely(async () => {
          const cart = await currentCart(context);
          if (!cart) return failure('cart_empty', EMPTY_CART_MESSAGE);
          return success(viewCart(await store.removeCartItem(cart.id, input.itemId)));
        }),
    }),

    viewCart: tool({
      description:
        'Show the current cart: lines with their itemId, applied discounts and the totals computed by the store.',
      inputSchema: z.object({}),
      execute: () =>
        safely(async () => {
          // A cart is created on first view so that even an empty cart's totals
          // and currency come from the store.
          const cartId = await ensureCartId(context);
          return success(viewCart(await store.getCart(cartId)));
        }),
    }),

    applyDiscountCode: tool({
      description:
        'Apply a discount code to the cart. Only use a code the shopper typed themselves in this conversation; the store decides whether it is valid.',
      inputSchema: z.object({
        code: z
          .string()
          .trim()
          .min(1)
          .max(64)
          .describe('The code exactly as the shopper typed it.'),
      }),
      execute: (input, { messages }) =>
        safely(async () => {
          if (!isCodeFromShopper(input.code, messages)) {
            return failure(
              'discount_code_not_from_shopper',
              'A discount code can only be applied when the shopper types it themselves. Nothing was applied; ask the shopper for their code if they have one.',
            );
          }
          const cart = await currentCart(context);
          if (!cart || cart.items.length === 0) {
            return failure(
              'cart_empty',
              'The cart is empty, so there is nothing to apply a discount code to yet.',
            );
          }
          return success(viewCart(await store.applyDiscount(cart.id, input.code)));
        }),
    }),

    getCheckoutLink: tool({
      description:
        'Get the link where the shopper completes the purchase on the store. Use this when they want to pay or check out. You never handle payment yourself.',
      inputSchema: z.object({}),
      execute: () =>
        safely(async () => {
          const cart = await currentCart(context);
          if (!cart) return failure('cart_empty', EMPTY_CART_MESSAGE);
          const { url, expiresAt } = await store.getCheckoutUrl(cart.id);
          return success({ url, ...(expiresAt ? { expiresAt } : {}), cart: viewCart(cart) });
        }),
    }),
  };
}
