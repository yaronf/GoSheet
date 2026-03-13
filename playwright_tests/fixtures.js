// Playwright Electron Test Fixtures
// Story 5.1: Setup Playwright Electron Environment

const base = require('@playwright/test');
const playwright = require('playwright');
const path = require('path');
const fs = require('fs');

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

    // Coverage: extract window.__coverage__ before closing (only when COVERAGE=1)
    if (process.env.COVERAGE === '1') {
      try {
        const win = await electronApp.firstWindow();
        const coverage = await win.evaluate(() => window.__coverage__);
        if (coverage) {
          const nycDir = path.join(__dirname, '..', '.nyc_output');
          if (!fs.existsSync(nycDir)) fs.mkdirSync(nycDir);
          // Each worker writes a uniquely named file; nyc merges them automatically
          const outFile = path.join(
            nycDir,
            `coverage-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
          );
          fs.writeFileSync(outFile, JSON.stringify(coverage));
        }
      } catch (e) {
        console.warn('[coverage] Failed to extract coverage:', e.message);
      }
    }

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
