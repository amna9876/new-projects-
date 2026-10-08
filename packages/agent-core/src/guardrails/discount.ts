import type { ModelMessage } from 'ai';

/** Concatenated text of everything the shopper has typed in this conversation. */
export function shopperText(messages: readonly ModelMessage[]): string {
  const parts: string[] = [];
  for (const message of messages) {
    if (message.role !== 'user') continue;
    if (typeof message.content === 'string') {
      parts.push(message.content);
      continue;
    }
    for (const part of message.content) {
      if (part.type === 'text') parts.push(part.text);
    }
  }
  return parts.join('\n');
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True when the shopper typed this exact discount code themselves.
 *
 * Product text is attacker-controlled and may tell the model to apply a code.
 * Requiring the code to appear in a user message means such text can never
 * cause a discount to be applied, whatever the model decides.
 */
export function isCodeFromShopper(code: string, messages: readonly ModelMessage[]): boolean {
  const normalised = code.trim();
  if (normalised.length === 0) return false;
  // Match the code as a whole token, so "SAVE" does not match "SAVE20".
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_-])${escapeRegExp(normalised)}(?![\\p{L}\\p{N}_-])`,
    'iu',
  );
  return pattern.test(shopperText(messages));
}
