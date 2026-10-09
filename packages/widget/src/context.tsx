import { createContext, useContext } from 'react';
import type { Translate } from './i18n/index';

export interface WidgetContextValue {
  t: Translate;
  /** BCP 47 tag used for number and currency formatting. */
  locale: string;
  /** Sends a message as the shopper. */
  send: (text: string) => void;
  /** True while an answer is in progress; actions that send messages are disabled. */
  busy: boolean;
}

const WidgetContext = createContext<WidgetContextValue | null>(null);

export const WidgetProvider = WidgetContext.Provider;

export function useWidget(): WidgetContextValue {
  const value = useContext(WidgetContext);
  if (!value) throw new Error('Widget components must be rendered inside <WidgetProvider>.');
  return value;
}
