import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** ESM library build: the React component, with React left to the host application. */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'] },
    sourcemap: true,
    emptyOutDir: true,
  },
  test: {
    environment: 'happy-dom',
    // Threads start faster than forked processes, which timed out on small, busy machines.
    pool: 'threads',
    // Process CSS so the `styles.css?inline` import holds the real stylesheet in tests.
    css: true,
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
    // The flow tests type into a real UI against a real server; give them room on busy CI machines.
    testTimeout: 30_000,
  },
});
