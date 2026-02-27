// Playwright Electron File Operation Tests
// Story 5.4: Create File Operation Tests
// End-to-end tests for New, Open, Save workflows
// Story 8.2: Navigate from welcome screen before testing

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  waitForSaveEnabled,
} = require('./helpers');
const eph = require('electron-playwright-helpers');
const fs = require('fs');
const path = require('path');
const os = require('os');

test.describe('File Operation Tests', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  // Helper: Clean up test file
  function cleanupTestFile(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  test('New spreadsheet workflow', async ({ window }) => {
    await expect(window.locator('#spreadsheet')).toBeVisible();

    // Enter data in a cell to trigger unsaved state
    await setCellViaApi(window, 5, 5, '999');

    const status = window.locator('#file-status');
    await expect(status).toContainText('Unsaved', { timeout: 5000 });

    // Click New button
    await window.locator('#new-btn').click();

    // Modal should appear asking about unsaved changes
    const modal = window.locator('#modal-overlay');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Click OK in modal
    await window.locator('#modal-ok').click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // Verify grid is cleared (cell should be empty)
    await expect(window.locator('#cell-5-5')).toHaveText('');

    // Verify status shows "Saved" (new empty spreadsheet has no unsaved changes)
    await expect(status).toContainText('Saved');
  });

  test('Open file workflow', async ({ electronApp, window }) => {
    await expect(window.locator('#spreadsheet')).toBeVisible();

    const testFilePath = path.join(os.tmpdir(), 'test-open.sheet');

    try {
      // First, create a test file by entering data and saving it
      await setCellViaApi(window, 0, 0, '100');
      await setCellViaApi(window, 0, 1, '200');
      await setCellViaApi(window, 0, 2, '=A1+B1');

      // Save the file
      await eph.stubDialog(electronApp, 'showSaveDialog', {
        filePath: testFilePath,
      });
      await waitForSaveEnabled(window);
      await window.locator('#save-btn').click();

      // Wait for save to complete (status shows Saved)
      await expect(window.locator('#file-status')).toContainText('Saved', {
        timeout: 5000,
      });

      const modal = window.locator('#modal-overlay');
      await expect(modal).not.toBeVisible({ timeout: 2000 });

      // Now create a new spreadsheet to clear the data
      await window.locator('#new-btn').click();
      const confirmModal = window.locator('#modal-overlay.active');
      if (await confirmModal.isVisible()) {
        await window.locator('#modal-ok').click();
      }

      // Verify cells are empty
      await expect(window.locator('#cell-0-0')).toHaveText('', {
        timeout: 3000,
      });

      // Now test loading the file
      await eph.stubDialog(electronApp, 'showOpenDialog', {
        filePaths: [testFilePath],
      });

      await window.locator('#load-btn').click();

      // Handle unsaved changes modal if it appears
      if (await modal.isVisible()) {
        await window.locator('#modal-ok').click();
      }

      // Verify file was loaded (check cell values)
      await expect(window.locator('#cell-0-0')).toHaveText('100'); // A1
      await expect(window.locator('#cell-0-1')).toHaveText('200'); // B1
      await expect(window.locator('#cell-0-2')).toHaveText('300'); // C1 (formula result)

      // Verify status shows "Saved"
      const status = window.locator('#file-status');
      await expect(status).toContainText('Saved');
    } finally {
      // Cleanup test file
      cleanupTestFile(testFilePath);
    }
  });

  test('Save file workflow', async ({ electronApp, window }) => {
    await expect(window.locator('#spreadsheet')).toBeVisible();

    const testFilePath = path.join(os.tmpdir(), 'test-save.sheet');

    try {
      await setCellViaApi(window, 0, 0, '42');

      const status = window.locator('#file-status');
      await expect(status).toContainText('Unsaved', { timeout: 5000 });

      await eph.stubDialog(electronApp, 'showSaveDialog', {
        filePath: testFilePath,
      });
      await waitForSaveEnabled(window);
      await window.locator('#save-btn').click();

      // Wait for save to complete
      await expect(status).toContainText('Saved', { timeout: 5000 });
      const modal = window.locator('#modal-overlay');
      await expect(modal).not.toBeVisible({ timeout: 2000 });

      // Verify status shows "Saved" (file status doesn't show filename in current implementation)
      await expect(status).toContainText('Saved');

      // Verify file exists on disk
      expect(fs.existsSync(testFilePath)).toBeTruthy();

      // Verify file has content (it's a gob-encoded binary file, not JSON)
      const stats = fs.statSync(testFilePath);
      expect(stats.size).toBeGreaterThan(0);
    } finally {
      // Cleanup test file
      cleanupTestFile(testFilePath);
    }
  });

  test('file status tracking', async ({ electronApp, window }) => {
    await expect(window.locator('#spreadsheet')).toBeVisible();

    const testFilePath = path.join(os.tmpdir(), 'test-status.sheet');
    const status = window.locator('#file-status');

    try {
      await setCellViaApi(window, 0, 0, '50');

      await eph.stubDialog(electronApp, 'showSaveDialog', {
        filePath: testFilePath,
      });
      await waitForSaveEnabled(window);
      await window.locator('#save-btn').click();

      await expect(status).toContainText('Saved', { timeout: 5000 });
      const modal = window.locator('#modal-overlay');
      await expect(modal).not.toBeVisible({ timeout: 2000 });

      // Edit a cell to trigger unsaved
      await setCellViaApi(window, 1, 1, '75');

      await expect(status).toContainText('Unsaved', { timeout: 5000 });

      // Save again - should NOT show dialog since file already has a path
      await waitForSaveEnabled(window);
      await window.locator('#save-btn').click();

      await expect(status).toContainText('Saved', { timeout: 5000 });
    } finally {
      // Cleanup test file
      cleanupTestFile(testFilePath);
    }
  });

  test('dialog cancellation handling', async ({ electronApp, window }) => {
    await expect(window.locator('#spreadsheet')).toBeVisible();

    // Stub open dialog to return cancellation
    await eph.stubDialog(electronApp, 'showOpenDialog', {
      canceled: true,
    });

    // Click Load button
    await window.locator('#load-btn').click();

    // Verify app returns to normal state (no error, no crash)
    const table = window.locator('#spreadsheet');
    await expect(table).toBeVisible({ timeout: 3000 });

    // Make an edit so Save is enabled, then test save dialog cancellation
    await setCellViaApi(window, 0, 0, 'test');
    await waitForSaveEnabled(window);

    await eph.stubDialog(electronApp, 'showSaveDialog', {
      canceled: true,
    });

    await window.locator('#save-btn').click();

    // Verify app is still functional
    await expect(table).toBeVisible();
  });
});
