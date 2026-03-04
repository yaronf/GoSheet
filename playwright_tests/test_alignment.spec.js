// Story 13.8: Cell alignment (left / center / right)

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

// Helper: set cell-level alignment via API and refresh
async function setCellAlignmentViaApi(window, row, col, alignment) {
  await window.evaluate(
    async ({ row, col, alignment }) => {
      const res = await fetch('/api/cell/alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col, alignment }),
      });
      const json = await res.json();
      if (json.success && typeof window.refreshAllCells === 'function') {
        await window.refreshAllCells();
      }
      return json;
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
      const res = await fetch('/api/range/alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startRow, startCol, endRow, endCol, alignment }),
      });
      const json = await res.json();
      if (json.success && typeof window.refreshAllCells === 'function') {
        await window.refreshAllCells();
      }
      return json;
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
    // Clear alignment on cleanup cells
    await setCellAlignmentViaApi(window, 0, 0, '');
    await setCellAlignmentViaApi(window, 0, 1, '');
    await setCellAlignmentViaApi(window, 0, 2, '');
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

  test('cell-level alignment overrides style alignment', async ({ window }) => {
    // Apply Header style (styleId=2, has center alignment), then override with left
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
    // Now override with cell-level left alignment
    await setCellAlignmentViaApi(window, 0, 0, 'left');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('header');
    const textAlign = await cell.evaluate((el) => el.style.textAlign);
    expect(textAlign).toBe('left');
  });

  test('alignment persists after save and reload (via API roundtrip)', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'test');
    await setCellAlignmentViaApi(window, 0, 0, 'right');
    // Re-fetch cells via API to confirm alignment is stored
    const alignment = await window.evaluate(async () => {
      const res = await fetch('/api/cells/all');
      const json = await res.json();
      const cell = (json.data || []).find((c) => c.row === 0 && c.col === 0);
      return cell?.alignment ?? '';
    });
    expect(alignment).toBe('right');
  });
});
