import { defineConfig, devices } from '@playwright/test';

const webPort = process.env.E2E_WEB_PORT ?? '3100';
const baseURL = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The whole stack with a scripted model: deterministic, offline and free.
  webServer: {
    command: 'node e2e/start-stack.mjs',
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },
});
