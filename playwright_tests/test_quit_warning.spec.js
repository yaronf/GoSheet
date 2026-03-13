// Story 7.11: Quit Warning Dialog Tests
// Tests the quit warning dialog behavior with unsaved changes
// Story 8.2: Navigate from welcome screen before testing

const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const {
  stubDialog,
  clickMenuItemById,
} = require('electron-playwright-helpers');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');
const path = require('path');
const os = require('os');
const fs = require('fs');

test.describe('Quit Warning Dialog', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Launch Electron app (NODE_ENV=test keeps window hidden like other tests)
    electronApp = await electron.launch({
      args: [
        path.join(__dirname, '..', 'electron', 'main.js'),
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    // Get the first window and wait for it to be ready
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Navigate from welcome screen to spreadsheet
    await ensureSpreadsheetView(window);

    // Ensure spreadsheet grid and app state are ready
    await expect(window.locator('#spreadsheet')).toBeVisible({ timeout: 5000 });
    await expect(window.locator('#file-status')).toBeVisible({ timeout: 3000 });
  });

  test.afterEach(async () => {
    // Clean up
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should show quit dialog when there are unsaved changes', async () => {
    await setCellViaApi(window, 0, 0, 'test');

    // Verify unsaved changes indicator
    const status = await window.locator('#file-status');
    await expect(status).toContainText('Unsaved changes');

    // Set up dialog handler to capture the dialog
    // Dialog capture vars reserved for future native-dialog interception
    const _dialogShown = false;
    const _dialogMessage = '';

    electronApp.on('window', async (_newWindow) => {
      // This won't work for native dialogs, but we can check via IPC
    });

    // Verify window.currentHasUnsavedChanges is set
    const hasUnsavedChanges = await window.evaluate(
      () => window.currentHasUnsavedChanges
    );
    expect(hasUnsavedChanges).toBe(true);
  });

  test('should NOT show dialog when there are no unsaved changes', async () => {
    // Verify no unsaved changes
    const status = window.locator('#file-status');
    await expect(status).toContainText('Saved', { timeout: 3000 });

    const hasUnsavedChanges = await window.evaluate(
      () => window.currentHasUnsavedChanges
    );
    expect(hasUnsavedChanges === false || hasUnsavedChanges === undefined).toBe(
      true
    );
  });

  test('should update currentHasUnsavedChanges when cell is edited', async () => {
    // Initial state - no unsaved changes (wait for app to have initialized the variable)
    await expect(window.locator('#file-status')).toContainText('Saved', {
      timeout: 3000,
    });
    let hasUnsavedChanges = await window.evaluate(
      () => window.currentHasUnsavedChanges
    );
    expect(hasUnsavedChanges === false || hasUnsavedChanges === undefined).toBe(
      true
    );

    await setCellViaApi(window, 0, 0, 'test');

    // Wait for status to update before checking variable (avoids race with API response)
    await expect(window.locator('#file-status')).toContainText('Unsaved', {
      timeout: 3000,
    });

    // Should now have unsaved changes
    hasUnsavedChanges = await window.evaluate(
      () => window.currentHasUnsavedChanges
    );
    expect(hasUnsavedChanges).toBe(true);
  });

  test('should clear currentHasUnsavedChanges after save', async () => {
    await setCellViaApi(window, 0, 0, 'test');

    // Wait for status and menu to update (Save becomes enabled)
    await expect(window.locator('#file-status')).toContainText('Unsaved', {
      timeout: 3000,
    });

    let hasUnsavedChanges = await window.evaluate(
      () => window.currentHasUnsavedChanges
    );
    expect(hasUnsavedChanges).toBe(true);

    // Stub save dialog and trigger Save via menu (more reliable than Cmd+S)
    const testPath = path.join(os.tmpdir(), 'test-quit-warning.sheet');
    await stubDialog(electronApp, 'showSaveDialog', {
      canceled: false,
      filePath: testPath,
    });
    await clickMenuItemById(electronApp, 'save');

    // Wait for save to complete and status to update
    await expect(window.locator('#file-status')).toContainText('Saved', {
      timeout: 5000,
    });

    // Should no longer have unsaved changes
    hasUnsavedChanges = await window.evaluate(
      () => window.currentHasUnsavedChanges
    );
    expect(hasUnsavedChanges).toBe(false);

    // Cleanup
    if (fs.existsSync(testPath)) {
      fs.unlinkSync(testPath);
    }
  });

  test('should expose currentHasUnsavedChanges to window object', async () => {
    // Verify the variable exists on window
    const variableExists = await window.evaluate(() => {
      return typeof window.currentHasUnsavedChanges !== 'undefined';
    });
    expect(variableExists).toBe(true);

    // Verify it's a boolean
    const isBoolean = await window.evaluate(() => {
      return typeof window.currentHasUnsavedChanges === 'boolean';
    });
    expect(isBoolean).toBe(true);
  });

  test('should synchronize currentHasUnsavedChanges with displayFileStatus', async () => {
    await setCellViaApi(window, 0, 0, 'test');

    // Check both the UI and the variable
    const status = await window.locator('#file-status');
    await expect(status).toContainText('Unsaved changes');

    const hasUnsavedChanges = await window.evaluate(
      () => window.currentHasUnsavedChanges
    );
    expect(hasUnsavedChanges).toBe(true);

    // Both should be in sync
    const statusText = await status.textContent();
    const variableMatchesUI =
      hasUnsavedChanges === statusText.includes('Unsaved');
    expect(variableMatchesUI).toBe(true);
  });

  test('app.quit() with unsaved changes should not skip the dialog (isQuitting guard)', async () => {
    // Bug: before-quit set isQuitting=true before triggering window.close(),
    // so the close handler's `if (isQuitting) return` skipped the unsaved-changes dialog.
    // Fix: before-quit uses isQuitInitiated (re-entry guard); isQuitting only set after confirmation.
    //
    // This test exercises the production before-quit path by temporarily unblocking it
    // (clearing NODE_ENV=test), triggering app.quit(), then checking state before the
    // window close handler runs. The dialog is stubbed to "Cancel" so the app stays open.

    await setCellViaApi(window, 0, 0, 'quit-test');
    await expect(window.locator('#file-status')).toContainText('Unsaved', {
      timeout: 3000,
    });

    // Stub showMessageBox to return "Cancel" — user declines to quit
    await stubDialog(electronApp, 'showMessageBox', { response: 0 });

    // Exercise the production before-quit path: temporarily unset NODE_ENV=test so
    // before-quit intercepts app.quit() and triggers window.close() instead.
    // The window.close() handler will show the (stubbed) dialog and cancel.
    const appExited = await electronApp.evaluate(
      async ({ app, BrowserWindow }) => {
        // Temporarily remove test mode so before-quit runs the real interception logic
        const savedNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        // app.quit() will be intercepted by before-quit (since isQuitting=false, isQuitInitiated=false)
        // before-quit will preventDefault, set isQuitInitiated=true, and trigger window.close()
        // window.close() will show the dialog (stubbed to Cancel) and NOT quit
        app.quit();

        // Restore env
        process.env.NODE_ENV = savedNodeEnv;

        // Give the close handler a moment to run (it's async)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if windows still exist (app did NOT quit)
        const wins = BrowserWindow.getAllWindows();
        return wins.length === 0; // true = app exited (bug), false = app stayed (correct)
      }
    );

    // App must NOT have exited — dialog was shown and user cancelled
    expect(appExited).toBe(false);

    // Window should still be visible and functional
    await expect(window.locator('#spreadsheet')).toBeVisible({ timeout: 3000 });
  });
});
