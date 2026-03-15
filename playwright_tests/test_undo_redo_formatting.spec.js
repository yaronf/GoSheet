// Story 15.4: Undo/Redo for Formatting Operations
// Tests style, alignment, merge/unmerge with undo (Cmd+Z) and redo (Cmd+Shift+Z).

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

// Direct API helpers for formatting operations
async function apiFormat(window, path, body) {
  return window.evaluate(
    async ({ path, body }) => {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (
        json.success &&
        json.data &&
        typeof window.applyUndoRedoState === 'function'
      ) {
        window.applyUndoRedoState(json.data);
      }
      return json;
    },
    { path, body }
  );
}

const apiApplyStyle = (window, startRow, startCol, endRow, endCol, styleId) =>
  apiFormat(window, '/api/range/style', {
    startRow,
    startCol,
    endRow,
    endCol,
    styleId,
  });

const apiSetAlignment = (window, row, col, alignment) =>
  apiFormat(window, '/api/cell/alignment', { row, col, alignment });

const apiMerge = (window, startRow, startCol, rowSpan, colSpan) =>
  apiFormat(window, '/api/merge', { startRow, startCol, rowSpan, colSpan });

const apiUnmerge = (window, startRow, startCol) =>
  apiFormat(window, '/api/unmerge', { startRow, startCol });

// Get a cell's styleId from the backend
async function getCellStyleId(window, row, col) {
  return window.evaluate(
    async ({ row, col }) => {
      const res = await fetch('/api/cells/all');
      const json = await res.json();
      const cell = (json.data ?? []).find(
        (c) => c.row === row && c.col === col
      );
      return cell?.styleId ?? 0;
    },
    { row, col }
  );
}

// Get a cell's alignment from the backend
async function getCellAlignment(window, row, col) {
  return window.evaluate(
    async ({ row, col }) => {
      const res = await fetch('/api/cells/all');
      const json = await res.json();
      const cell = (json.data ?? []).find(
        (c) => c.row === row && c.col === col
      );
      return cell?.alignment ?? '';
    },
    { row, col }
  );
}

// Get current merge list from the backend
async function getMerges(window) {
  return window.evaluate(async () => {
    const res = await fetch('/api/merges');
    const json = await res.json();
    return json.data?.merges ?? [];
  });
}

