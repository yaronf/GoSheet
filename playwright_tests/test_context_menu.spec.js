// Story 13.2: Context Menu (Right-Click) - Playwright tests
// Tests right-click context menu: Copy, Paste, Format, Clear

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  selectCellViaApp,
} = require('./helpers');

test.describe('Context menu (Story 13.2)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    const newBtn = window.locator('#new-btn');
    await newBtn.click();
    await expect(window.locator('#cell-0-0')).toBeVisible();
  });

  test('right-click on cell shows context menu', async ({ window }) => {
    const cell = window.locator('#cell-0-0');
    await cell.click({ button: 'right' });
    const menu = window.locator('#context-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('[data-action="copy"]')).toBeVisible();
    await expect(menu.locator('[data-action="paste"]')).toBeVisible();
    await expect(menu.locator('[data-action="clear"]')).toBeVisible();
    await expect(menu.locator('[data-action^="format-style-"]')).toHaveCount(
      3,
      { timeout: 3000 }
    );
  });

  test('context menu Copy then Paste works', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'copied');
    await selectCellViaApp(window, 0, 0);

    const cell = window.locator('#cell-0-0');
    await cell.click({ button: 'right' });
    await window.locator('#context-menu [data-action="copy"]').click();
    await expect(window.locator('#context-menu')).toBeHidden();

    await selectCellViaApp(window, 0, 1);
    const cellB1 = window.locator('#cell-0-1');
    await cellB1.click({ button: 'right' });
    await window.locator('#context-menu [data-action="paste"]').click();

    await expect(window.locator('#cell-0-1')).toHaveText('copied');
  });

  test('context menu Clear clears selection', async ({ window }) => {
    await setCellViaApi(window, 1, 1, 'to-clear');
    await selectCellViaApp(window, 1, 1);

    const cell = window.locator('#cell-1-1');
    await cell.click({ button: 'right' });
    await window.locator('#context-menu [data-action="clear"]').click();

    await expect(window.locator('#cell-1-1')).toHaveText('');
  });

  test('context menu Format Title applies style', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'Title Cell');
    await selectCellViaApp(window, 0, 0);

    const cell = window.locator('#cell-0-0');
    await cell.click({ button: 'right' });
    await expect(
      window.locator('#context-menu [data-action="format-style-1"]')
    ).toBeVisible({ timeout: 3000 });
    await window
      .locator('#context-menu [data-action="format-style-1"]')
      .click();

    const styledCell = window.locator('#cell-0-0');
    await expect(styledCell).toHaveClass(/style-title/);
    await expect(styledCell).toHaveText('Title Cell');
  });

  test('right-click on row header shows context menu', async ({ window }) => {
    const rowHeader = window.locator('.row-header[data-row="2"]');
    await rowHeader.click({ button: 'right' });
    const menu = window.locator('#context-menu');
    await expect(menu).toBeVisible();
  });

  test('right-click on column header shows context menu', async ({
    window,
  }) => {
    const colHeader = window.locator('.column-header[data-col="1"]');
    await colHeader.click({ button: 'right' });
    const menu = window.locator('#context-menu');
    await expect(menu).toBeVisible();
  });

  test('context menu Clear clears range', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'a');
    await setCellViaApi(window, 0, 1, 'b');
    await setCellViaApi(window, 1, 0, 'c');
    await setCellViaApi(window, 1, 1, 'd');
    const cellA1 = window.locator('#cell-0-0');
    const cellB2 = window.locator('#cell-1-1');
    await cellA1.click();
    await cellB2.click({ modifiers: ['Shift'] });

    const cell = window.locator('#cell-0-0');
    await cell.click({ button: 'right' });
    await window.locator('#context-menu [data-action="clear"]').click();

    await expect(window.locator('#cell-0-0')).toHaveText('');
    await expect(window.locator('#cell-0-1')).toHaveText('');
    await expect(window.locator('#cell-1-0')).toHaveText('');
    await expect(window.locator('#cell-1-1')).toHaveText('');
  });
});
