import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { CATEGORIES, categoryName, listProducts } from '@/lib/store';

interface HomeProps {
  searchParams: Promise<{ category?: string; q?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const category = params.category && params.category in CATEGORIES ? params.category : undefined;
  const query = params.q?.trim() ? params.q.trim().slice(0, 200) : undefined;
  const products = await listProducts({ category, query });

  const heading = query
    ? `Results for “${query}”`
    : category
      ? categoryName(category)
      : 'All products';

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Demo storefront</p>
          <h1>Gear for the everyday and the outdoors.</h1>
          <p className="lede">
            Browse the shelves, or open the assistant in the corner and just ask:{' '}
            <em>“wireless headphones under $150”</em>, <em>“compare these two”</em>,{' '}
            <em>“add the black one”</em>.
          </p>
        </div>
        <form className="search" action="/" role="search">
          <label htmlFor="search" className="visually-hidden">
            Search products
          </label>
          <input
            id="search"
            type="search"
            name="q"
            placeholder="Search products"
            defaultValue={query}
          />
          <button type="submit">Search</button>
        </form>
      </section>

      <nav className="chips" aria-label="Categories">
        <Link href="/" aria-current={!category && !query ? 'page' : undefined}>
          All
        </Link>
        {Object.entries(CATEGORIES).map(([slug, name]) => (
          <Link
            key={slug}
            href={`/?category=${slug}`}
            aria-current={category === slug ? 'page' : undefined}
          >
            {name}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="results-heading">
        <div className="section-head">
          <h2 id="results-heading">{heading}</h2>
          <p className="muted" data-testid="product-count">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </p>
        </div>
        {products.length > 0 ? (
          <ul className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ul>
        ) : (
          <p className="empty">
            Nothing matches that. <Link href="/">See everything</Link>, or ask the assistant.
          </p>
        )}
      </section>
    </>
  );
}