test.describe('Undo/Redo formatting operations (Story 15.4)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    await window.locator('#new-btn').click();
    const modal = window.locator('#modal-overlay');
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await window.locator('#modal-ok').click();
      await expect(modal).toBeHidden();
    }
    await expect(window.locator('#cell-0-0')).toBeVisible({ timeout: 10000 });
    await expect(window.locator('#file-status')).toContainText('Saved', {
      timeout: 5000,
    });
  });

  test('Apply style to cell → Cmd+Z reverts style', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'hello');

    // Apply style 1 (Title) to A1
    const result = await apiApplyStyle(window, 0, 0, 0, 0, 1);
    expect(result.data.canUndo).toBe(true);
    expect(result.data.undoDescription).toContain('Apply Style');

    const styleAfter = await getCellStyleId(window, 0, 0);
    expect(styleAfter).toBe(1);

    // Undo → style should revert to 0
    await window.keyboard.press('Meta+z');
    const styleUndone = await getCellStyleId(window, 0, 0);
    expect(styleUndone).toBe(0);
  });

  test('Apply style to cell → Cmd+Z → Cmd+Shift+Z redoes style', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await apiApplyStyle(window, 0, 0, 0, 0, 2);

    await window.keyboard.press('Meta+z');
    expect(await getCellStyleId(window, 0, 0)).toBe(0);

    await window.keyboard.press('Meta+Shift+z');
    expect(await getCellStyleId(window, 0, 0)).toBe(2);
  });

  test('Apply style to range → Cmd+Z restores per-cell previous styles', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'A');
    await setCellViaApi(window, 0, 1, 'B');
    // Give A1 an existing style before the range apply
    await apiApplyStyle(window, 0, 0, 0, 0, 2); // A1 = Header (2)
    await window.keyboard.press('Meta+z'); // undo that so history is fresh
    await apiApplyStyle(window, 0, 0, 0, 0, 2); // re-apply cleanly

    // Now apply style 3 to range A1:B1
    await apiApplyStyle(window, 0, 0, 0, 1, 3);
    expect(await getCellStyleId(window, 0, 0)).toBe(3);
    expect(await getCellStyleId(window, 0, 1)).toBe(3);

    // Undo → A1 back to 2, B1 back to 0
    await window.keyboard.press('Meta+z');
    expect(await getCellStyleId(window, 0, 0)).toBe(2);
    expect(await getCellStyleId(window, 0, 1)).toBe(0);
  });

  test('Change alignment → Cmd+Z reverts alignment', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'hello');

    const result = await apiSetAlignment(window, 0, 0, 'center');
    expect(result.data.canUndo).toBe(true);
    expect(result.data.undoDescription).toContain('Align');

    expect(await getCellAlignment(window, 0, 0)).toBe('center');

    await window.keyboard.press('Meta+z');
    expect(await getCellAlignment(window, 0, 0)).toBe('');
  });

  test('Change alignment → Cmd+Z → Cmd+Shift+Z redoes alignment', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await apiSetAlignment(window, 0, 0, 'right');

    await window.keyboard.press('Meta+z');
    expect(await getCellAlignment(window, 0, 0)).toBe('');

    await window.keyboard.press('Meta+Shift+z');
    expect(await getCellAlignment(window, 0, 0)).toBe('right');
  });

  test('Merge cells → Cmd+Z removes merge', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'anchor');

    const result = await apiMerge(window, 0, 0, 1, 2);
    expect(result.data.canUndo).toBe(true);
    expect(result.data.undoDescription).toContain('Merge');

    const mergesAfter = await getMerges(window);
    expect(mergesAfter.length).toBe(1);

    await window.keyboard.press('Meta+z');
    const mergesUndone = await getMerges(window);
    expect(mergesUndone.length).toBe(0);
  });

  test('Merge cells → Cmd+Z → Cmd+Shift+Z redoes merge', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'anchor');
    await apiMerge(window, 0, 0, 1, 2);

    await window.keyboard.press('Meta+z');
    expect((await getMerges(window)).length).toBe(0);

    await window.keyboard.press('Meta+Shift+z');
    const mergesRedone = await getMerges(window);
    expect(mergesRedone.length).toBe(1);
    expect(mergesRedone[0].startRow).toBe(0);
    expect(mergesRedone[0].colSpan).toBe(2);
  });

  test('Unmerge → Cmd+Z restores merge', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'anchor');
    await apiMerge(window, 0, 0, 2, 2);

    const result = await apiUnmerge(window, 0, 0);
    expect(result.data.canUndo).toBe(true);
    expect(result.data.undoDescription).toContain('Unmerge');

    expect((await getMerges(window)).length).toBe(0);

    await window.keyboard.press('Meta+z');
    const mergesRestored = await getMerges(window);
    expect(mergesRestored.length).toBe(1);
    expect(mergesRestored[0].startRow).toBe(0);
    expect(mergesRestored[0].startCol).toBe(0);
    expect(mergesRestored[0].rowSpan).toBe(2);
    expect(mergesRestored[0].colSpan).toBe(2);
  });

  test('Mixed ops undo in correct order', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'hello'); // op 1
    await apiSetAlignment(window, 0, 0, 'center'); // op 2
    const styleIdAfterAlignment = await getCellStyleId(window, 0, 0); // alignment creates a style variant
    await apiApplyStyle(window, 0, 0, 0, 0, 1); // op 3

    expect(await getCellAlignment(window, 0, 0)).toBe('center');
    expect(await getCellStyleId(window, 0, 0)).toBe(1);

    // Undo style (op 3) — restores to alignment-only variant (styleIdAfterAlignment)
    await window.keyboard.press('Meta+z');
    expect(await getCellStyleId(window, 0, 0)).toBe(styleIdAfterAlignment);
    expect(await getCellAlignment(window, 0, 0)).toBe('center'); // alignment still set

    // Undo alignment (op 2)
    await window.keyboard.press('Meta+z');
    expect(await getCellAlignment(window, 0, 0)).toBe('');

    // Undo setCellViaApi (op 1)
    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-0')).toHaveText('', { timeout: 2000 });
  });

  test('API response includes canUndo after apply style', async ({
    window,
  }) => {
    const result = await apiApplyStyle(window, 0, 0, 0, 0, 1);
    expect(result.data.canUndo).toBe(true);
    expect(result.data.canRedo).toBe(false);
    expect(result.data.undoDescription).toContain('Apply Style');
  });
});
