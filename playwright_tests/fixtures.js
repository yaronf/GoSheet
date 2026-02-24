// Playwright Electron Test Fixtures
// Story 5.1: Setup Playwright Electron Environment

const base = require('@playwright/test');
const playwright = require('playwright');
const path = require('path');

// Extend base test with Electron fixtures
exports.test = base.test.extend({
  // Electron app fixture - launches the app
  electronApp: async ({}, use) => {
    // Get Electron executable path
    const electronPath = require('electron');

    // Launch Electron app
    const electronApp = await playwright._electron.launch({
      executablePath: electronPath,
      args: [
        path.join(__dirname, '..', 'electron', 'main.js'),
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
      // Set environment variable to indicate we're in test mode
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
      timeout: 30000,
    });

    // Provide app to test
    await use(electronApp);

    // Cleanup: close app after test
    await electronApp.close();
  },

  // Window fixture - gets the first window
  window: async ({ electronApp }, use) => {
    // Wait for first window to open
    const window = await electronApp.firstWindow();

    // Wait for window to be fully loaded
    await window.waitForLoadState('domcontentloaded');

    // Provide window to test
    await use(window);
  },
});

exports.expect = base.expect;
