import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Standalone script build: one self-contained file for `<script src="widget.js">`. */
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: {
      entry: 'src/embed.ts',
      formats: ['iife'],
      name: 'AgenticShopWidget',
      fileName: () => 'widget.js',
    },
    sourcemap: true,
    // Keep the ESM build produced by vite.config.ts.
    emptyOutDir: false,
  },
});
