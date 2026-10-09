import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // These tests stream real responses through the whole server; allow for slow, busy machines.
    testTimeout: 30_000,
  },
});
