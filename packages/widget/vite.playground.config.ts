import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Local playground for developing the widget. The chat API is proxied to the
 * chat server, so the page and the API share an origin. The proxy drops the
 * Origin header, which makes the request look like a same-origin server call,
 * so ALLOWED_ORIGINS does not need to include the playground.
 */
export default defineConfig({
  root: 'playground',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (request) => request.removeHeader('origin'));
        },
      },
    },
  },
});
