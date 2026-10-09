import type { Money } from './types';

/**
 * Formats a store amount for display. This only moves the decimal point for
 * the currency (1999 USD -> "$19.99", 500 JPY -> "¥500"); the widget never
 * adds, multiplies or otherwise computes prices.
 */
export function formatMoney(money: Money, locale: string): string {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: money.currency,
    });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(money.amount / 10 ** digits);
  } catch {
    // Unknown currency code: show the raw values rather than guess.
    return `${money.amount} ${money.currency}`;
  }
}

export function formatValue(value: string | number | boolean | null, yes: string, no: string) {
  if (value === null) return '—';
  if (typeof value === 'boolean') return value ? yes : no;
  return String(value);
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Accepts only plain hex colours, so an attribute value can never smuggle in other CSS. */
export function parseHexColor(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && HEX_COLOR.test(trimmed) ? trimmed : undefined;
}

/** Black or white, whichever is more readable on the given hex colour (WCAG relative luminance). */
export function readableTextOn(hex: string): '#ffffff' | '#111111' {
  const full =
    hex.length === 4 ? [...hex.slice(1)].map((char) => char + char).join('') : hex.slice(1);
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
  // Contrast against white is (1.05)/(L+0.05); against near-black it grows with L.
  return luminance > 0.179 ? '#111111' : '#ffffff';
}
