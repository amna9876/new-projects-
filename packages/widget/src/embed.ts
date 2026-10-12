/**
 * Entry point of the standalone script:
 *
 *   <script src="/widget.js" data-store-id="demo" data-api-url="https://your-server" async></script>
 *
 * The script reads its own data-* attributes and mounts the widget. For pages
 * that load it another way, `window.AgenticShopWidget.mount(options)` is available.
 */
import { mount, optionsFromDataset, type MountedWidget } from './mount';

export { mount } from './mount';

// Captured synchronously: `document.currentScript` is only set while the script first runs.
// Some loaders (module wrappers, tag managers) leave it empty, so fall back to the tag itself.
const script =
  (document.currentScript as HTMLScriptElement | null) ??
  document.querySelector<HTMLScriptElement>('script[data-api-url]');

let mounted: MountedWidget | undefined;

function autoMount() {
  if (mounted || !script) return;
  const options = optionsFromDataset(script.dataset, document.documentElement.lang);
  if (!options) {
    console.warn('[agentic-shop] The widget script needs a data-api-url attribute.');
    return;
  }
  mounted = mount(options);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoMount, { once: true });
} else {
  autoMount();
}
