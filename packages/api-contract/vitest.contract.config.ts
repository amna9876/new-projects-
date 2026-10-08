import { defineConfig } from 'vitest/config';

// Runs the contract suite against a live store (see contract/run.contract.ts).
export default defineConfig({
  test: {
    include: ['contract/**/*.contract.ts'],
    testTimeout: 15_000,
  },
});
