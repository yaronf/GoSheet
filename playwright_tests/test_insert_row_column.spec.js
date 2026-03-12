// Story 13.1: Row/Column Selection and Insert - Playwright tests
// Tests row/column header selection and Edit menu (Insert Row Above, Insert Column Before)

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  selectCellViaApp,
} = require('./helpers');

test.describe('Row/Column selection and Insert (Story 13.1)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    const newBtn = window.locator('#new-btn');
    await newBtn.click();
    // Handle unsaved changes modal if it appears (previous test may have left unsaved data)
    const modal = window.locator('#modal-overlay');
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await window.locator('#modal-ok').click();
      await expect(modal).toBeHidden();
    }
    await expect(window.locator('#cell-0-0')).toBeVisible();
    // Wait for the new-file flow (NewFile + buildSpreadsheet + loadCells) to fully complete
    await expect(window.locator('#file-status')).toContainText('Saved', {
      timeout: 3000,
    });
  });

  test('clicking row header selects row and enables Insert Row Above', async ({
    electronApp,
    window,
  }) => {
    const rowHeader = window.locator('.row-header[data-row="2"]');
    await rowHeader.click();
    await expect(window.locator('#cell-2-0')).toHaveClass(/selected/, {
      timeout: 2000,
    });

    const menuState = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu?.items?.find((item) => item.label === 'Edit');
      const items = editMenu?.submenu?.items;
      return {
        insertRowEnabled:
          items?.find((item) => item.label === 'Insert Row Above')?.enabled ??
          false,
        deleteRowEnabled:
          items?.find((item) => item.label === 'Delete Row')?.enabled ?? false,
        insertColEnabled:
          items?.find((item) => item.label === 'Insert Column Before')
            ?.enabled ?? false,
        deleteColEnabled:
          items?.find((item) => item.label === 'Delete Column')?.enabled ??
          false,
      };
    });
    expect(menuState.insertRowEnabled).toBe(true);
    expect(menuState.deleteRowEnabled).toBe(true);
    expect(menuState.insertColEnabled).toBe(false);
    expect(menuState.deleteColEnabled).toBe(false);
  });

  test('clicking column header selects column and enables Insert Column Before', async ({
    electronApp,
    window,
  }) => {
    const colHeader = window.locator('.column-header[data-col="1"]');
    await colHeader.click();
    await expect(window.locator('#cell-0-1')).toHaveClass(/selected/, {
      timeout: 2000,
    });

    const menuState = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu?.items?.find((item) => item.label === 'Edit');
      const items = editMenu?.submenu?.items;
      return {
        insertRowEnabled:
          items?.find((item) => item.label === 'Insert Row Above')?.enabled ??
          false,
        deleteRowEnabled:
          items?.find((item) => item.label === 'Delete Row')?.enabled ?? false,
        insertColEnabled:
          items?.find((item) => item.label === 'Insert Column Before')
            ?.enabled ?? false,
        deleteColEnabled:
          items?.find((item) => item.label === 'Delete Column')?.enabled ??
          false,
      };
    });
    expect(menuState.insertColEnabled).toBe(true);
    expect(menuState.deleteColEnabled).toBe(true);
    expect(menuState.insertRowEnabled).toBe(false);
    expect(menuState.deleteRowEnabled).toBe(false);
  });

  test('Insert Row Above inserts empty row and shifts data down', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 2, 0, 'row2');
    await setCellViaApi(window, 3, 0, 'row3');

    const rowHeader = window.locator('.row-header[data-row="2"]');
    await rowHeader.click();
    await expect(window.locator('#cell-2-0')).toHaveClass(/selected/, {
      timeout: 2000,
    });

    // Trigger insert row via the menu IPC path (main process → renderer).
    // After evaluate returns, the IPC is dispatched asynchronously to the renderer,
    // so we wait for the DOM to reflect the insert rather than asserting immediately.
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');
      const insertRowItem = editMenu?.submenu?.items.find(
        (item) => item.label === 'Insert Row Above'
      );
      if (insertRowItem?.click) insertRowItem.click();
    });

    const cellA2 = window.locator('#cell-2-0');
    const cellA3 = window.locator('#cell-3-0');
    const cellA4 = window.locator('#cell-4-0');
    await expect(cellA3).toHaveText('row2', { timeout: 5000 });
    await expect(cellA2).toHaveText('');
    await expect(cellA4).toHaveText('row3');
  });

  test('Insert Column Before inserts empty column and shifts data right', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 0, 1, 'colB');
    await setCellViaApi(window, 0, 2, 'colC');

    const colHeader = window.locator('.column-header[data-col="1"]');
    await colHeader.click();
    await expect(window.locator('#cell-0-1')).toHaveClass(/selected/, {
      timeout: 2000,
    });

    // Trigger insert column via the menu IPC path (main process → renderer).
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');
      const insertColItem = editMenu?.submenu?.items.find(
        (item) => item.label === 'Insert Column Before'
      );
      if (insertColItem?.click) insertColItem.click();
    });

    const cellB1 = window.locator('#cell-0-1');
    const cellC1 = window.locator('#cell-0-2');
    const cellD1 = window.locator('#cell-0-3');
    await expect(cellC1).toHaveText('colB', { timeout: 5000 });
    await expect(cellB1).toHaveText('');
    await expect(cellD1).toHaveText('colC');
  });

  test('Insert Row Above and Insert Column Before disabled when cell selected', async ({
    electronApp,
    window,
  }) => {
    await selectCellViaApp(window, 0, 0);
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);

    const menuState = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu?.items?.find((item) => item.label === 'Edit');
      const items = editMenu?.submenu?.items;
      return {
        insertRowEnabled:
          items?.find((item) => item.label === 'Insert Row Above')?.enabled ??
          false,
        deleteRowEnabled:
          items?.find((item) => item.label === 'Delete Row')?.enabled ?? false,
        insertColEnabled:
          items?.find((item) => item.label === 'Insert Column Before')
            ?.enabled ?? false,
        deleteColEnabled:
          items?.find((item) => item.label === 'Delete Column')?.enabled ??
          false,
      };
    });
    expect(menuState.insertRowEnabled).toBe(false);
    expect(menuState.deleteRowEnabled).toBe(false);
    expect(menuState.insertColEnabled).toBe(false);
    expect(menuState.deleteColEnabled).toBe(false);
  });
});
