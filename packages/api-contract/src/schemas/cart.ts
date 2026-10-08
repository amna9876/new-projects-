import { z } from 'zod';
import { CurrencyCodeSchema, MoneySchema } from './common';

export const CART_ITEM_MAX_QUANTITY = 99;

const QuantitySchema = z.number().int().min(1).max(CART_ITEM_MAX_QUANTITY);

export const CartItemSchema = z
  .object({
    id: z.string().min(1).describe('Line item id, used to update or remove the line.'),
    productId: z.string().min(1),
    variantId: z.string().min(1),
    title: z.string().min(1),
    variantTitle: z.string().optional(),
    image: z.url().optional(),
    quantity: QuantitySchema,
    unitPrice: MoneySchema,
    lineTotal: MoneySchema.describe('unitPrice multiplied by quantity, computed by the store.'),
  })
  .describe('One line in a cart.');
export type CartItem = z.infer<typeof CartItemSchema>;

export const AppliedDiscountSchema = z
  .object({
    code: z.string().min(1),
    description: z.string().optional(),
    amount: MoneySchema.describe('Amount taken off the subtotal by this code.'),
  })
  .describe('A discount code currently applied to the cart.');
export type AppliedDiscount = z.infer<typeof AppliedDiscountSchema>;

export const CartTotalsSchema = z
  .object({
    subtotal: MoneySchema.describe('Sum of all line totals.'),
    discount: MoneySchema.describe('Sum of all applied discounts.'),
    total: MoneySchema.describe('subtotal minus discount.'),
  })
  .describe('Totals computed by the store.');
export type CartTotals = z.infer<typeof CartTotalsSchema>;

export const CartSchema = z
  .object({
    id: z.string().min(1),
    currency: CurrencyCodeSchema,
    items: z.array(CartItemSchema),
    itemCount: z.number().int().min(0).describe('Sum of the quantities of all lines.'),
    discounts: z.array(AppliedDiscountSchema),
    totals: CartTotalsSchema,
    updatedAt: z.iso.datetime(),
  })
  .describe('A shopping cart. Returned in full after every mutation.');
export type Cart = z.infer<typeof CartSchema>;

export const CreateCartRequestSchema = z
  .object({
    currency: CurrencyCodeSchema.optional().describe('Defaults to the store currency.'),
  })
  .describe('Body of `POST /carts`. May be omitted entirely.');
export type CreateCartRequest = z.infer<typeof CreateCartRequestSchema>;

export const AddCartItemRequestSchema = z
  .object({
    productId: z.string().min(1),
    variantId: z
      .string()
      .min(1)
      .optional()
      .describe('Required when the product has more than one variant.'),
    quantity: QuantitySchema.default(1),
  })
  .describe('Body of `POST /carts/{id}/items`.');
export type AddCartItemRequest = z.input<typeof AddCartItemRequestSchema>;

export const UpdateCartItemRequestSchema = z
  .object({
    quantity: QuantitySchema.describe('New quantity. Use DELETE to remove the line.'),
  })
  .describe('Body of `PATCH /carts/{id}/items/{itemId}`.');
export type UpdateCartItemRequest = z.infer<typeof UpdateCartItemRequestSchema>;

export const ApplyDiscountRequestSchema = z
  .object({
    code: z.string().trim().min(1).max(64),
  })
  .describe('Body of `POST /carts/{id}/discounts`.');
export type ApplyDiscountRequest = z.infer<typeof ApplyDiscountRequestSchema>;

export const CheckoutUrlResponseSchema = z
  .object({
    url: z.url().describe('Where the shopper completes payment on the store itself.'),
    expiresAt: z.iso.datetime().optional(),
  })
  .describe('Hand-off link. The agent never handles payment.');
export type CheckoutUrlResponse = z.infer<typeof CheckoutUrlResponseSchema>;
