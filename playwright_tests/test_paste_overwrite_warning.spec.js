// Story 19.6: Warn before pasting into non-empty range
// Tests that a confirmation dialog appears when paste would overwrite existing content.

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  selectCellViaApp,
} = require('./helpers');

async function menuCopy(electronApp) {
  await electronApp.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const editMenu = menu.items.find((item) => item.label === 'Edit');
    editMenu?.submenu?.items?.find((item) => item.label === 'Copy')?.click?.();
  });
}

async function menuPaste(electronApp) {
  await electronApp.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const editMenu = menu.items.find((item) => item.label === 'Edit');
    editMenu?.submenu?.items?.find((item) => item.label === 'Paste')?.click?.();
  });
}

test.describe('Paste overwrite warning (Story 19.6)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    const newBtn = window.locator('#new-btn');
    await newBtn.click();
    const modal = window.locator('#modal-overlay');
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await window.locator('#modal-ok').click();
      await expect(modal).toBeHidden();
    }
    await expect(window.locator('#cell-0-0')).toBeVisible();
    await expect(window.locator('#file-status')).toContainText('Saved', {
      timeout: 3000,
    });
  });

  test('paste into empty cell — no dialog, paste executes immediately', async ({
    electronApp,
    window,
  }) => {
    // Copy A1 (empty)
    await selectCellViaApp(window, 0, 0);
    await menuCopy(electronApp);

    // Paste into B1 (also empty)
    await selectCellViaApp(window, 0, 1);
    await menuPaste(electronApp);

    // No dialog should appear
    await expect(window.locator('#modal-overlay')).toBeHidden({
      timeout: 1000,
    });
  });

  test('paste into non-empty cell shows confirmation dialog', async ({
    electronApp,
    window,
  }) => {
    // Set A1 = "source" and B1 = "existing"
    await setCellViaApi(window, 0, 0, 'source');
    await setCellViaApi(window, 0, 1, 'existing');

    // Copy A1
    await selectCellViaApp(window, 0, 0);
    await menuCopy(electronApp);

    // Paste into B1 (non-empty)
    await selectCellViaApp(window, 0, 1);
    await menuPaste(electronApp);

    // Confirmation dialog should appear
    await expect(window.locator('#modal-overlay')).toBeVisible({
      timeout: 3000,
    });
    await expect(window.locator('#modal-message')).toContainText('overwrite');
  });

  test('cancel dialog — paste does not execute', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'source');
    await setCellViaApi(window, 0, 1, 'existing');

    await selectCellViaApp(window, 0, 0);
    await menuCopy(electronApp);

    await selectCellViaApp(window, 0, 1);
    await menuPaste(electronApp);

    // Dialog appears — click Cancel
    await expect(window.locator('#modal-overlay')).toBeVisible({
      timeout: 3000,
    });
    await window.locator('#modal-cancel').click();
    await expect(window.locator('#modal-overlay')).toBeHidden();

    // B1 should still have its original value
    await expect(window.locator('#cell-0-1')).toHaveText('existing');
  });

  test('confirm dialog — paste executes and overwrites', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'source');
    await setCellViaApi(window, 0, 1, 'existing');

    await selectCellViaApp(window, 0, 0);
    await menuCopy(electronApp);

    await selectCellViaApp(window, 0, 1);
    await menuPaste(electronApp);

    // Dialog appears — click OK
    await expect(window.locator('#modal-overlay')).toBeVisible({
      timeout: 3000,
    });
    await window.locator('#modal-ok').click();
    await expect(window.locator('#modal-overlay')).toBeHidden();

    // B1 should now have the pasted value
    await expect(window.locator('#cell-0-1')).toHaveText('source', {
      timeout: 3000,
    });
  });

  test('multi-cell paste into non-empty range shows dialog', async ({
    electronApp,
    window,
  }) => {
    // Set A1:B1 = "a", "b" and C1 = "existing"
    await setCellViaApi(window, 0, 0, 'a');
    await setCellViaApi(window, 0, 1, 'b');
    await setCellViaApi(window, 0, 2, 'existing');

    // Select A1:B1 and copy
    await selectCellViaApp(window, 0, 0);
    await window.locator('#cell-0-1').click({ modifiers: ['Shift'] });
    await menuCopy(electronApp);

    // Paste starting at B1 (B1=b, C1=existing — C1 is non-empty)
    await selectCellViaApp(window, 0, 1);
    await menuPaste(electronApp);

    // Confirmation dialog should appear
    await expect(window.locator('#modal-overlay')).toBeVisible({
      timeout: 3000,
    });
    await window.locator('#modal-cancel').click();
    await expect(window.locator('#modal-overlay')).toBeHidden();

    // C1 should still be "existing"
    await expect(window.locator('#cell-0-2')).toHaveText('existing');
  });
});
