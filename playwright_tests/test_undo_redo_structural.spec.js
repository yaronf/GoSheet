// Story 15.3: Undo/Redo for Structural Operations
// Tests insert/delete row/column with undo (Cmd+Z) and redo (Cmd+Shift+Z).

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

// Direct API helpers for structural operations
// Each calls buildSpreadsheet + refreshAllCells so the grid reflects the change,
// and applyUndoRedoState so toolbar/menu state updates.
async function apiStructural(window, path, body) {
  return window.evaluate(
    async ({ path, body }) => {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        if (typeof window.buildSpreadsheet === 'function') {
          await window.buildSpreadsheet();
        }
        if (typeof window.refreshAllCells === 'function') {
          await window.refreshAllCells();
        }
        if (json.data && typeof window.applyUndoRedoState === 'function') {
          window.applyUndoRedoState(json.data);
        }
      }
      return json;
    },
    { path, body }
  );
}

const apiInsertRow = (window, row) =>
  apiStructural(window, '/api/row/insert', { row });
const apiDeleteRow = (window, row) =>
  apiStructural(window, '/api/row/delete', { row });
const apiInsertColumn = (window, col) =>
  apiStructural(window, '/api/column/insert', { col });
const apiDeleteColumn = (window, col) =>
  apiStructural(window, '/api/column/delete', { col });

test.describe('Undo/Redo structural operations (Story 15.3)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    await window.locator('#new-btn').click();
    const modal = window.locator('#modal-overlay');
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await window.locator('#modal-ok').click();
      await expect(modal).toBeHidden();
    }
    await expect(window.locator('#cell-0-0')).toBeVisible();
    await expect(window.locator('#file-status')).toContainText('Saved', {
      timeout: 3000,
    });
  });

  test('Insert row → Cmd+Z removes inserted row, cells restored', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'A1');
    await setCellViaApi(window, 1, 0, 'A2');
    await window.locator('#cell-0-0').waitFor({ state: 'visible' });

    await apiInsertRow(window, 1);
    await expect(window.locator('#cell-2-0')).toHaveText('A2', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-1-0')).toHaveText('', { timeout: 2000 });

    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-1-0')).toHaveText('A2', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-2-0')).toHaveText('', { timeout: 2000 });
  });

  test('Insert row → Cmd+Z → Cmd+Shift+Z redoes insert', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'A1');
    await setCellViaApi(window, 1, 0, 'A2');

    await apiInsertRow(window, 1);
    await expect(window.locator('#cell-2-0')).toHaveText('A2', {
      timeout: 3000,
    });

    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-1-0')).toHaveText('A2', {
      timeout: 3000,
    });

    await window.keyboard.press('Meta+Shift+z');
    await expect(window.locator('#cell-2-0')).toHaveText('A2', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-1-0')).toHaveText('', { timeout: 2000 });
  });

  test('Delete row → Cmd+Z restores deleted row with original values', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'A1');
    await setCellViaApi(window, 1, 0, 'A2');
    await setCellViaApi(window, 2, 0, 'A3');

    await apiDeleteRow(window, 1);
    await expect(window.locator('#cell-1-0')).toHaveText('A3', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-2-0')).toHaveText('', { timeout: 2000 });

    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-1-0')).toHaveText('A2', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-2-0')).toHaveText('A3', {
      timeout: 3000,
    });
  });

  test('Delete row → Cmd+Z → Cmd+Shift+Z redoes delete', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'A1');
    await setCellViaApi(window, 1, 0, 'A2');
    await setCellViaApi(window, 2, 0, 'A3');

    await apiDeleteRow(window, 1);
    await expect(window.locator('#cell-1-0')).toHaveText('A3', {
      timeout: 3000,
    });

    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-1-0')).toHaveText('A2', {
      timeout: 3000,
    });

    await window.keyboard.press('Meta+Shift+z');
    await expect(window.locator('#cell-1-0')).toHaveText('A3', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-2-0')).toHaveText('', { timeout: 2000 });
  });

  test('Insert column → Cmd+Z removes inserted column', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'A1');
    await setCellViaApi(window, 0, 1, 'B1');

    await apiInsertColumn(window, 1);
    await expect(window.locator('#cell-0-2')).toHaveText('B1', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-0-1')).toHaveText('', { timeout: 2000 });

    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-1')).toHaveText('B1', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-0-2')).toHaveText('', { timeout: 2000 });
  });

  test('Delete column → Cmd+Z restores deleted column', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'A1');
    await setCellViaApi(window, 0, 1, 'B1');
    await setCellViaApi(window, 0, 2, 'C1');

    await apiDeleteColumn(window, 1);
    await expect(window.locator('#cell-0-1')).toHaveText('C1', {
      timeout: 3000,
    });

    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-1')).toHaveText('B1', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-0-2')).toHaveText('C1', {
      timeout: 3000,
    });
  });

  test('Formula cell referencing shifted row → undo → formula result correct', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '10');
    await setCellViaApi(window, 1, 0, '20');
    await setCellViaApi(window, 2, 0, '=A1+A2');
    await expect(window.locator('#cell-2-0')).toHaveText('30', {
      timeout: 3000,
    });

    await apiInsertRow(window, 1);
    // Formula shifts: =A1+A3 (A2 moved to A3), result still 30
    await expect(window.locator('#cell-3-0')).toHaveText('30', {
      timeout: 3000,
    });

    await window.keyboard.press('Meta+z');
    // After undo: formula is back at row 2, =A1+A2 = 30
    await expect(window.locator('#cell-2-0')).toHaveText('30', {
      timeout: 3000,
    });
  });

  test('Undo button and redo button reflect structural operation state', async ({
    window,
  }) => {
    // Perform a delete row and then undo — redo button should become enabled
    await setCellViaApi(window, 0, 0, 'x');
    await apiDeleteRow(window, 0);

    // After undo, redo should be available
    await window.keyboard.press('Meta+z');
    await window.keyboard.press('Meta+z'); // undo the setCellViaApi too
    await expect(window.locator('#redo-btn')).toBeEnabled({ timeout: 3000 });
  });

  test('Delete row response includes canUndo and undoDescription', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'x');
    await setCellViaApi(window, 1, 0, 'y');

    const result = await apiDeleteRow(window, 0);
    expect(result.data.canUndo).toBe(true);
    expect(result.data.undoDescription).toContain('Delete Row');
  });

  test('Insert row response includes canUndo and undoDescription', async ({
    window,
  }) => {
    const result = await apiInsertRow(window, 0);
    expect(result.data.canUndo).toBe(true);
    expect(result.data.undoDescription).toContain('Insert Row');
  });

  test('Formula referencing deleted row shows error cell; undo restores correct result', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '10');
    await setCellViaApi(window, 1, 0, '20');
    await setCellViaApi(window, 2, 0, '=A1+A2'); // references row 1 (A2=20)
    await expect(window.locator('#cell-2-0')).toHaveText('30', {
      timeout: 3000,
    });

    await apiDeleteRow(window, 1); // delete row 1 → formula becomes =A1+#REF!
    // Cell at new row 1 should be an error cell
    await expect(window.locator('#cell-1-0')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });

    // Undo: formula restored to =A1+A2 = 30
    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-2-0')).toHaveText('30', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-2-0')).not.toHaveClass(/error-cell/);
  });
});
