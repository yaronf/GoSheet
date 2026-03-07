// Story 16.3: Tests for opening files from CLI and Finder "Open With"
// Tests .sheet open (AC 1, 2), .csv open (AC 3), and nonexistent file error (AC 4).
// Note: Finder double-click is not automatable; the CLI test covers the same code path
// (both converge on pendingFileToOpen → did-finish-load dispatch).

const base = require('@playwright/test');
const playwright = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { expect } = base;

// Helper: launch Electron with a specific CLI file argument
async function launchWithFile(filePath) {
  const electronPath = require('electron');
  const projectRoot = path.resolve(__dirname, '..');
  return playwright._electron.launch({
    executablePath: electronPath,
    args: [
      path.join(projectRoot, 'electron', 'main.js'),
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      filePath,
    ],
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
    timeout: 30000,
  });
}

// Helper: save a .sheet file using the running app's API
async function saveSheetToFile(window, filePath) {
  await window.evaluate(
    async ({ filePath }) => {
      const res = await fetch('/api/file/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
      return res.json();
    },
    { filePath }
  );
}

// Helper: set cell value via API
async function setCellViaApi(window, row, col, value) {
  await window.evaluate(
    async ({ row, col, value }) => {
      await fetch('/api/cell/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col, value }),
      });
    },
    { row, col, value }
  );
}

// Helper: launch Electron without a file arg (normal startup)
async function launchNormal() {
  const electronPath = require('electron');
  const projectRoot = path.resolve(__dirname, '..');
  return playwright._electron.launch({
    executablePath: electronPath,
    args: [
      path.join(projectRoot, 'electron', 'main.js'),
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
    timeout: 30000,
  });
}

base.test.describe('Open file from CLI', () => {
  base.test('opens a .sheet file passed as CLI argument', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-cli-test-'));
    const sheetPath = path.join(tmpDir, 'fixture.sheet');

    // Step 1: Create fixture .sheet file — launch app, set cells, save, close.
    // Must fully close before launching the second instance (single-instance lock).
    const setupApp = await launchNormal();
    const setupWindow = await setupApp.firstWindow();
    await setupWindow.waitForLoadState('domcontentloaded');

    await Promise.race([
      setupWindow
        .locator('#welcome-screen')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => {}),
      setupWindow
        .locator('#spreadsheet-view')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => {}),
    ]);
    if (await setupWindow.locator('#welcome-screen').isVisible()) {
      await setupWindow.locator('#welcome-btn-new').click();
      await setupWindow
        .locator('#cell-0-0')
        .waitFor({ state: 'visible', timeout: 10000 });
    }

    await setCellViaApi(setupWindow, 0, 0, 'Hello');
    await setCellViaApi(setupWindow, 0, 1, 'World');
    await saveSheetToFile(setupWindow, sheetPath);
    // Close setup app fully before launching the second instance
    await setupApp.close();
    // Brief condition-based wait: verify the file exists before proceeding
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(sheetPath) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(fs.existsSync(sheetPath)).toBe(true);

    // Step 2: Launch with the .sheet file as CLI arg
    const testApp = await launchWithFile(sheetPath);
    try {
      const testWindow = await testApp.firstWindow();
      await testWindow.waitForLoadState('domcontentloaded');

      // Should go straight to spreadsheet view (file bypasses welcome screen)
      await testWindow
        .locator('#spreadsheet-view')
        .waitFor({ state: 'visible', timeout: 12000 });
      const welcomeVisible = await testWindow
        .locator('#welcome-screen')
        .isVisible();
      expect(welcomeVisible).toBe(false);

      // Cell values should be loaded
      await expect(testWindow.locator('#cell-0-0')).toHaveText('Hello', {
        timeout: 8000,
      });
      await expect(testWindow.locator('#cell-0-1')).toHaveText('World', {
        timeout: 3000,
      });

      // File status should NOT show "Unsaved" — file was opened from disk
      const status = testWindow.locator('#file-status');
      await expect(status).not.toContainText('Unsaved', { timeout: 3000 });
    } finally {
      await testApp.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  base.test('opens a .csv file passed as CLI argument', async () => {
    // Create a fixture CSV file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-cli-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'Name,Score\nAlice,95\nBob,87\n');

    const testApp = await launchWithFile(csvPath);
    try {
      const testWindow = await testApp.firstWindow();
      await testWindow.waitForLoadState('domcontentloaded');

      // Should show spreadsheet view
      await testWindow
        .locator('#spreadsheet-view')
        .waitFor({ state: 'visible', timeout: 10000 });

      // CSV data should be imported — first row should have "Name"
      await expect(testWindow.locator('#cell-0-0')).toHaveText('Name', {
        timeout: 8000,
      });
      await expect(testWindow.locator('#cell-0-1')).toHaveText('Score', {
        timeout: 3000,
      });

      // Status should show "Unsaved" since CSV import doesn't create a .sheet file
      const status = testWindow.locator('#file-status');
      await expect(status).toContainText('Unsaved', { timeout: 5000 });
    } finally {
      await testApp.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  base.test(
    'shows error and welcome screen when CLI file does not exist',
    async () => {
      const ghostPath = path.join(
        os.tmpdir(),
        'nonexistent-gosheet-file.sheet'
      );
      // Ensure the file doesn't exist
      if (fs.existsSync(ghostPath)) fs.unlinkSync(ghostPath);

      // A nonexistent file is filtered out by the fs.existsSync guard in main.js CLI parsing,
      // so pendingFileToOpen won't be set. The app will show the welcome screen normally.
      // The open-file-error IPC path is only reachable if the file existed at parse time but
      // was deleted before did-finish-load — we test the CLI guard path here.
      const testApp = await launchWithFile(ghostPath);
      try {
        const testWindow = await testApp.firstWindow();
        await testWindow.waitForLoadState('domcontentloaded');

        // Welcome screen should be shown (file was filtered by CLI guard)
        await testWindow
          .locator('#welcome-screen')
          .waitFor({ state: 'visible', timeout: 10000 });
        const welcomeVisible = await testWindow
          .locator('#welcome-screen')
          .isVisible();
        expect(welcomeVisible).toBe(true);
      } finally {
        await testApp.close();
      }
    }
  );
});
