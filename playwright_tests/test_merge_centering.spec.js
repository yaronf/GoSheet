// Story 13.9: Merged cell text centering

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  setMergeViaApi,
} = require('./helpers');
const os = require('os');
const path = require('path');
const fs = require('fs');

async function unmergeViaApi(window, startRow, startCol) {
  await window.evaluate(
    async ({ startRow, startCol }) => {
      const res = await fetch('/api/unmerge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startRow, startCol }),
      });
      await res.text();
      if (typeof window.buildSpreadsheet === 'function') {
        await window.buildSpreadsheet();
        if (typeof window.refreshAllCells === 'function') {
          await window.refreshAllCells();
        }
      }
    },
    { startRow, startCol }
  );
}

test.describe('Merge Text Centering (Story 13.9)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test.afterEach(async ({ window }) => {
    await unmergeViaApi(window, 0, 0);
    await setCellViaApi(window, 0, 0, '');
    await setCellViaApi(window, 0, 1, '');
    await setCellViaApi(window, 1, 0, '');
  });

  test('merged anchor cell has merged-anchor class', async ({ window }) => {
    await setMergeViaApi(window, 0, 0, 1, 2);
    const cell = window.locator('#cell-0-0');
    await expect(cell).toBeVisible();
    const classes = await cell.getAttribute('class');
    expect(classes).toMatch(/merged-anchor/);
  });

  test('merged anchor cell text is centered by default (CSS)', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'Header');
    await setMergeViaApi(window, 0, 0, 1, 2);
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('Header');
    // merged-anchor class gives text-align:center via CSS
    const classes = await cell.getAttribute('class');
    expect(classes).toMatch(/merged-anchor/);
    const computedAlign = await cell.evaluate(
      (el) => getComputedStyle(el).textAlign
    );
    expect(computedAlign).toBe('center');
  });

  test('plain (non-merged) cell does NOT have merged-anchor class', async ({
    window,
  }) => {
    await setCellViaApi(window, 1, 0, 'plain');
    const cell = window.locator('#cell-1-0');
    await expect(cell).toHaveText('plain');
    const classes = await cell.getAttribute('class');
    expect(classes).not.toMatch(/merged-anchor/);
  });

  test('merged anchor centering persists after save and reload (AC2)', async ({
    window,
  }) => {
    const testFilePath = path.join(os.tmpdir(), 'test-merge-centering.sheet');
    try {
      await setCellViaApi(window, 0, 0, 'Header');
      await setMergeViaApi(window, 0, 0, 1, 2);

      // Save via HTTP API
      await window.evaluate(async (filePath) => {
        await fetch('/api/file/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath }),
        });
      }, testFilePath);

      // Start fresh
      await window.evaluate(async () => {
        await fetch('/api/file/new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (typeof window.buildSpreadsheet === 'function')
          await window.buildSpreadsheet();
        if (typeof window.refreshAllCells === 'function')
          await window.refreshAllCells();
      });

      // Reload saved file
      await window.evaluate(async (filePath) => {
        await fetch('/api/file/load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath }),
        });
        if (typeof window.buildSpreadsheet === 'function')
          await window.buildSpreadsheet();
        if (typeof window.refreshAllCells === 'function')
          await window.refreshAllCells();
      }, testFilePath);

      // Verify merged-anchor class and centering survive the reload
      const cell = window.locator('#cell-0-0');
      await expect(cell).toBeVisible();
      const classes = await cell.getAttribute('class');
      expect(classes).toMatch(/merged-anchor/);
      const computedAlign = await cell.evaluate(
        (el) => getComputedStyle(el).textAlign
      );
      expect(computedAlign).toBe('center');
    } finally {
      if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    }
  });

  test('merged cell with explicit alignment overrides centering', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'Left');
    await setMergeViaApi(window, 0, 0, 1, 2);
    // Apply left alignment via API (Story 13.8)
    await window.evaluate(async () => {
      const res = await fetch('/api/cell/alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: 0, col: 0, alignment: 'left' }),
      });
      await res.json();
      if (typeof window.refreshAllCells === 'function') {
        await window.refreshAllCells();
      }
    });
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('Left');
    // Inline style from Story 13.8 should override CSS merged-anchor centering
    const textAlign = await cell.evaluate((el) => el.style.textAlign);
    expect(textAlign).toBe('left');
    // Clean alignment
    await window.evaluate(async () => {
      await fetch('/api/cell/alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: 0, col: 0, alignment: '' }),
      });
    });
  });
});
