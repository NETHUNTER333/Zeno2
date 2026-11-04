import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://kinich.app';
const isLocal = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 75_000, // Generous 75s timeout for live external queries
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'pixel-7',
      use: { ...devices['Pixel 7'] },
    },
  ],
  ...(isLocal
    ? {
        webServer: {
          command: 'npx tsx server.ts --port 3000',
          url: 'http://localhost:3000/api/health',
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      }
    : {}),
});
