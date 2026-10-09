import { useWidget } from '../context';
import { formatMoney, formatValue } from '../format';
import type { ProductComparison } from '../types';

export function ComparisonTable({ comparison }: { comparison: ProductComparison }) {
  const { t, locale } = useWidget();
  const { products, rows } = comparison;
  if (products.length === 0) return null;

  return (
    // Wide tables scroll inside their own region so the panel never scrolls sideways.
    <div className="asa-table-wrap" role="region" aria-label={t('compare')} tabIndex={0}>
      <table className="asa-table">
        <caption className="asa-visually-hidden">{t('compare')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('feature')}</th>
            {products.map((product) => (
              <th scope="col" key={product.productId}>
                {product.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{t('price')}</th>
            {products.map((product) => (
              <td key={product.productId}>{formatMoney(product.price, locale)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">{t('availability')}</th>
            {products.map((product) => (
              <td key={product.productId}>{product.inStock ? t('inStock') : t('outOfStock')}</td>
            ))}
          </tr>
          {rows.map((row) => (
            <tr key={row.attribute} className={row.differs ? 'asa-differs' : undefined}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, index) => (
                <td key={products[index]?.productId ?? index}>
                  {formatValue(value, t('yes'), t('no'))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
