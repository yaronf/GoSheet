// Playwright Configuration
// Story 5.1: Electron testing
// 2026-02-28: Dual projects per technical-ui-testing-research - Chromium (reliable clicks) + Electron (menus, IPC)

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
  globalSetup: require.resolve('./playwright_tests/global-setup.js'),
  globalTeardown: require.resolve('./playwright_tests/global-teardown.js'),
  // Only run globalSetup for chromium-web; Electron spawns its own server
  // (globalSetup runs once; server on 3001 doesn't conflict with Electron's 3000)
  projects: [
    {
      name: 'chromium-web',
      use: {
        browserName: 'chromium',
        baseURL: `http://localhost:${process.env.GOSHEET_WEB_PORT || 3001}`,
      },
      testMatch: '**/test_ui_interactions.spec.js',
      dependencies: [],
    },
    {
      name: 'electron',
      testMatch: '**/*.spec.js',
      testIgnore: '**/test_ui_interactions.spec.js',
      dependencies: [],
    },
  ],
});
