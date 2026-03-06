// Story 14.3: Port click interaction tests from Chromium to Electron
// Original: playwright_tests/test_ui_interactions.spec.js (Chromium project)
// These test real DOM click behavior: single click, double click, shift+click, click-away.

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  waitForEditModeReady,
} = require('./helpers');

test.describe('Click interactions (Electron - real clicks)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('single click selects cell', async ({ window }) => {
    const cell = window.locator('#cell-5-5');
    await cell.click();
    await expect(cell).toHaveClass(/selected/, { timeout: 2000 });
  });

  test('single click updates formula bar', async ({ window }) => {
    await setCellViaApi(window, 3, 2, 'hello');
    const cell = window.locator('#cell-3-2');
    await cell.click();
    await expect(cell).toHaveClass(/selected/);
    const cellRef = window.locator('#cell-ref');
    await expect(cellRef).toHaveText('C4');
  });

  test('double click enters edit mode', async ({ window }) => {
    await setCellViaApi(window, 2, 1, 'edit-me');
    const cell = window.locator('#cell-2-1');
    await cell.dblclick();
    const editor = window.locator('.cell-editor');
    await expect(editor).toBeVisible({ timeout: 2000 });
    await editor.type('X');
    await window.keyboard.press('Enter');
    await expect(cell).toHaveText('edit-meX');
  });

  test('shift+click extends selection to range', async ({ window }) => {
    const cellA1 = window.locator('#cell-0-0');
    const cellC3 = window.locator('#cell-2-2');
    await cellA1.click();
    await expect(cellA1).toHaveClass(/selected/);
    await cellC3.click({ modifiers: ['Shift'] });
    await expect(cellA1).toHaveClass(/selected/);
    await expect(cellC3).toHaveClass(/selected/);
    const selectedCount = await window.locator('.cell.selected').count();
    expect(selectedCount).toBe(9);
  });

  test('click away from cell saves edit', async ({ window }) => {
    await setCellViaApi(window, 4, 2, '99');
    const cell = window.locator('#cell-4-2');
    await cell.dblclick();
    await waitForEditModeReady(window);
    await window.keyboard.type('00');
    const otherCell = window.locator('#cell-0-0');
    await otherCell.click();
    await expect(cell).toHaveText('9900');
  });
});
