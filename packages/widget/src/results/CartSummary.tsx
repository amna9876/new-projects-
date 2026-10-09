import { useWidget } from '../context';
import { formatMoney } from '../format';
import type { CartView, CheckoutLink } from '../types';
import { ProductImage } from './ProductCard';

/** The cart exactly as the store returned it. Every figure here was computed by the store. */
export function CartSummary({ cart }: { cart: CartView }) {
  const { t, locale } = useWidget();

  if (cart.items.length === 0) {
    return <p className="asa-cart-empty">{t('cartEmpty')}</p>;
  }

  return (
    <div className="asa-cart">
      <ul className="asa-cart-lines">
        {cart.items.map((item) => (
          <li key={item.itemId} className="asa-cart-line">
            <ProductImage src={item.image} className="asa-cart-image" />
            <span className="asa-cart-name">
              <span>{item.title}</span>
              <span className="asa-muted">
                {item.variantTitle ? `${item.variantTitle} · ` : ''}
                {t('quantity', { count: item.quantity })}
              </span>
            </span>
            <span className="asa-cart-amount">{formatMoney(item.lineTotal, locale)}</span>
          </li>
        ))}
      </ul>
      <dl className="asa-totals">
        <div>
          <dt>{t('subtotal')}</dt>
          <dd>{formatMoney(cart.totals.subtotal, locale)}</dd>
        </div>
        {cart.discounts.map((discount) => (
          <div key={discount.code} className="asa-discount">
            <dt>
              {t('discount')} <span className="asa-code">{discount.code}</span>
            </dt>
            <dd>−{formatMoney(discount.amount, locale)}</dd>
          </div>
        ))}
        <div className="asa-total">
          <dt>{t('total')}</dt>
          <dd>{formatMoney(cart.totals.total, locale)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Hand-off to the store's own checkout. The widget never collects payment details. */
export function CheckoutButton({ checkout }: { checkout: CheckoutLink }) {
  const { t } = useWidget();
  return (
    <div className="asa-checkout">
      <a
        className="asa-button asa-button-primary"
        href={checkout.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('checkout')}
      </a>
      <span className="asa-muted">{t('checkoutHint')}</span>
    </div>
  );
}
