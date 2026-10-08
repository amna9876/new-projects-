import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // Keep the previous build while watching so dependants never see an empty dist/.
  clean: !options.watch,
  sourcemap: true,
}));
