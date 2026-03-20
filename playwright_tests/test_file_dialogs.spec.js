// Playwright Electron File Dialog Tests
// Story 5.3: Implement Dialog Stubbing Tests

const { test, expect } = require('./fixtures');
const eph = require('electron-playwright-helpers');
const { ensureSpreadsheetView } = require('./helpers');

test.describe('Welcome screen — cancel open dialog stays on welcome', () => {
  test('cancelling open dialog from welcome screen returns to welcome', async ({
    electronApp,
    window,
  }) => {
    // Force welcome view regardless of initial state
    await window.evaluate(() => window.showWelcome?.());
    await expect(window.locator('#app')).toHaveAttribute(
      'data-view',
      'welcome'
    );

    // Stub the open dialog to return cancellation
    await eph.stubDialog(electronApp, 'showOpenDialog', { canceled: true });

    // Click "Open Existing File" from welcome screen
    await window.locator('#welcome-btn-open').click();

    // After cancel, welcome screen must still be visible
    await expect(window.locator('#app')).toHaveAttribute(
      'data-view',
      'welcome'
    );
  });
});

test.describe('File Dialog Tests', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('can stub open dialog', async ({ electronApp, window }) => {
    // Stub the open dialog to return a test file path
    await eph.stubDialog(electronApp, 'showOpenDialog', {
      filePaths: ['/tmp/test.sheet'],
    });

    // Trigger the open dialog via IPC
    const result = await window.evaluate(() => {
      return window.electronAPI.openFileDialog();
    });

    // Verify the stubbed path was returned via IPC
    expect(result).toBe('/tmp/test.sheet');

    // UI: app must still be showing the spreadsheet (not crashed or navigated away)
    await expect(window.locator('#spreadsheet')).toBeVisible();
  });

  test('can stub save dialog', async ({ electronApp, window }) => {
    // Stub the save dialog to return a test file path
    await eph.stubDialog(electronApp, 'showSaveDialog', {
      filePath: '/tmp/saved.sheet',
    });

    // Trigger the save dialog via IPC
    const result = await window.evaluate(() => {
      return window.electronAPI.saveFileDialog('test.sheet');
    });

    // Verify the stubbed path was returned via IPC
    expect(result).toBe('/tmp/saved.sheet');

    // UI: app must still be showing the spreadsheet
    await expect(window.locator('#spreadsheet')).toBeVisible();
  });

  test('can test dialog cancellation', async ({ electronApp, window }) => {
    // Stub the dialog to return cancellation
    await eph.stubDialog(electronApp, 'showOpenDialog', {
      canceled: true,
    });

    // Trigger the open dialog via IPC
    const result = await window.evaluate(() => {
      return window.electronAPI.openFileDialog();
    });

    // Verify null was returned (cancellation)
    expect(result).toBeNull();

    // UI: cancellation must leave the spreadsheet view unchanged
    await expect(window.locator('#spreadsheet')).toBeVisible();
    await expect(window.locator('#file-status')).toContainText('Saved');
  });
});
