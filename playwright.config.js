// Playwright Configuration
// Story 5.1: Electron testing
// Story 14.3: Removed Chromium project — click tests ported to Electron (Electron 40 handles real clicks reliably)

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './playwright_tests',
  timeout: 15000,
  workers: 1,
  retries: 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.js',
    },
  ],
});
