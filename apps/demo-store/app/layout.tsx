import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { chatApiUrl } from '@/lib/store';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Larkspur Supply', template: '%s · Larkspur Supply' },
  description: 'A demo storefront for the Agentic Shopping Assistant.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// Rendered per request, so the catalogue and the chat server URL come from the
// environment at run time and one build works anywhere.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="container site-header-inner">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true" />
              Larkspur Supply
            </Link>
            <nav aria-label="Main">
              <Link href="/">Shop</Link>
              <Link href="/?category=electronics">Electronics</Link>
              <Link href="/?category=sports-outdoors">Outdoors</Link>
            </nav>
          </div>
        </header>

        <main id="main" className="container">
          {children}
        </main>

        <footer className="site-footer">
          <div className="container">
            <p>
              Larkspur Supply is a fictional shop. It demonstrates the{' '}
              <strong>Agentic Shopping Assistant</strong>: open the chat in the corner and ask it to
              find, compare or add products.
            </p>
          </div>
        </footer>

        {/* The same one-line embed a real store would add to its pages. */}
        <script
          src="/widget.js"
          data-store-id="demo"
          data-api-url={chatApiUrl()}
          data-primary-color="#0f766e"
          async
        />
      </body>
    </html>
  );
}
