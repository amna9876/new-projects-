import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  // server: the runnable app. index: the library entry used by other packages' tests.
  entry: ['src/server.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: { entry: 'src/index.ts' },
  clean: !options.watch,
  sourcemap: true,
}));
