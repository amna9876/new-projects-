import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
    'contract-tests/index': 'src/contract-tests/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  // In watch mode, keep the previous build in place: apps that depend on this
  // package start at the same time and would otherwise find dist/ empty.
  clean: !options.watch,
  sourcemap: true,
  external: ['vitest'],
}));
