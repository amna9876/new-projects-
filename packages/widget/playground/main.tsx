import { mount } from '../src/index';

const params = new URLSearchParams(location.search);

// Same origin as this page: Vite proxies /api to the chat server (see vite.playground.config.ts).
mount({
  apiUrl: location.origin,
  storeId: 'playground',
  language: params.get('lang') ?? 'en',
  position: params.get('position') === 'bottom-left' ? 'bottom-left' : 'bottom-right',
  primaryColor: params.get('color') ?? undefined,
});
