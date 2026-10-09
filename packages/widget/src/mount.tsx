import { createRoot } from 'react-dom/client';
import { ShoppingAssistant, type ShoppingAssistantProps } from './ShoppingAssistant';

export interface MountedWidget {
  /** The element added to the page; the widget lives in its shadow root. */
  host: HTMLElement;
  unmount(): void;
}

/** Adds the widget to the page without the host application needing React. */
export function mount(
  options: ShoppingAssistantProps,
  parent: HTMLElement = document.body,
): MountedWidget {
  const host = document.createElement('div');
  parent.appendChild(host);
  const root = createRoot(host);
  root.render(<ShoppingAssistant {...options} />);
  return {
    host,
    unmount() {
      root.unmount();
      host.remove();
    },
  };
}

/** A trimmed attribute value, or undefined when it is missing or blank. */
function attribute(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/** Reads widget options from an element's `data-*` attributes. */
export function optionsFromDataset(
  dataset: DOMStringMap,
  pageLanguage?: string,
): ShoppingAssistantProps | undefined {
  const apiUrl = attribute(dataset.apiUrl);
  if (!apiUrl) return undefined;
  return {
    apiUrl,
    storeId: attribute(dataset.storeId),
    primaryColor: attribute(dataset.primaryColor),
    position: dataset.position === 'bottom-left' ? 'bottom-left' : 'bottom-right',
    greeting: attribute(dataset.greeting),
    language: attribute(dataset.language) ?? attribute(pageLanguage) ?? 'en',
  };
}
