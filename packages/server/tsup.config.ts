import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  // main: the runnable server. index: the library entry (createServer). testing: the scripted model.
  entry: ['src/main.ts', 'src/index.ts', 'src/testing.ts'],
  format: ['esm'],
  target: 'node20',
  dts: { entry: ['src/index.ts', 'src/testing.ts'] },
  clean: !options.watch,
  sourcemap: true,
}));
