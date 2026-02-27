// Story 10.7: Accessibility tests - ARIA attributes, focus trap, screen reader support

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

test.describe('Accessibility (Story 10.7)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('Grid has proper ARIA attributes', async ({ window }) => {
    const container = window.locator('#container');
    await expect(container).toHaveAttribute('role', 'grid');
    await expect(container).toHaveAttribute('aria-label', 'Spreadsheet');
    const rowCount = await container.getAttribute('aria-rowcount');
    const colCount = await container.getAttribute('aria-colcount');
    expect(rowCount).toBeTruthy();
    expect(colCount).toBeTruthy();
  });

  test('File status has aria-live region', async ({ window }) => {
    const statusWrapper = window.locator('.file-status-wrapper');
    await expect(statusWrapper).toHaveAttribute('role', 'status');
    await expect(statusWrapper).toHaveAttribute('aria-live', 'polite');
  });

  test('Toolbar has banner role and label', async ({ window }) => {
    const toolbar = window.locator('header.toolbar');
    await expect(toolbar).toHaveAttribute('role', 'banner');
    await expect(toolbar).toHaveAttribute('aria-label', 'Application toolbar');
  });

  test('Formula bar has complementary role and label', async ({ window }) => {
    const formulaBarContainer = window.locator('.formula-bar-container');
    await expect(formulaBarContainer).toHaveAttribute('role', 'complementary');
    await expect(formulaBarContainer).toHaveAttribute('aria-label', 'Formula bar');
  });

  test('Buttons have descriptive aria-labels', async ({ window }) => {
    const newBtn = window.locator('#new-btn');
    const saveBtn = window.locator('#save-btn');
    const loadBtn = window.locator('#load-btn');
    await expect(newBtn).toHaveAttribute('aria-label', 'New Spreadsheet');
    await expect(saveBtn).toHaveAttribute('aria-label', 'Save Spreadsheet');
    await expect(loadBtn).toHaveAttribute('aria-label', 'Load Spreadsheet');
  });

  test('Formula input has aria-label', async ({ window }) => {
    const formulaBar = window.locator('#formula-bar');
    await expect(formulaBar).toHaveAttribute('aria-label', 'Formula input');
  });

  test('Cells have gridcell role and indices', async ({ window }) => {
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveAttribute('role', 'gridcell');
    await expect(cell).toHaveAttribute('aria-colindex', '1');
    await expect(cell).toHaveAttribute('aria-rowindex', '1');
  });

  test('Modals have dialog role and aria-modal', async ({ window }) => {
    const modal = window.locator('#modal-overlay');
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  test('Escape closes confirm dialog', async ({ window }) => {
    // Trigger unsaved changes via API (avoids flaky click/type in Electron)
    await setCellViaApi(window, 0, 0, 'test');

    // Open new file to trigger confirm dialog
    await window.locator('#new-btn').click();
    await expect(window.locator('#modal-overlay.active')).toBeVisible({ timeout: 5000 });

    // Escape should close
    await window.keyboard.press('Escape');
    const overlay = window.locator('#modal-overlay');
    await expect(overlay).not.toHaveClass(/active/);
  });
});
