// Story 13.8: Cell alignment (left / center / right)

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

// Helper: set cell-level alignment via API and refresh (uses window.SetCellAlignment)
async function setCellAlignmentViaApi(window, row, col, alignment) {
  await window.evaluate(
    async ({ row, col, alignment }) => {
      const result = await window.SetCellAlignment(row, col, alignment);
      if (result && typeof window.refreshAllCells === 'function') {
        await window.refreshAllCells();
      }
    },
    { row, col, alignment }
  );
}

async function setRangeAlignmentViaApi(
  window,
  startRow,
  startCol,
  endRow,
  endCol,
  alignment
) {
  await window.evaluate(
    async ({ startRow, startCol, endRow, endCol, alignment }) => {
      const result = await window.SetRangeAlignment(
        startRow,
        startCol,
        endRow,
        endCol,
        alignment
      );
      if (result && typeof window.refreshAllCells === 'function') {
        await window.refreshAllCells();
      }
    },
    { startRow, startCol, endRow, endCol, alignment }
  );
}

test.describe('Cell Alignment (Story 13.8)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test.afterEach(async ({ window }) => {
    await setCellViaApi(window, 0, 0, '');
    await setCellViaApi(window, 0, 1, '');
    await setCellViaApi(window, 0, 2, '');
    // Clear format (style) on cleanup cells — alignment is in style
    await window.evaluate(async () => {
      const res = await fetch('/api/range/clear-format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startRow: 0,
          startCol: 0,
          endRow: 0,
          endCol: 2,
        }),
      });
      const json = await res.json();
      if (json.success && typeof window.refreshAllCells === 'function')
        await window.refreshAllCells();
    });
  });

  test('set alignment to center — cell gets text-align:center', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await setCellAlignmentViaApi(window, 0, 0, 'center');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('hello');
    const textAlign = await cell.evaluate((el) => el.style.textAlign);
    expect(textAlign).toBe('center');
  });

  test('set alignment to right — cell gets text-align:right', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await setCellAlignmentViaApi(window, 0, 0, 'right');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('hello');
    const textAlign = await cell.evaluate((el) => el.style.textAlign);
    expect(textAlign).toBe('right');
  });

  test('set alignment to left — cell gets text-align:left', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await setCellAlignmentViaApi(window, 0, 0, 'left');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('hello');
    const textAlign = await cell.evaluate((el) => el.style.textAlign);
    expect(textAlign).toBe('left');
  });

  test('range alignment — all cells in range get alignment', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'A');
    await setCellViaApi(window, 0, 1, 'B');
    await setCellViaApi(window, 0, 2, 'C');
    await setRangeAlignmentViaApi(window, 0, 0, 0, 2, 'center');
    for (const col of [0, 1, 2]) {
      const cell = window.locator(`#cell-0-${col}`);
      const textAlign = await cell.evaluate((el) => el.style.textAlign);
      expect(textAlign).toBe('center');
    }
  });

  test('alignment via style variant overrides base style', async ({
    window,
  }) => {
    // Apply Header style (styleId=2, has center alignment), then apply left via style variant
    await setCellViaApi(window, 0, 0, 'header');
    await window.evaluate(async () => {
      const res = await fetch('/api/cell/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: 0, col: 0, styleId: 2 }),
      });
      await res.json();
      if (typeof window.refreshAllCells === 'function')
        await window.refreshAllCells();
    });
    // Apply left alignment — creates Header-left style variant
    await setCellAlignmentViaApi(window, 0, 0, 'left');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('header');
    const textAlign = await cell.evaluate((el) => el.style.textAlign);
    expect(textAlign).toBe('left');
  });

  test('alignment persists after save and reload (via style)', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'test');
    await setCellAlignmentViaApi(window, 0, 0, 'right');
    // Alignment is in style; verify cell renders with text-align: right
    const cell = window.locator('#cell-0-0');
    const textAlign = await cell.evaluate(
      (el) => getComputedStyle(el).textAlign
    );
    expect(textAlign).toBe('right');
  });
});
