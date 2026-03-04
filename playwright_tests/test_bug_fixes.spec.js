// Story 13.6: Bug Fixes (Formula, Merge, Scroll)
// Tests for:
// 1. Invalid formula shows #ERROR instead of literal text
// 2. Merge refuses when multiple cells have content
// 3. Scroll position preserved after grid expansion

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

test.describe('Bug Fix: Invalid formula shows error (Story 13.6 AC1/AC2)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test.afterEach(async ({ window }) => {
    await setCellViaApi(window, 0, 0, '');
  });

  test('bare "=" shows #ERROR not literal =', async ({ window }) => {
    await setCellViaApi(window, 0, 0, '=');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toBeVisible();
    const text = await cell.textContent();
    expect(text).toMatch(/^#ERROR/);
    expect(text).not.toBe('=');
  });

  test('"=hello" (function without parens) shows #ERROR not literal text', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '=hello');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toBeVisible();
    const text = await cell.textContent();
    expect(text).toMatch(/^#ERROR/);
    expect(text).not.toBe('=hello');
  });

  test('"=1+" (malformed expression) shows #ERROR', async ({ window }) => {
    await setCellViaApi(window, 0, 0, '=1+');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toBeVisible();
    const text = await cell.textContent();
    expect(text).toMatch(/^#ERROR/);
  });

  test('error cell has error-cell CSS class', async ({ window }) => {
    await setCellViaApi(window, 0, 0, '=');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveClass(/error-cell/);
  });
});

test.describe('Bug Fix: Merge refuses multiple content cells (Story 13.6 AC3)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test.afterEach(async ({ window }) => {
    await setCellViaApi(window, 0, 0, '');
    await setCellViaApi(window, 0, 1, '');
  });

  test('UI shows alert when merging cells with multiple content cells', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await setCellViaApi(window, 0, 1, 'world');

    // Select A1:B1
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-0-1').click({ modifiers: ['Shift'] });

    // Trigger Format → Merge Cells from menu
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const formatMenu = menu.items.find((item) => item.label === 'Format');
      const mergeItem = formatMenu?.submenu?.items.find(
        (item) => item.label === 'Merge Cells'
      );
      if (mergeItem?.click) mergeItem.click();
    });

    // Alert modal should appear with error message
    const overlay = window.locator('#modal-overlay');
    await expect(overlay).toHaveClass(/active/, { timeout: 2000 });
    const message = await window.locator('#modal-message').textContent();
    expect(message).toMatch(/only one cell|content to merge/i);

    // Dismiss alert
    await window.locator('#modal-ok').click();
  });

  test('merge API returns error when multiple cells have content', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await setCellViaApi(window, 0, 1, 'world');

    // Call SetMerge directly via API
    const result = await window.evaluate(async () => {
      const res = await fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startRow: 0,
          startCol: 0,
          rowSpan: 1,
          colSpan: 2,
        }),
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, body: text };
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.body).toMatch(/only one cell/i);
  });

  test('merge succeeds when only anchor cell has content', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    // col 1 is empty

    const result = await window.evaluate(async () => {
      const res = await fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startRow: 0,
          startCol: 0,
          rowSpan: 1,
          colSpan: 2,
        }),
      });
      return res.json();
    });

    expect(result.success).toBe(true);

    // Clean up merge
    await window.evaluate(async () => {
      await fetch('/api/unmerge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startRow: 0, startCol: 0 }),
      });
    });
  });
});

test.describe('Bug Fix: Scroll position preserved after grid expansion (Story 13.6 AC4)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('scroll position is preserved after grid expansion', async ({
    window,
  }) => {
    const table = window.locator('#spreadsheet');

    // Count initial rows
    const initialRowCount = await table.locator('tr[role="row"]').count();

    // Scroll to bottom to trigger expansion
    await window.evaluate(() => {
      const c = document.querySelector('.spreadsheet-container');
      c.scrollTop = c.scrollHeight;
    });

    // Wait for DOM to gain more rows (expansion + rebuild complete)
    await window.waitForFunction(
      (initial) => {
        const t = document.getElementById('spreadsheet');
        return t && t.querySelectorAll('tr[role="row"]').length > initial;
      },
      initialRowCount,
      { timeout: 3000 }
    );

    const finalRowCount = await table.locator('tr[role="row"]').count();
    expect(finalRowCount).toBeGreaterThan(initialRowCount);

    // Scroll position should be close to scrollHeight (not reset to top)
    const scrollTop = await window.evaluate(
      () => document.querySelector('.spreadsheet-container').scrollTop
    );
    expect(scrollTop).toBeGreaterThan(0);
  });
});
