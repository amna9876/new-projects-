import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  // main: the runnable server. index: the library entry (createServer) for tests and embedding.
  entry: ['src/main.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: { entry: 'src/index.ts' },
  clean: !options.watch,
  sourcemap: true,
}));
