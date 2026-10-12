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
          `<text x="200" y="${206 + index * 34}" text-anchor="middle">${escapeXml(line)}</text>`,
      )
      .join('');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${escapeXml(product.title)}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="hsl(${hue} 70% 94%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 84%)"/>` +
      `</linearGradient></defs>` +
      `<rect width="400" height="400" fill="url(#g)"/>` +
      `<circle cx="330" cy="70" r="110" fill="hsl(${hue} 70% 78% / 0.45)"/>` +
      `<circle cx="60" cy="350" r="90" fill="hsl(${(hue + 40) % 360} 65% 72% / 0.4)"/>` +
      `<circle cx="200" cy="104" r="46" fill="hsl(${hue} 55% 52%)"/>` +
      `<text x="200" y="121" text-anchor="middle" font-family="system-ui, sans-serif" font-size="46" font-weight="700" fill="#fff">${escapeXml(product.title.charAt(0))}</text>` +
      `<g font-family="system-ui, sans-serif" font-size="26" font-weight="600" fill="hsl(${hue} 45% 22%)">${lines}</g>` +
      `</svg>`;

    return c.body(svg, 200, {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    });
  });

  return app;
}
