import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ChatClient } from '../src/chat/client';
import { Widget } from '../src/components/Widget';
import { API_URL, createBackend } from './helpers';

/**
 * Whole-widget flows: the real UI and chat client against a real chat server
 * with a scripted model and the in-process mock store.
 */
function openWidget(script: Parameters<typeof createBackend>[0]) {
  const backend = createBackend(script);
  const client = new ChatClient({ apiUrl: API_URL, fetch: backend.fetch, storage: null });
  render(<Widget client={client} defaultOpen />);
  return backend;
}

const say = (message: string) =>
  userEvent.type(screen.getByRole('textbox', { name: 'Message' }), `${message}{Enter}`);

describe('search, then add to cart from a product card', () => {
  it('shows cards, adds the product through a chat message, and updates the cart', async () => {
    const { requests } = openWidget([
      { calls: [{ tool: 'searchProducts', input: { query: 'skillet' } }] },
      { text: 'I found one skillet.' },
      { calls: [{ tool: 'addToCart', input: { productId: 'ember-cast-iron-skillet' } }] },
      { text: 'Added. Your total is $45.00.' },
    ]);

    await say('do you have a skillet?');
    expect(await screen.findByText('I found one skillet.')).toBeDefined();
    const card = screen.getByText('Ember 10" Cast Iron Skillet').closest('li')!;
    expect(within(card).getByText('$45.00')).toBeDefined();

    await userEvent.click(within(card).getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('Added. Your total is $45.00.')).toBeDefined();

    // The click travelled as an ordinary shopper message.
    expect(requests.at(-1)).toEqual({
      path: '/api/chat',
      body: { message: 'Add "Ember 10" Cast Iron Skillet" to my cart.' },
    });
    expect(screen.getByText('Add "Ember 10" Cast Iron Skillet" to my cart.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cart, 1 items' })).toBeDefined();
    expect(screen.getByText('Total').nextElementSibling?.textContent).toBe('$45.00');
  });
});

describe('choosing a variant', () => {
  it('offers the variants and adds the chosen one', async () => {
    openWidget([
      { calls: [{ tool: 'addToCart', input: { productId: 'aurora-anc-headphones' } }] },
      { text: 'Which colour would you like?' },
      {
        calls: [
          {
            tool: 'addToCart',
            input: { productId: 'aurora-anc-headphones', variantId: 'aurora-anc-headphones-black' },
          },
        ],
      },
      { text: 'Added the black pair.' },
    ]);

    await say('add the aurora headphones');
    await screen.findByText('Which colour would you like?');
    const group = await screen.findByRole('group', {
      name: 'Choose an option for Aurora ANC Wireless Headphones',
    });
    const buttons = within(group).getAllByRole<HTMLButtonElement>('button');
    expect(buttons.map((button) => [button.textContent, button.disabled])).toEqual([
      ['Black', false],
      ['Sand (Out of stock)', true],
      ['Midnight Blue', false],
    ]);

    await userEvent.click(within(group).getByRole('button', { name: 'Black' }));
    expect(await screen.findByText('Added the black pair.')).toBeDefined();
    expect(screen.getByText('Black · Qty 1')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cart, 1 items' })).toBeDefined();
  });
});

describe('comparing and checking out', () => {
  it('renders the comparison table and the checkout hand-off', async () => {
    openWidget([
      {
        calls: [
          {
            tool: 'compareProducts',
            input: { productIds: ['aurora-anc-headphones', 'pulse-studio-headphones'] },
          },
        ],
      },
      { text: 'The Aurora has noise cancelling.' },
      { calls: [{ tool: 'addToCart', input: { productId: 'pulse-studio-headphones' } }] },
      { calls: [{ tool: 'getCheckoutLink', input: {} }] },
      { text: 'Here is your checkout link.' },
    ]);

    await say('compare the aurora and pulse headphones');
    const table = await screen.findByRole('table', { name: 'Product comparison' });
    const row = within(table).getByRole('row', { name: /^Noise cancelling/ });
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Yes', 'No']);

    await say('add the pulse and check out');
    const link = await screen.findByRole('link', { name: 'Go to checkout' });
    expect(link.getAttribute('href')).toMatch(/^http:\/\/mock-store\.test\/checkout\/cart_/);
    expect(link.getAttribute('target')).toBe('_blank');
  });
});

describe('when things go wrong', () => {
  it('shows a friendly error and lets the shopper retry', async () => {
    openWidget([{ error: new Error('provider down') }, { text: 'Back online.' }]);

    await say('hello');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Something went wrong');

    await say('are you there?');
    expect(await screen.findByText('Back online.')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
