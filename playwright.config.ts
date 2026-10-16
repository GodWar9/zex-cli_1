import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', workers: 1, fullyParallel: false,
  timeout: 30_000, retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3151', trace: 'retain-on-failure' },
  webServer: {
    command: 'node --experimental-strip-types tests/e2e/server.ts',
    url: 'http://127.0.0.1:3151/v1/health', reuseExistingServer: false,
    timeout: 60_000,
  },
});
