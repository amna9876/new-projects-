export type DiscountRule =
  | { kind: 'percent'; code: string; description: string; percent: number }
  | { kind: 'fixed'; code: string; description: string; amount: number; minSubtotal: number }
  | { kind: 'expired'; code: string; description: string };

/** Discount codes the mock store knows about. Codes are matched case-insensitively. */
export const SEED_DISCOUNTS: DiscountRule[] = [
  { kind: 'percent', code: 'WELCOME10', description: '10% off your order', percent: 10 },
  {
    kind: 'fixed',
    code: 'SAVE20',
    description: '$20 off orders of $100 or more',
    amount: 2000,
    minSubtotal: 10000,
  },
  { kind: 'expired', code: 'EXPIRED', description: 'Summer sale (ended)' },
];
