'use client';

/** Shown when the catalogue cannot be loaded, typically because the store API is not running. */
export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="notice-page" role="alert">
      <h1>The shop is not answering right now</h1>
      <p>
        The storefront could not reach the store API. If you are running the demo locally, make sure{' '}
        <code>pnpm dev</code> is running and <code>STORE_API_BASE_URL</code> points at the store.
      </p>
      <button type="button" className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
