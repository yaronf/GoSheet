// Playwright Configuration for Electron Testing
// Story 5.1: Setup Playwright Electron Environment

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  // Test directory
  testDir: './playwright_tests',
  
  // Timeout for each test (Electron apps can be slower to start)
  timeout: 30000,
  
  // Run tests serially (Electron apps don't parallelize well)
  workers: 1,
  
  // Retry failed tests (handle occasional flakiness)
  retries: 2,
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  
  // Shared settings for all tests
  use: {
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Trace on failure
    trace: 'on-first-retry',
  },
  
  // Projects (we only have one: Electron)
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.js',
    },
  ],
});
