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
    // Use absolute paths and explicit cwd per Playwright #32027 (sandbox/VSCode cwd differs from terminal)
    const projectRoot = path.resolve(__dirname, '..');
    const electronApp = await playwright._electron.launch({
      executablePath: electronPath,
      args: [
        path.join(projectRoot, 'electron', 'main.js'),
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
      cwd: projectRoot,
      // Set environment variable to indicate we're in test mode
      // ELECTRON_SHOW_WINDOW=1 (from test:headed) makes the window visible
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
