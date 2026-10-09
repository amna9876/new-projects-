import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChatClient, type ChatStorage } from './chat/client';
import { Widget, type WidgetProps } from './components/Widget';
import { parseHexColor, readableTextOn } from './format';
import styles from './styles.css?inline';

export interface ShoppingAssistantProps extends Omit<WidgetProps, 'client'> {
  /** Base URL of the chat server. */
  apiUrl: string;
  /** Namespaces the saved conversation. Use one id per store. */
  storeId?: string;
  /** Brand colour as a hex value, for example `#0f766e`. */
  primaryColor?: string;
  fetch?: typeof fetch;
  storage?: ChatStorage | null;
}

/**
 * The embeddable assistant as a React component. It renders into its own
 * Shadow DOM, so the host page's CSS cannot break it and its CSS cannot leak out.
 */
export function ShoppingAssistant(props: ShoppingAssistantProps) {
  const { apiUrl, storeId, primaryColor, fetch: fetchImpl, storage, ...widgetProps } = props;
  const host = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);

  const client = useMemo(
    () => new ChatClient({ apiUrl, storeId, fetch: fetchImpl, storage }),
    [apiUrl, storeId, fetchImpl, storage],
  );

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    // Reuse an existing root: React runs effects twice in development.
    setShadow(element.shadowRoot ?? element.attachShadow({ mode: 'open' }));
  }, []);

  useEffect(() => {
    const element = host.current;
    const color = parseHexColor(primaryColor);
    if (!element) return;
    if (color) {
      element.style.setProperty('--asa-primary', color);
      element.style.setProperty('--asa-on-primary', readableTextOn(color));
    } else {
      element.style.removeProperty('--asa-primary');
      element.style.removeProperty('--asa-on-primary');
    }
  }, [primaryColor]);

  return (
    <div ref={host} data-agentic-shop-widget="">
      {shadow
        ? createPortal(
            <>
              <style>{styles}</style>
              <Widget client={client} {...widgetProps} />
            </>,
            shadow,
          )
        : null}
    </div>
  );
}
