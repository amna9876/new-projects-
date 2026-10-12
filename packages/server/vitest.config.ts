import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Threads start faster than forked processes, which timed out on small, busy machines.
    pool: 'threads',
    // These tests stream real responses through the whole server; allow for slow, busy machines.
    testTimeout: 30_000,
  },
});
