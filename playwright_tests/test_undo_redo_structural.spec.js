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
          await window.applyUndoRedoState(json.data);
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
    // Ensure grid is fully rebuilt and cells are empty before each test
    await window.evaluate(async () => {
      if (typeof window.buildSpreadsheet === 'function')
        await window.buildSpreadsheet();
      if (typeof window.refreshAllCells === 'function')
        await window.refreshAllCells();
    });
    await expect(window.locator('#cell-0-0')).toHaveText('', { timeout: 2000 });
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

  // Bug repro: deleting two rows where the second delete invalidates a range
  // boundary causes the formula Value to be serialized as "SUM(C9:#REF!)",
  // which then fails to parse ("1:9: lexer: invalid input text #REF!)").
  test('deleting two rows where second delete hits range boundary shows #REF! not parse error', async ({
    window,
  }) => {
    // Set up: A1..A3 = 10,20,30; A4 = =SUM(A1:A3)
    await setCellViaApi(window, 0, 0, '10');
    await setCellViaApi(window, 1, 0, '20');
    await setCellViaApi(window, 2, 0, '30');
    await setCellViaApi(window, 3, 0, '=SUM(A1:A3)');
    await expect(window.locator('#cell-3-0')).toHaveText('60', {
      timeout: 3000,
    });

    // First delete: row 1 (interior of A1:A3) — range shrinks to A1:A2, still valid
    await apiDeleteRow(window, 1);
    // Formula cell is now at row 2 (was row 3), range shrinks to A1:A2
    await expect(window.locator('#cell-2-0')).not.toHaveClass(/error-cell/, {
      timeout: 3000,
    });

    // Second delete: row 1 (now the end boundary A2 of A1:A2) — should become #REF!
    await apiDeleteRow(window, 1);
    // Formula cell is now at row 1; should show #REF!, NOT "#ERROR parse error"
    const cellText = await window.locator('#cell-1-0').textContent();
    expect(cellText).not.toContain('parse error');
    await expect(window.locator('#cell-1-0')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });
  });

  // Bug repro: after a range formula becomes #REF!, deleting that formula cell's row
  // and then undoing the delete should restore the cell showing #REF!, not a valid result.
  test('undo of deleting a #REF! formula row restores #REF! not valid result', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '10');
    await setCellViaApi(window, 1, 0, '20');
    await setCellViaApi(window, 2, 0, '30');
    await setCellViaApi(window, 3, 0, '=SUM(A1:A3)');
    await expect(window.locator('#cell-3-0')).toHaveText('60', {
      timeout: 3000,
    });

    // Delete row 1 (interior) → range shrinks to A1:A2, still valid
    await apiDeleteRow(window, 1);
    await expect(window.locator('#cell-2-0')).not.toHaveClass(/error-cell/, {
      timeout: 3000,
    });

    // Delete row 1 (now end boundary A2) → formula becomes #REF!
    await apiDeleteRow(window, 1);
    await expect(window.locator('#cell-1-0')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });

    // Delete the #REF! formula row itself (row 1)
    await apiDeleteRow(window, 1);
    await expect(window.locator('#cell-1-0')).not.toHaveClass(/error-cell/, {
      timeout: 3000,
    });

    // Undo: formula row comes back — should still show #REF!, not a valid result
    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-1-0')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });
    await expect(window.locator('#cell-1-0')).toHaveText('#REF!', {
      timeout: 3000,
    });
  });

  // Bug repro: formula bar shows clean formula text (e.g. =SUM(A1:A3)) for a cell
  // that is displaying #REF!, instead of reflecting the invalid state.
  test('formula bar shows #REF! for an invalid formula cell', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '10');
    await setCellViaApi(window, 1, 0, '20');
    await setCellViaApi(window, 2, 0, '30');
    await setCellViaApi(window, 3, 0, '=SUM(A1:A3)');
    await expect(window.locator('#cell-3-0')).toHaveText('60', {
      timeout: 3000,
    });

    // Delete row 1 (end boundary) → formula becomes #REF!
    await apiDeleteRow(window, 2);
    await expect(window.locator('#cell-2-0')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });

    // Click the error cell — formula bar should reflect the invalid state, not the original formula
    await window.locator('#cell-2-0').click();
    const formulaBar = window.locator('#formula-bar');
    // Wait for the async formula bar update to complete after cell click
    await expect(formulaBar).not.toHaveValue('', { timeout: 2000 });
    await expect(formulaBar).not.toHaveValue('=SUM(A1:A3)', { timeout: 2000 });
    const barValue = await formulaBar.inputValue();
    expect(barValue).toContain('#REF!');
  });

  // Bug repro: undo of a column delete that broke a circular reference should
  // restore the cycle errors, not show valid (empty/zero) values.
  // Scenario from logs: D4=E4, E4=D4 cycle. Delete col D → E4 shifts to D4 (self-ref).
  // Undo → cycle D4↔E4 should be restored and both cells show errors.
  test('undo of column delete that broke a circular ref restores cycle errors', async ({
    window,
  }) => {
    // Create cycle: A1=B1, B1=A1
    await setCellViaApi(window, 0, 0, '=B1');
    await setCellViaApi(window, 0, 1, '=A1');
    await expect(window.locator('#cell-0-0')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });
    await expect(window.locator('#cell-0-1')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });

    // Delete column A — B1 shifts to A1 (self-reference), cycle broken
    await apiDeleteColumn(window, 0);

    // Undo the delete — cycle A1↔B1 should be restored, both cells show circular ref errors (not #REF!)
    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-0')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });
    await expect(window.locator('#cell-0-1')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });
    // Must be circular ref errors, not #REF! (which would indicate the formula ref wasn't restored)
    await expect(window.locator('#cell-0-0')).not.toHaveText('#REF!', {
      timeout: 2000,
    });
    await expect(window.locator('#cell-0-1')).not.toHaveText('#REF!', {
      timeout: 2000,
    });
  });

  test('undo of column delete: cell referencing non-anchor cycle member shows error', async ({
    window,
  }) => {
    // C1=A1 set before the cycle, referencing the non-anchor cycle member
    await setCellViaApi(window, 0, 2, '=A1');
    // Create cycle: A1=B1, B1=A1 (B1 is the anchor/closing cell)
    await setCellViaApi(window, 0, 0, '=B1');
    await setCellViaApi(window, 0, 1, '=A1');
    await expect(window.locator('#cell-0-2')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });

    // Delete column C (breaks C1 but preserves cycle)
    await apiDeleteColumn(window, 2);
    // Undo — C1 should be restored and show error (A1 is in cycle)
    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-2')).toHaveClass(/error-cell/, {
      timeout: 3000,
    });
    const text = await window.locator('#cell-0-2').textContent();
    expect(text).toMatch(/^#ERROR/);
  });
});
