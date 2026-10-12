import type { Product } from '@agentic-shop/api-contract';
import Link from 'next/link';
import { formatMoney } from '@/lib/format';
import { categoryName } from '@/lib/store';

export function ProductCard({ product }: { product: Product }) {
  return (
    <li className="product-card">
      <Link href={`/products/${encodeURIComponent(product.id)}`} className="product-card-link">
        <div className="product-card-media">
          {product.images[0] ? (
            // Catalogue images come from the store's own host; a plain img keeps the demo simple.
            <img src={product.images[0]} alt="" loading="lazy" width={400} height={400} />
          ) : null}
          {product.compareAtPrice && product.inStock ? <span className="tag">Sale</span> : null}
          {product.inStock ? null : <span className="tag tag-muted">Sold out</span>}
        </div>
        <div className="product-card-body">
          <span className="eyebrow">{categoryName(product.category)}</span>
          <h3>{product.title}</h3>
          <p className="price">
            <span>{formatMoney(product.price)}</span>
            {product.compareAtPrice ? <s>{formatMoney(product.compareAtPrice)}</s> : null}
          </p>
          {product.rating ? (
            <p className="rating">
              <span aria-hidden="true">★</span> {product.rating.average}
              <span className="muted"> ({product.rating.count.toLocaleString('en-US')})</span>
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
