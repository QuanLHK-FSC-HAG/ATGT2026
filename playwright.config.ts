import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3001';
// Server is managed by preview_start, not Playwright. Never target a hosted URL.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: '.runtime/playwright-results',
  reporter: [['list'], ['html', { outputFolder: '.runtime/playwright-report', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'msedge' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'msedge' } },
  ],
});
