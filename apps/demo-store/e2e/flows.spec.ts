import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end tests: a real browser on the demo storefront, with the widget
 * loaded from the one-line script embed, talking to the real chat server and
 * store. The model is scripted (see chat-server.ts), so the tests are
 * deterministic and need no API key.
 */

const assistant = (page: Page) => page.getByRole('dialog', { name: 'Shopping assistant' });

async function openAssistant(page: Page) {
  await page.getByRole('button', { name: 'Open shopping assistant' }).click();
  await expect(assistant(page)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeFocused();
}

/** Sends a message and waits until the assistant has finished answering. */
async function say(page: Page, message: string) {
  const input = page.getByRole('textbox', { name: 'Message' });
  await input.fill(message);
  await input.press('Enter');
  await expect(assistant(page).getByText(message, { exact: true }).last()).toBeVisible();
  // The widget marks its root while a turn is running.
  await expect(page.locator('.asa-root')).toHaveAttribute('data-busy', 'false');
}

test.describe('storefront', () => {
  test('lists the catalogue and filters by category', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Gear for the everyday');
    await expect(page.getByTestId('product-count')).toHaveText('36 products');

    await page
      .getByRole('navigation', { name: 'Categories' })
      .getByRole('link', { name: 'Footwear' })
      .click();
    await expect(page.getByRole('heading', { name: 'Footwear' })).toBeVisible();
    await expect(page.getByTestId('product-count')).toHaveText('6 products');
  });

  test('shows a product page', async ({ page }) => {
    await page.goto('/products/aurora-anc-headphones');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Aurora ANC Wireless Headphones',
    );
    await expect(page.getByText('$199.00').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Specifications' })).toBeVisible();
  });
});

