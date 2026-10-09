import { useWidget } from '../context';
import { formatMoney } from '../format';
import type { VariantChoice } from '../types';

/** Shown when the agent needs to know which variant to add. Choosing one sends a message. */
export function VariantPicker({ choice }: { choice: VariantChoice }) {
  const { t, locale, send, busy } = useWidget();
  const samePrice = choice.options.every(
    (option) => option.price.amount === choice.options[0]?.price.amount,
  );

  return (
    <div
      className="asa-variants"
      role="group"
      aria-label={t('chooseOption', { title: choice.productTitle })}
    >
      {choice.options.map((option) => (
        <button
          key={option.variantId}
          type="button"
          className="asa-button asa-chip"
          disabled={busy || !option.inStock}
          onClick={() =>
            send(t('addVariantMessage', { title: choice.productTitle, variant: option.title }))
          }
        >
          {option.title}
          {samePrice ? '' : ` · ${formatMoney(option.price, locale)}`}
          {option.inStock ? '' : ` (${t('outOfStock')})`}
        </button>
      ))}
    </div>
  );
}
