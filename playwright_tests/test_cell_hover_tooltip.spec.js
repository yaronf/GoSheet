// Story 13.5: Cell Hover for Long Content
// Tests that cells show a native title tooltip for error messages and long text,
// and no tooltip for short text or empty cells.

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

test.describe('Cell Hover Tooltip (Story 13.5)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test.afterEach(async ({ window }) => {
    // Clear cells used by tooltip tests to avoid cross-test contamination
    for (let col = 0; col < 5; col++) {
      await setCellViaApi(window, 0, col, '');
    }
  });

  test('error cell has title attribute with full error message', async ({
    window,
  }) => {
    // Set a formula that produces a circular reference error
    await setCellViaApi(window, 0, 0, '=A1');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toBeVisible();
    // Error cells should have a title containing the full #ERROR message
    const title = await cell.getAttribute('title');
    expect(title).toBeTruthy();
    expect(title).toMatch(/^#ERROR/);
  });

  test('long text cell has title attribute with full text', async ({
    window,
  }) => {
    const longText = 'This is a very long text that exceeds the threshold';
    await setCellViaApi(window, 0, 1, longText);
    const cell = window.locator('#cell-0-1');
    await expect(cell).toBeVisible();
    const title = await cell.getAttribute('title');
    expect(title).toBe(longText);
  });

  test('short text cell has no title attribute', async ({ window }) => {
    await setCellViaApi(window, 0, 2, 'Hi');
    const cell = window.locator('#cell-0-2');
    await expect(cell).toBeVisible();
    const title = await cell.getAttribute('title');
    // Title should be empty string or null for short content
    expect(title == null || title === '').toBe(true);
  });

  test('empty cell has no title attribute', async ({ window }) => {
    // Cell that was never set should have no title
    const cell = window.locator('#cell-1-1');
    await expect(cell).toBeVisible();
    const title = await cell.getAttribute('title');
    expect(title == null || title === '').toBe(true);
  });

  test('text exactly at threshold (25 chars) has no title', async ({
    window,
  }) => {
    const exactText = '1234567890123456789012345'; // 25 chars
    await setCellViaApi(window, 0, 3, exactText);
    const cell = window.locator('#cell-0-3');
    await expect(cell).toBeVisible();
    const title = await cell.getAttribute('title');
    expect(title == null || title === '').toBe(true);
  });

  test('text just over threshold (26 chars) has title', async ({ window }) => {
    const overText = '12345678901234567890123456'; // 26 chars
    await setCellViaApi(window, 0, 4, overText);
    const cell = window.locator('#cell-0-4');
    await expect(cell).toBeVisible();
    const title = await cell.getAttribute('title');
    expect(title).toBe(overText);
  });

  test('title is correct after loadCells (refreshAllCells path)', async ({
    window,
  }) => {
    const longText = 'This text is definitely longer than twenty-five chars';
    await setCellViaApi(window, 1, 0, longText);
    // Trigger a full cell refresh via the API to exercise the loadCells/refreshAllCells path
    await window.evaluate(async () => {
      if (typeof window.refreshAllCells === 'function') {
        await window.refreshAllCells();
      }
    });
    const cell = window.locator('#cell-1-0');
    await expect(cell).toBeVisible();
    const title = await cell.getAttribute('title');
    expect(title).toBe(longText);
    // Cleanup
    await setCellViaApi(window, 1, 0, '');
  });
});
