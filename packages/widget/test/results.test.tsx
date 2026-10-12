import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MessagePart } from '../src/chat/client';
import { CartSummary } from '../src/results/CartSummary';
import { ComparisonTable } from '../src/results/ComparisonTable';
import { ProductGrid } from '../src/results/ProductCard';
import { ToolResult } from '../src/results/ToolResult';
import { VariantPicker } from '../src/results/VariantPicker';
import { CART, HEADPHONES, money, renderResult, SKILLET } from './helpers';

type ToolPart = Extract<MessagePart, { kind: 'tool' }>;

const toolPart = (toolName: string, output: ToolPart['output']): ToolPart => ({
  kind: 'tool',
  toolCallId: 'call-1',
  toolName,
  state: 'done',
  output,
});

describe('ProductGrid', () => {
  it('shows title, brand, price, sale price, rating and options', () => {
    renderResult(<ProductGrid products={[HEADPHONES]} />);
    const card = screen.getByRole('listitem');

    expect(within(card).getByText('Aurora ANC Wireless Headphones')).toBeDefined();
    expect(within(card).getByText('Soniq')).toBeDefined();
    expect(within(card).getByText('$199.00')).toBeDefined();
    expect(within(card).getByText('$249.00').tagName).toBe('S');
    expect(within(card).getByLabelText('4.7 out of 5 (2184 reviews)')).toBeDefined();
    expect(within(card).getByText('3 options')).toBeDefined();
    expect(within(card).getByText('Sale')).toBeDefined();
    expect(card.querySelector('img')?.getAttribute('src')).toBe(HEADPHONES.image);
  });

  it('sends a chat message when add to cart is clicked', async () => {
    const { send } = renderResult(<ProductGrid products={[SKILLET]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(send).toHaveBeenCalledExactlyOnceWith('Add "Ember 10" Cast Iron Skillet" to my cart.');
  });

  it('disables the button for out-of-stock products and while busy', () => {
    renderResult(<ProductGrid products={[{ ...SKILLET, inStock: false }]} />);
    const soldOut = screen.getByRole('button', { name: 'Out of stock' });
    expect((soldOut as HTMLButtonElement).disabled).toBe(true);

    renderResult(<ProductGrid products={[{ ...SKILLET, productId: 'other' }]} />, { busy: true });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add to cart' }).disabled).toBe(
      true,
    );
  });

  it('falls back to a placeholder for a missing or unsafe image URL', () => {
    const { container } = renderResult(
      <ProductGrid
        products={[SKILLET, { ...SKILLET, productId: 'evil', image: 'javascript:alert(1)' }]}
      />,
    );
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('.asa-image-placeholder')).toHaveLength(2);
  });

  it('renders nothing for an empty result', () => {
    const { container } = renderResult(<ProductGrid products={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('formats prices for the currency and locale', () => {
    renderResult(<ProductGrid products={[{ ...SKILLET, price: money(500, 'JPY') }]} />);
    expect(screen.getByText(/500/).textContent).toMatch(/^¥500$/);
  });
});

describe('ComparisonTable', () => {
  const comparison = {
    products: [HEADPHONES, { ...SKILLET, inStock: false }],
    rows: [
      { attribute: 'type', label: 'Type', values: ['Over-ear', 'Over-ear'], differs: false },
      { attribute: 'battery_hours', label: 'Battery hours', values: [40, null], differs: true },
      { attribute: 'wireless', label: 'Wireless', values: [true, false], differs: true },
    ],
  };

  it('lays the products out as columns with one row per attribute', () => {
    renderResult(<ComparisonTable comparison={comparison} />);
    const table = screen.getByRole('table', { name: 'Product comparison' });

    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'Feature',
      'Aurora ANC Wireless Headphones',
      'Ember 10" Cast Iron Skillet',
    ]);
    const cells = (name: string) =>
      within(within(table).getByRole('row', { name: new RegExp(`^${name}`) }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent);

    expect(cells('Price')).toEqual(['$199.00', '$45.00']);
    expect(cells('Availability')).toEqual(['In stock', 'Out of stock']);
    expect(cells('Battery hours')).toEqual(['40', '—']);
    expect(cells('Wireless')).toEqual(['Yes', 'No']);
  });

  it('marks the rows where the products differ', () => {
    renderResult(<ComparisonTable comparison={comparison} />);
    const row = (name: string) => screen.getByRole('row', { name: new RegExp(`^${name}`) });
    expect(row('Battery hours').className).toBe('asa-differs');
    expect(row('Type').className).toBe('');
  });
});

describe('CartSummary', () => {
  it('shows lines, discounts and the totals exactly as given', () => {
    renderResult(<CartSummary cart={CART} />);
    expect(screen.getByText('Aurora ANC Wireless Headphones')).toBeDefined();
    expect(screen.getByText('Black · Qty 2')).toBeDefined();
    expect(screen.getByText('WELCOME10')).toBeDefined();

    const amounts = [...document.querySelectorAll('dd')].map((element) => element.textContent);
    expect(amounts).toEqual(['$398.00', '−$39.80', '$358.20']);
  });

  it('says when the cart is empty', () => {
    const empty = {
      items: [],
      itemCount: 0,
      discounts: [],
      totals: { subtotal: money(0), discount: money(0), total: money(0) },
    };
    renderResult(<CartSummary cart={empty} />);
    expect(screen.getByText('Your cart is empty.')).toBeDefined();
  });
});

describe('VariantPicker', () => {
  const choice = {
    productId: 'aurora-anc-headphones',
    productTitle: 'Aurora ANC Wireless Headphones',
    options: [
      { variantId: 'black', title: 'Black', price: money(19900), inStock: true },
      { variantId: 'sand', title: 'Sand', price: money(19900), inStock: false },
    ],
  };

  it('offers each variant and sends the choice as a message', async () => {
    const { send } = renderResult(<VariantPicker choice={choice} />);
    const group = screen.getByRole('group', {
      name: 'Choose an option for Aurora ANC Wireless Headphones',
    });
    expect(within(group).getByRole<HTMLButtonElement>('button', { name: /Sand/ }).disabled).toBe(
      true,
    );

    await userEvent.click(within(group).getByRole('button', { name: 'Black' }));
    expect(send).toHaveBeenCalledExactlyOnceWith(
      'Add "Aurora ANC Wireless Headphones" (Black) to my cart.',
    );
  });

  it('shows prices only when the variants cost different amounts', () => {
    const options = [choice.options[0]!, { ...choice.options[1]!, price: money(21900) }];
    renderResult(<VariantPicker choice={{ ...choice, options }} />);
    expect(screen.getByRole('button', { name: 'Black · $199.00' })).toBeDefined();
  });
});

describe('ToolResult', () => {
  it('shows progress while a tool is running', () => {
    renderResult(
      <ToolResult
        part={{ kind: 'tool', toolCallId: 'c', toolName: 'searchProducts', state: 'running' }}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('Searching products…');
  });

  it('routes each tool to its renderer', () => {
    renderResult(
      <>
        <ToolResult
          part={toolPart('searchProducts', { ok: true, data: { products: [SKILLET] } })}
        />
        <ToolResult part={toolPart('viewCart', { ok: true, data: CART })} />
        <ToolResult
          part={toolPart('getCheckoutLink', {
            ok: true,
            data: { url: 'https://store.test/checkout/abc', cart: CART },
          })}
        />
      </>,
    );
    expect(screen.getByText('Ember 10" Cast Iron Skillet')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();

    const link = screen.getByRole('link', { name: 'Go to checkout' });
    expect(link.getAttribute('href')).toBe('https://store.test/checkout/abc');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('turns a clarification request into variant buttons', () => {
    renderResult(
      <ToolResult
        part={toolPart('addToCart', {
          ok: false,
          error: {
            code: 'needs_clarification',
            message: 'Which one?',
            details: {
              productId: 'p',
              productTitle: 'Kettle',
              options: [
                { variantId: 'v', title: 'Matte Black', price: money(7900), inStock: true },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Matte Black' })).toBeDefined();
  });

  it.each([
    [
      'a failed tool',
      toolPart('searchProducts', { ok: false, error: { code: 'x', message: 'y' } }),
    ],
    ['an unknown tool', toolPart('launchRocket', { ok: true, data: { go: true } })],
    [
      'a cart that fails its shape check',
      toolPart('viewCart', { ok: true, data: { items: 'no' } }),
    ],
    ['null data', toolPart('searchProducts', { ok: true, data: null })],
    [
      'a checkout link that is not http(s)',
      toolPart('getCheckoutLink', { ok: true, data: { url: 'javascript:alert(1)', cart: CART } }),
    ],
  ])('renders nothing for %s', (_name, part) => {
    const { container } = renderResult(<ToolResult part={part} />);
    expect(container.innerHTML).toBe('');
  });

  it('drops malformed products but keeps the valid ones', () => {
    renderResult(
      <ToolResult
        part={toolPart('searchProducts', {
          ok: true,
          data: { products: [SKILLET, { title: 'No id or price' }, 'nonsense'] },
        })}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('untrusted text', () => {
  it('renders HTML in store data as plain text', () => {
    const hostile = {
      ...SKILLET,
      title: '<img src=x onerror="alert(1)">Skillet',
      brand: '<script>alert(1)</script>',
    };
    const { container } = renderResult(<ProductGrid products={[hostile]} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByText('<img src=x onerror="alert(1)">Skillet')).toBeDefined();
  });
});
