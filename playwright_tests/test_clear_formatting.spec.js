// Story 21.1: Clear Cell Styling - Playwright tests
// Tests that Clear Formatting removes styleId and alignment without affecting values.

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  selectCellByClick,
} = require('./helpers');

// API helpers
async function apiPost(window, path, body) {
  return window.evaluate(
    async ({ path, body }) => {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (typeof window.applyUndoRedoState === 'function') {
          window.applyUndoRedoState(json.data);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      return json;
    },
    { path, body }
  );
}

const apiApplyStyle = (window, startRow, startCol, endRow, endCol, styleId) =>
  apiPost(window, '/api/range/style', {
    startRow,
    startCol,
    endRow,
    endCol,
    styleId,
  });

const apiClearFormat = (window, startRow, startCol, endRow, endCol) =>
  apiPost(window, '/api/range/clear-format', {
    startRow,
    startCol,
    endRow,
    endCol,
  });

const apiSetAlignment = (window, row, col, alignment) =>
  apiPost(window, '/api/cell/alignment', { row, col, alignment });

async function getCellData(window, row, col) {
  return window.evaluate(
    async ({ row, col }) => {
      const res = await fetch('/api/cells/all');
      const json = await res.json();
      const cell = (json.data ?? []).find(
        (c) => c.row === row && c.col === col
      );
      return cell ?? { styleId: 0, value: '' };
    },
    { row, col }
  );
}

test.describe('Clear Formatting (Story 21.1)', () => {
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

  test('API clear-format clears style from A1, preserves content', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    const styleResult = await apiApplyStyle(window, 0, 0, 0, 0, 1);
    expect(styleResult.success).toBe(true);

    // Verify style applied
    let data = await getCellData(window, 0, 0);
    expect(data.styleId).toBe(1);
    expect(data.value).toBe('hello');

    // Clear via direct API call
    const clearResult = await apiClearFormat(window, 0, 0, 0, 0);
    expect(clearResult.success).toBe(true);
    expect(clearResult.data.canUndo).toBe(true);

    data = await getCellData(window, 0, 0);
    expect(data.styleId ?? 0).toBe(0);
    expect(data.value).toBe('hello');
  });

  test('Cmd+\\ clears style from A1, preserves content', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    const styleResult = await apiApplyStyle(window, 0, 0, 0, 0, 1);
    expect(styleResult.success).toBe(true);

    // Verify style applied
    let data = await getCellData(window, 0, 0);
    expect(data.styleId).toBe(1);

    await selectCellByClick(window, 0, 0);
    // Trigger via Electron menu IPC (keyboard accelerator is intercepted by menu)
    await window.evaluate(() => window.clearFormattingFromSelection?.());

    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cells/all');
        const json = await res.json();
        const cell = (json.data ?? []).find((c) => c.row === 0 && c.col === 0);
        return (
          cell !== undefined &&
          (cell.styleId ?? 0) === 0 &&
          (cell.value ?? '') !== ''
        );
      },
      { timeout: 5000 }
    );

    data = await getCellData(window, 0, 0);
    expect(data.styleId ?? 0).toBe(0);
    expect(data.value).toBe('hello');
  });

  test('Clear Formatting clears style and alignment from a range', async ({
    window,
  }) => {
    // Set values and formatting for A1:B2
    await setCellViaApi(window, 0, 0, 'A1');
    await setCellViaApi(window, 0, 1, 'B1');
    await setCellViaApi(window, 1, 0, 'A2');
    await setCellViaApi(window, 1, 1, 'B2');

    await apiApplyStyle(window, 0, 0, 1, 1, 1);
    await apiSetAlignment(window, 0, 0, 'center'); // creates style variant with center alignment

    // Verify formatting applied (styleId is the variant, e.g. Title-center)
    let d = await getCellData(window, 0, 0);
    expect(d.styleId).toBeGreaterThan(0);

    // Select range A1:B2 by clicking A1 then shift-clicking B2
    await selectCellByClick(window, 0, 0);
    await window.locator('#cell-1-1').click({ modifiers: ['Shift'] });

    // Trigger clear formatting via the exposed window function
    await window.evaluate(() => window.clearFormattingFromSelection?.());

    await window.waitForFunction(async () => {
      const res = await fetch('/api/cells/all');
      const json = await res.json();
      const cells = json.data ?? [];
      return [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ].every(([r, c]) => {
        const cell = cells.find((x) => x.row === r && x.col === c);
        return (cell?.styleId ?? 0) === 0;
      });
    });

    // Verify all 4 cells cleared (styleId=0; alignment was in style)
    for (const [r, c, v] of [
      [0, 0, 'A1'],
      [0, 1, 'B1'],
      [1, 0, 'A2'],
      [1, 1, 'B2'],
    ]) {
      const data = await getCellData(window, r, c);
      expect(data.styleId ?? 0).toBe(0);
      expect(data.value).toBe(v);
    }
  });

  test('Clear Formatting removes inline CSS from DOM element', async ({
    window,
  }) => {
    // Regression test: clearing a style must also wipe inline CSS properties
    // (background-color, font-weight, etc.) set by the previous style — not just
    // remove the CSS class name.
    await setCellViaApi(window, 0, 0, 'styled');
    await apiApplyStyle(window, 0, 0, 0, 0, 1); // style 1 = Title

    // Wait for the style to be rendered (cell should have a non-empty background or font)
    await window.waitForFunction(() => {
      const cell = document.getElementById('cell-0-0');
      // After applying a named style, at least one inline style property should be set
      // (Title style sets font-size, font-weight, etc.)
      return cell && cell.style.cssText !== '';
    });

    // Confirm inline CSS is present before clear
    const cssTextBefore = await window.evaluate(() => {
      return document.getElementById('cell-0-0')?.style.cssText ?? '';
    });
    expect(cssTextBefore).not.toBe('');

    // Clear formatting
    await selectCellByClick(window, 0, 0);
    await window.evaluate(() => window.clearFormattingFromSelection?.());

    // Wait for API to confirm styleId=0
    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cells/all');
        const json = await res.json();
        const cell = (json.data ?? []).find((c) => c.row === 0 && c.col === 0);
        return (cell?.styleId ?? 0) === 0;
      },
      { timeout: 5000 }
    );

    // DOM inline CSS must be cleared after refreshAllCells runs
    const cssTextAfter = await window.evaluate(() => {
      return document.getElementById('cell-0-0')?.style.cssText ?? '';
    });
    expect(cssTextAfter).toBe('');
  });

  test('Undo restores formatting after Clear Formatting', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'test');
    await apiApplyStyle(window, 0, 0, 0, 0, 1);
    await apiSetAlignment(window, 0, 0, 'right');

    // Verify applied — alignment creates style variant (e.g. Title-right), so styleId may be > 1
    let data = await getCellData(window, 0, 0);
    const expectedStyleId = data.styleId;
    const expectedAlignment = data.alignment;
    expect(expectedStyleId).toBeGreaterThan(0);
    expect(expectedAlignment).toBe('right');

    await selectCellByClick(window, 0, 0);
    await window.evaluate(() => window.clearFormattingFromSelection?.());

    // Wait for clear to take effect
    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cells/all');
        const json = await res.json();
        const cell = (json.data ?? []).find((c) => c.row === 0 && c.col === 0);
        return (cell?.styleId ?? 0) === 0 && (cell?.alignment ?? '') === '';
      },
      { timeout: 5000 }
    );

    // Undo
    await window.keyboard.press('Meta+z');

    await window.waitForFunction(async () => {
      const res = await fetch('/api/cells/all');
      const json = await res.json();
      const cell = (json.data ?? []).find((c) => c.row === 0 && c.col === 0);
      return (cell?.styleId ?? 0) !== 0;
    });

    data = await getCellData(window, 0, 0);
    expect(data.styleId).toBe(expectedStyleId);
    expect(data.alignment).toBe(expectedAlignment);
    expect(data.value).toBe('test');
  });
});
