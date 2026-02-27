// Story 8.2: Shared test helpers for welcome screen navigation
// CSV modal, toolbar, spreadsheet grid are inside spreadsheet-view; navigate from welcome if needed

const { expect } = require('@playwright/test');

async function ensureSpreadsheetView(window) {
  const welcomeScreen = window.locator('#welcome-screen');
  if (await welcomeScreen.isVisible()) {
    await window.locator('#welcome-btn-new').click();
    await expect(window.locator('#spreadsheet')).toBeVisible({ timeout: 5000 });
  }
}

/** Wait for cell edit mode to be ready (cell-editor visible) before typing. Avoids first-char loss. */
async function waitForEditModeReady(window) {
  await expect(window.locator('.cell-editor')).toBeVisible({ timeout: 3000 });
}

/**
 * Edit a cell: click, dblclick, wait for edit mode, type, Enter.
 * Uses explicit waits instead of arbitrary timeouts.
 */
async function editCell(window, cell, text) {
  await cell.click();
  await cell.dblclick();
  await waitForEditModeReady(window);
  await window.keyboard.type(text);
  await window.keyboard.press('Enter');
}

/** Wait for Save button to become enabled (indicates unsaved changes). */
async function waitForSaveEnabled(window) {
  await expect(window.locator('#save-btn')).toBeEnabled({ timeout: 5000 });
}

/**
 * Set a cell value via the backend API. Bypasses UI (avoids flaky click/selected
 * in Electron). Use when UI interaction is unreliable and export/backend is what matters.
 */
async function setCellViaApi(window, row, col, value) {
  const result = await window.evaluate(
    async ({ row, col, value }) => {
      const res = await fetch('/api/cell/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col, value }),
      });
      const json = await res.json();
      if (json.success) {
        if (typeof window.refreshAllCells === 'function') {
          await window.refreshAllCells();
        }
        if (
          json.data?.hasUnsavedChanges !== undefined &&
          typeof window.displayFileStatus === 'function'
        ) {
          window.displayFileStatus(json.data.hasUnsavedChanges);
        }
      }
      return json;
    },
    { row, col, value }
  );
  if (result && result.success === false) {
    throw new Error(result.error || 'setCellViaApi failed');
  }
  return result;
}

/**
 * Select a cell via app's selectCell (exposed for tests). Use when click doesn't
 * reliably add selected class in Electron.
 */
async function selectCellViaApp(window, row, col) {
  await window.evaluate(
    ({ row, col }) => {
      if (typeof window.selectCell === 'function') {
        window.selectCell(row, col);
      }
    },
    { row, col }
  );
}

/**
 * Set cell value via API and select it. For Copy/Cut/Paste tests that need
 * a cell with data and selection.
 */
async function setCellAndSelect(window, row, col, value) {
  await setCellViaApi(window, row, col, value);
  await selectCellViaApp(window, row, col);
}

/**
 * Fill a cell: click, wait for selection (avoids race where typing happens before
 * selectCell runs), type, Enter. Use for reliable cell editing in Electron.
 */
async function fillCell(window, selector, text) {
  const cell = window.locator(selector);
  await cell.click();
  await expect(cell).toHaveClass(/selected/);
  await window.keyboard.type(text);
  await window.keyboard.press('Enter');
}

module.exports = {
  ensureSpreadsheetView,
  waitForEditModeReady,
  editCell,
  waitForSaveEnabled,
  fillCell,
  setCellViaApi,
  selectCellViaApp,
  setCellAndSelect,
};
