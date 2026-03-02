// Story 8.2: Shared test helpers for welcome screen navigation
// CSV modal, toolbar, spreadsheet grid are inside spreadsheet-view; navigate from welcome if needed

const { expect } = require('@playwright/test');

async function ensureSpreadsheetView(window) {
  await Promise.race([
    window
      .locator('#welcome-screen')
      .waitFor({ state: 'visible', timeout: 5000 }),
    window
      .locator('#spreadsheet-view')
      .waitFor({ state: 'visible', timeout: 5000 }),
  ]);
  if (await window.locator('#welcome-screen').isVisible()) {
    await window.locator('#welcome-btn-new').click();
    await expect(window.locator('#cell-0-0')).toBeVisible({ timeout: 15000 });
  } else {
    await expect(window.locator('#cell-0-0')).toBeVisible({ timeout: 3000 });
  }
}

/** Wait for cell edit mode to be ready (cell-editor visible) before typing. Avoids first-char loss. */
async function waitForEditModeReady(window) {
  await expect(window.locator('.cell-editor')).toBeVisible({ timeout: 2000 });
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
  await expect(window.locator('#save-btn')).toBeEnabled({ timeout: 3000 });
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
 * Select a cell by real DOM click. Use for E2E tests that must verify click behavior.
 * Uses evaluate+click() so the app's click handler runs (Playwright's click can miss
 * in Electron). Waits for selected class to confirm the handler ran.
 */
async function selectCellByClick(window, row, col) {
  const cell = window.locator(`#cell-${row}-${col}`);
  await cell.waitFor({ state: 'visible' });
  await window.evaluate(
    ({ row, col }) => {
      const el = document.getElementById(`cell-${row}-${col}`);
      if (el) el.click();
    },
    { row, col }
  );
  await expect(cell).toHaveClass(/selected/, { timeout: 2000 });
}

/**
 * Select a cell via app's selectCell. Only use when the cell has no DOM element
 * (e.g. covered by a merge - user cannot click it). Prefer selectCellByClick for
 * real E2E coverage.
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
 * Start editing a cell via app's startEditing (exposed for tests). Use when
 * dblclick doesn't reliably trigger edit mode in Electron.
 */
async function startEditingViaApp(window, row, col) {
  await window.evaluate(
    ({ row, col }) => {
      if (typeof window.startEditing === 'function') {
        window.startEditing(row, col);
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
 * Create merge region via API. Story 11.4 tests.
 * After merging, call buildSpreadsheet to rebuild grid with merge regions.
 */
async function setMergeViaApi(window, startRow, startCol, rowSpan, colSpan) {
  const result = await window.evaluate(
    async (arg) => {
      const { startRow, startCol, rowSpan, colSpan } = arg;
      const res = await fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startRow,
          startCol,
          rowSpan,
          colSpan,
        }),
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(
          `setMergeViaApi: invalid JSON (${res.status}): ${text.slice(0, 100)}`,
          { cause: parseErr }
        );
      }
      if (json.success && typeof window.buildSpreadsheet === 'function') {
        await window.buildSpreadsheet();
        if (typeof window.refreshAllCells === 'function') {
          await window.refreshAllCells();
        }
      }
      return json;
    },
    { startRow, startCol, rowSpan, colSpan }
  );
  if (result && result.success === false) {
    throw new Error(result.error || 'setMergeViaApi failed');
  }
  return result;
}

/**
 * Apply style to range via backend API. Story 12.2.
 * Calls refreshAllCells so grid shows the style.
 */
async function setStyleViaApi(
  window,
  startRow,
  startCol,
  endRow,
  endCol,
  styleId
) {
  const result = await window.evaluate(
    async (arg) => {
      const { startRow, startCol, endRow, endCol, styleId } = arg;
      const res = await fetch('/api/range/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startRow,
          startCol,
          endRow,
          endCol,
          styleId,
        }),
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          `setStyleViaApi: invalid JSON (${res.status}): ${text.slice(0, 80)}`
        );
      }
      if (!res.ok) {
        throw new Error(json.error || text || `HTTP ${res.status}`);
      }
      if (json.success && typeof window.refreshAllCells === 'function') {
        await window.refreshAllCells();
      }
      return json;
    },
    { startRow, startCol, endRow, endCol, styleId }
  );
  if (result && result.success === false) {
    throw new Error(result.error || 'setStyleViaApi failed');
  }
  return result;
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
  selectCellByClick,
  selectCellViaApp,
  startEditingViaApp,
  setCellAndSelect,
  setMergeViaApi,
  setStyleViaApi,
};
