import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import type { ChatController, ChatError } from '../chat/client';
import { WidgetProvider, type WidgetContextValue } from '../context';
import { createTranslator, directionOf, type Strings, type Translate } from '../i18n/index';
import { CartSummary } from '../results/CartSummary';
import { MessageList } from './Messages';

export const MAX_MESSAGE_CHARS = 2000;

export interface WidgetProps {
  client: ChatController;
  /** UI language (BCP 47). Decides the strings and the text direction. */
  language?: string;
  /** Corner of the screen. In right-to-left languages the corner is mirrored. */
  position?: 'bottom-right' | 'bottom-left';
  /** First message shown. Defaults to the built-in greeting for the language. */
  greeting?: string;
  /** Starter prompts shown before the first message. Pass an empty array to hide them. */
  suggestions?: string[];
  /** Replace individual UI strings. */
  strings?: Partial<Strings>;
  defaultOpen?: boolean;
}

function errorText(error: ChatError, t: Translate): string {
  if (error.kind === 'rate_limited') {
    return t('errorRateLimited', { seconds: error.retryAfterSeconds });
  }
  if (error.kind === 'offline') return t('errorOffline');
  if (error.kind === 'busy') return t('errorBusy');
  return t('errorGeneric');
}

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
    />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const CartIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 4h2l2.4 11h10.2L20 7H6.2M9 20h.01M17 20h.01"
    />
  </svg>
);

/** The whole widget: launcher button, chat panel, cart drawer and composer. */
export function Widget(props: WidgetProps) {
  const { client, position = 'bottom-right', defaultOpen = false } = props;
  const language = props.language ?? 'en';
  const t = useMemo(() => createTranslator(language, props.strings), [language, props.strings]);
  const state = useSyncExternalStore(client.subscribe, client.getState, client.getState);

  const [open, setOpen] = useState(defaultOpen);
  const [cartOpen, setCartOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const panelId = useId();
  const cartId = useId();
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(open);

  const busy = state.status !== 'idle';
  // Buttons that send a message (cards, variants, suggestions) get disabled or removed while
  // the answer streams, which would strand keyboard focus. Park it in the message field instead.
  const send = useCallback(
    (text: string) => {
      void client.send(text);
      input.current?.focus();
    },
    [client],
  );
  const context = useMemo<WidgetContextValue>(
    () => ({ t, locale: language, send, busy }),
    [t, language, send, busy],
  );

  // Focus follows the panel: into the input when it opens, back to the launcher when it closes.
  useEffect(() => {
    if (open) input.current?.focus();
    else if (wasOpen.current) launcher.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Escape closes the panel even when focus has fallen back to the page body
  // (for example after clicking empty space inside the panel).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const rootNode = root.current?.getRootNode();
      const host = rootNode instanceof ShadowRoot ? rootNode.host : root.current;
      const active = document.activeElement;
      if (active === document.body || active === null || host?.contains(active)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    send(text);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter makes a new line. Ignore Enter while an IME is composing.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
    }
  }

  const itemCount = state.cart?.itemCount ?? 0;

  return (
    <WidgetProvider value={context}>
      <div
        ref={root}
        className={`asa-root asa-${position}`}
        dir={directionOf(language)}
        lang={language}
        data-open={open}
        data-busy={busy}
      >
        {open ? (
          <section
            id={panelId}
            className="asa-panel"
            role="dialog"
            aria-label={t('title')}
            onKeyDown={onPanelKeyDown}
          >
            <header className="asa-header">
              <div className="asa-heading">
                <h2 className="asa-title">{t('title')}</h2>
                <p className="asa-subtitle">{t('subtitle')}</p>
              </div>
              <button
                type="button"
                className="asa-icon-button"
                aria-label={t('cartCount', { count: itemCount })}
                aria-expanded={cartOpen}
                aria-controls={cartId}
                onClick={() => setCartOpen((value) => !value)}
              >
                <CartIcon />
                {itemCount > 0 ? <span className="asa-badge">{itemCount}</span> : null}
              </button>
              <button
                type="button"
                className="asa-icon-button"
                aria-label={t('close')}
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </header>

            {cartOpen ? (
              <div id={cartId} className="asa-drawer" role="region" aria-label={t('cart')}>
                {state.cart ? (
                  <CartSummary cart={state.cart} />
                ) : (
                  <p className="asa-cart-empty">{t('cartEmpty')}</p>
                )}
              </div>
            ) : null}

            <MessageList
              state={state}
              greeting={props.greeting ?? t('greeting')}
              suggestions={
                props.suggestions ?? [
                  t('suggestionBestRated'),
                  t('suggestionGift'),
                  t('suggestionCart'),
                ]
              }
            />

            {state.error ? (
              <div className="asa-error" role="alert">
                <span>{errorText(state.error, t)}</span>
                <button
                  type="button"
                  className="asa-button"
                  disabled={busy}
                  onClick={() => void client.retry()}
                >
                  {t('retry')}
                </button>
              </div>
            ) : null}

            <form className="asa-composer" onSubmit={submit}>
              <textarea
                ref={input}
                className="asa-input"
                rows={1}
                value={draft}
                maxLength={MAX_MESSAGE_CHARS}
                placeholder={t('placeholder')}
                aria-label={t('messageLabel')}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onInputKeyDown}
              />
              <button
                type="submit"
                className="asa-button asa-button-primary"
                disabled={busy || !draft.trim()}
              >
                {t('send')}
              </button>
            </form>
          </section>
        ) : null}

        <button
          ref={launcher}
          type="button"
          className="asa-launcher"
          aria-label={open ? t('closeAssistant') : t('open')}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon /> : <ChatIcon />}
        </button>
      </div>
    </WidgetProvider>
  );
}
