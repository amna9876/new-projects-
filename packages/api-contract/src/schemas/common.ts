import { z } from 'zod';

export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .describe('ISO 4217 currency code, for example "USD".');

export const MoneySchema = z
  .object({
    amount: z
      .number()
      .int()
      .describe("Amount in the currency's minor unit (for example cents). Never a float."),
    currency: CurrencyCodeSchema,
  })
  .describe('A monetary amount. Always computed by the store, never by the agent.');
export type Money = z.infer<typeof MoneySchema>;

export const ERROR_CODES = [
  'validation_error',
  'unauthorized',
  'not_found',
  'variant_required',
  'out_of_stock',
  'discount_invalid',
  'discount_expired',
  'discount_min_not_met',
  'cart_empty',
  'rate_limited',
  'internal_error',
] as const;

export const ErrorCodeSchema = z
  .enum(ERROR_CODES)
  .describe('Machine-readable reason for the failure.');
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: ErrorCodeSchema,
      message: z.string().describe('Human-readable explanation, safe to show to a shopper.'),
      details: z.unknown().optional().describe('Optional structured context, such as issues.'),
    }),
  })
  .describe('Error envelope returned with every non-2xx response.');
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
