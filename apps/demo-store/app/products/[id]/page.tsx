import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatAttribute, formatMoney, humanise } from '@/lib/format';
import { categoryName, findProduct } from '@/lib/store';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await findProduct((await params).id);
  return { title: product?.title ?? 'Product not found' };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await findProduct((await params).id);
  if (!product) notFound();

  const attributes = Object.entries(product.attributes);
  const hasChoices = product.variants.length > 1;

  return (
    <article className="product">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Shop</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/?category=${product.category}`}>{categoryName(product.category)}</Link>
      </nav>

      <div className="product-layout">
        <div className="product-media">
          {product.images[0] ? (
            <img src={product.images[0]} alt="" width={400} height={400} />
          ) : null}
        </div>

        <div className="product-info">
          {product.brand ? <p className="eyebrow">{product.brand}</p> : null}
          <h1>{product.title}</h1>

          <p className="price price-large">
            <span>{formatMoney(product.price)}</span>
            {product.compareAtPrice ? <s>{formatMoney(product.compareAtPrice)}</s> : null}
          </p>

          <p className="stock">
            <span className={product.inStock ? 'dot dot-ok' : 'dot dot-out'} aria-hidden="true" />
            {product.inStock ? 'In stock' : 'Out of stock'}
            {product.rating ? (
              <span className="muted">
                {' '}
                · ★ {product.rating.average} ({product.rating.count.toLocaleString('en-US')}{' '}
                reviews)
              </span>
            ) : null}
          </p>

          <p className="description">{product.description}</p>

          {hasChoices ? (
            <section aria-labelledby="options-heading">
              <h2 id="options-heading">Options</h2>
              <ul className="options">
                {product.variants.map((variant) => (
                  <li key={variant.id} className={variant.inStock ? undefined : 'unavailable'}>
                    <span>{variant.title}</span>
                    <span className="muted">
                      {variant.inStock ? formatMoney(variant.price) : 'Sold out'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="assistant-hint">
            Want it? Open the assistant in the corner and say{' '}
            <em>“add the {product.title} to my cart”</em>.
          </p>
        </div>
      </div>

      {attributes.length > 0 ? (
        <section aria-labelledby="specs-heading" className="specs">
          <h2 id="specs-heading">Specifications</h2>
          <dl>
            {attributes.map(([key, value]) => (
              <div key={key}>
                <dt>{humanise(key)}</dt>
                <dd>{formatAttribute(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </article>
  );
}
