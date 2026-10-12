import { useState } from 'react';
import { useWidget } from '../context';
import { formatMoney } from '../format';
import { isHttpUrl } from '../guards';
import type { ProductSummary } from '../types';

/** Product image with a neutral placeholder when the URL is missing, unsafe or fails to load. */
export function ProductImage({ src, className }: { src?: string; className: string }) {
  const [broken, setBroken] = useState(false);
  if (!isHttpUrl(src) || broken) {
    return <div className={`${className} asa-image-placeholder`} aria-hidden="true" />;
  }
  // Decorative: the product title is always rendered as text next to the image.
  return (
    <img className={className} src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
  );
}

export function ProductCard({ product }: { product: ProductSummary }) {
  const { t, locale, send, busy } = useWidget();

  return (
    <li className="asa-card">
      <div className="asa-card-media">
        <ProductImage src={product.image} className="asa-card-image" />
        {product.compareAtPrice && product.inStock ? (
          <span className="asa-tag">{t('sale')}</span>
        ) : null}
      </div>
      <div className="asa-card-body">
        {product.brand ? <span className="asa-card-brand">{product.brand}</span> : null}
        <span className="asa-card-title">{product.title}</span>
        <span className="asa-card-price">
          <span>{formatMoney(product.price, locale)}</span>
          {product.compareAtPrice ? <s>{formatMoney(product.compareAtPrice, locale)}</s> : null}
        </span>
        <span className="asa-card-meta">
          {product.rating ? (
            <span
              aria-label={t('rating', {
                average: product.rating.average,
                count: product.rating.count,
              })}
            >
              ★ {product.rating.average}
            </span>
          ) : null}
          {product.variantCount > 1 ? (
            <span>{t('options', { count: product.variantCount })}</span>
          ) : null}
          {product.inStock ? null : <span className="asa-out">{t('outOfStock')}</span>}
        </span>
        <button
          type="button"
          className="asa-button asa-button-primary"
          disabled={busy || !product.inStock}
          onClick={() => send(t('addToCartMessage', { title: product.title }))}
        >
          {product.inStock ? t('addToCart') : t('outOfStock')}
        </button>
      </div>
    </li>
  );
}

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  if (products.length === 0) return null;
  return (
    <ul className="asa-grid">
      {products.map((product) => (
        <ProductCard key={product.productId} product={product} />
      ))}
    </ul>
  );
}