test.describe('assistant', () => {
  test('flow 1: search, then add to cart from a product card', async ({ page }) => {
    await page.goto('/');
    await openAssistant(page);

    await say(page, 'show me headphones');
    const cards = assistant(page).locator('.asa-card');
    await expect(cards).toHaveCount(2);
    const pulse = cards.filter({ hasText: 'Pulse Studio Wired Headphones' });
    await expect(pulse.getByText('$89.00')).toBeVisible();

    await pulse.getByRole('button', { name: 'Add to cart' }).click();
    await expect(assistant(page).getByText('Added to your cart.')).toBeVisible();

    // The click was sent as a normal shopper message, and the cart is the store's.
    await expect(
      assistant(page).getByText('Add "Pulse Studio Wired Headphones" to my cart.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cart, 1 items' })).toBeVisible();
    await expect(assistant(page).locator('.asa-total dd').last()).toHaveText('$89.00');
  });

  test('flow 2: compare two products', async ({ page }) => {
    await page.goto('/');
    await openAssistant(page);

    await say(page, 'compare the aurora and pulse headphones');
    const table = assistant(page).getByRole('table', { name: 'Product comparison' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader')).toHaveText([
      'Feature',
      'Aurora ANC Wireless Headphones',
      'Pulse Studio Wired Headphones',
    ]);
    await expect(table.getByRole('row', { name: /^Price/ }).getByRole('cell')).toHaveText([
      '$199.00',
      '$89.00',
    ]);
    await expect(
      table.getByRole('row', { name: /^Noise cancelling/ }).getByRole('cell'),
    ).toHaveText(['Yes', 'No']);
  });

  test('flow 3: apply a discount code', async ({ page }) => {
    await page.goto('/');
    await openAssistant(page);

    await say(page, 'add the skillet to my cart');
    await expect(page.getByRole('button', { name: 'Cart, 1 items' })).toBeVisible();

    // A code the store rejects changes nothing.
    await say(page, 'apply code BOGUS99');
    await expect(assistant(page).getByText('Sorry, that code did not work.')).toBeVisible();
    await expect(assistant(page).locator('.asa-discount')).toHaveCount(0);

    // A valid code: the discount and the new total come from the store.
    await say(page, 'apply code WELCOME10');
    await expect(assistant(page).getByText('Your code is applied.')).toBeVisible();
    const summary = assistant(page).locator('.asa-cart').last();
    await expect(summary.locator('.asa-discount')).toContainText('WELCOME10');
    await expect(summary.locator('.asa-discount dd')).toHaveText('−$4.50');
    await expect(summary.locator('.asa-total dd')).toHaveText('$40.50');
  });

  test('asks which variant, then hands off to the store checkout', async ({ page }) => {
    await page.goto('/');
    await openAssistant(page);

    await say(page, 'add the aurora headphones');
    const options = assistant(page).getByRole('group', { name: /Choose an option/ });
    await expect(options.getByRole('button', { name: /Sand/ })).toBeDisabled();
    await options.getByRole('button', { name: 'Black' }).click();
    await expect(assistant(page).getByText('Black · Qty 1')).toBeVisible();

    await say(page, 'checkout');
    const link = assistant(page).getByRole('link', { name: 'Go to checkout' });
    await expect(link).toHaveAttribute('href', /\/checkout\/cart_/);
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('keeps the conversation and cart when moving between pages', async ({ page }) => {
    await page.goto('/');
    await openAssistant(page);
    await say(page, 'add the skillet to my cart');

    await page.goto('/products/aurora-anc-headphones');
    await page.getByRole('button', { name: 'Open shopping assistant' }).click();
    await expect(assistant(page).getByText('add the skillet to my cart')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cart, 1 items' })).toBeVisible();

    // The server still has the cart too, not just the browser.
    await say(page, 'show my cart');
    await expect(assistant(page).locator('.asa-cart').last()).toContainText(
      'Ember 10" Cast Iron Skillet',
    );
  });

  test('offers starter suggestions and can be closed with Escape', async ({ page }) => {
    await page.goto('/');
    await openAssistant(page);

    const suggestions = assistant(page).getByRole('group', { name: 'Suggestions' });
    await expect(suggestions.getByRole('button')).toHaveCount(3);
    await suggestions.getByRole('button', { name: 'Show my cart' }).click();
    await expect(assistant(page).getByText('Your cart is empty.')).toBeVisible();
    await expect(suggestions).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(assistant(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open shopping assistant' })).toBeFocused();
  });

  test('is isolated from the page: its styles and the page styles do not mix', async ({ page }) => {
    await page.goto('/');
    await openAssistant(page);
    const isolation = await page.evaluate(() => {
      const host = document.querySelector('[data-agentic-shop-widget]');
      return {
        hasShadowRoot: Boolean(host?.shadowRoot),
        widgetNodesInPage: document.querySelectorAll('.asa-panel, .asa-launcher').length,
        widgetStylesInHead: [...document.querySelectorAll('style')].filter((style) =>
          style.textContent?.includes('.asa-launcher'),
        ).length,
      };
    });
    expect(isolation).toEqual({ hasShadowRoot: true, widgetNodesInPage: 0, widgetStylesInHead: 0 });
  });
});

test.describe('accessibility', () => {
  test('storefront and open assistant have no serious axe violations', async ({ page }) => {
    await page.goto('/');
    await openAssistant(page);
    await say(page, 'show me headphones');
    await say(page, 'compare the aurora and pulse headphones');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => ({
        id: violation.id,
        help: violation.help,
        nodes: violation.nodes.map((node) => node.target.join(' ')),
      }));
    expect(serious).toEqual([]);
  });

  test('product page has no serious axe violations', async ({ page }) => {
    await page.goto('/products/aurora-anc-headphones');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      results.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
  });
});

test.describe('small screens', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  // Operating systems ship different fonts, and a wider one must not break the layout.
  // (This is how the suite first failed on Linux CI while passing on Windows.)
  test('at 360px the storefront does not scroll sideways with a wider font', async ({ page }) => {
    for (const path of ['/', '/products/aurora-anc-headphones']) {
      await page.goto(path);
      await page.addStyleTag({
        content: "*, body { font-family: 'Courier New', monospace !important; }",
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });

  test('at 360px the storefront does not scroll sideways and the assistant fills the screen', async ({
    page,
  }) => {
    await page.goto('/');
    const pageOverflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await pageOverflow()).toBeLessThanOrEqual(0);

    await openAssistant(page);
    await say(page, 'show me headphones');
    await say(page, 'compare the aurora and pulse headphones');

    const box = await assistant(page).boundingBox();
    expect(box).toEqual({ x: 0, y: 0, width: 360, height: 640 });
    expect(await pageOverflow()).toBeLessThanOrEqual(0);

    // Nothing inside the panel sticks out, apart from the table, which scrolls in its own box.
    const sticking = await page.evaluate(() => {
      const root = document.querySelector('[data-agentic-shop-widget]')!.shadowRoot!;
      return [...root.querySelectorAll('.asa-panel *')].filter((element) => {
        if (element.closest('.asa-table-wrap')) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1);
      }).length;
    });
    expect(sticking).toBe(0);

    // Controls stay comfortably tappable.
    const send = page.getByRole('button', { name: 'Send' });
    expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  });
});
