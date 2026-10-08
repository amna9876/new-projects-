import { Hono } from 'hono';
import { notFound } from '../errors';
import type { MockStore } from '../store';

const CATEGORY_HUES: Record<string, number> = {
  electronics: 220,
  apparel: 280,
  footwear: 20,
  'home-kitchen': 160,
  beauty: 330,
  'sports-outdoors': 100,
};

const escapeXml = (value: string) =>
  value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Splits a title into at most three short lines for the placeholder image. */
function wrap(title: string, maxChars = 18): string[] {
  const lines: string[] = [];
  for (const word of title.split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= maxChars) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines.slice(0, 3);
}

/** Serves generated SVG placeholders so the demo needs no external image host. */
export function imageRoutes(store: MockStore): Hono {
  const app = new Hono();

  app.get('/images/:file', (c) => {
    const file = c.req.param('file');
    if (!file.endsWith('.svg')) throw notFound('Image');
    const product = store.getProduct(file.slice(0, -'.svg'.length));

    const hue = CATEGORY_HUES[product.category] ?? 200;
    const lines = wrap(product.title)
      .map(
        (line, index) =>
          `<text x="200" y="${190 + index * 34}" text-anchor="middle">${escapeXml(line)}</text>`,
      )
      .join('');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${escapeXml(product.title)}">` +
      `<rect width="400" height="400" fill="hsl(${hue} 45% 92%)"/>` +
      `<circle cx="200" cy="96" r="44" fill="hsl(${hue} 50% 62%)"/>` +
      `<g font-family="system-ui, sans-serif" font-size="26" font-weight="600" fill="hsl(${hue} 40% 24%)">${lines}</g>` +
      `</svg>`;

    return c.body(svg, 200, {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    });
  });

  return app;
}
