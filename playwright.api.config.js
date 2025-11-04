import { defineConfig } from '@playwright/test';

const apiBase = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
const extraHeaders = process.env.TEST_API_KEY ? { 'X-API-Key': process.env.TEST_API_KEY } : {};

export default defineConfig({
  testDir: './tests/api',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'play-results.json' }]
  ],
  use: {
    baseURL: apiBase,
    extraHTTPHeaders: extraHeaders,
    ignoreHTTPSErrors: true,
    timeout: 30000,
  },
  projects: [
    { name: 'api' },
  ],
});
