import type { Money } from '@agentic-shop/api-contract';

/** Formats a store amount. Only moves the decimal point; never computes a price. */
export function formatMoney(money: Money, locale = 'en-US'): string {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: money.currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(money.amount / 10 ** digits);
}

export function formatAttribute(value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export const humanise = (key: string) => {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
