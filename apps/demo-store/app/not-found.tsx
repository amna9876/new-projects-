import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="notice-page">
      <h1>We could not find that page</h1>
      <p>The product may have been removed, or the link is wrong.</p>
      <Link href="/" className="button">
        Back to the shop
      </Link>
    </section>
  );
}
