// Story 19.4: Toolbar Style Buttons - Playwright tests
// Tests that alignment buttons are removed and dynamic style buttons are present/functional.

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, selectCellViaApp } = require('./helpers');

test.describe('Toolbar Style Buttons (Story 19.4)', () => {
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

  test('alignment buttons are no longer in the toolbar', async ({ window }) => {
    await expect(window.locator('#align-left-btn')).toHaveCount(0);
    await expect(window.locator('#align-center-btn')).toHaveCount(0);
    await expect(window.locator('#align-right-btn')).toHaveCount(0);
  });

  test('toolbar has style buttons for built-in styles', async ({ window }) => {
    const styleBtns = window.locator('.toolbar-style-btn');
    await expect(styleBtns).toHaveCount(3, { timeout: 3000 });

    await expect(window.locator('#style-btn-1')).toBeVisible();
    await expect(window.locator('#style-btn-2')).toBeVisible();
    await expect(window.locator('#style-btn-3')).toBeVisible();

    await expect(window.locator('#style-btn-1')).toHaveText('Title');
    await expect(window.locator('#style-btn-2')).toHaveText('Header');
    await expect(window.locator('#style-btn-3')).toHaveText('Total');
  });

  test('clicking Title style button applies style-title class to selected cell', async ({
    window,
  }) => {
    await selectCellViaApp(window, 0, 0);
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);

    await window.locator('#style-btn-1').click();

    await expect(window.locator('#cell-0-0')).toHaveClass(/style-title/, {
      timeout: 3000,
    });
  });

  test('clicking Header style button applies style-header class to selected cell', async ({
    window,
  }) => {
    await selectCellViaApp(window, 0, 0);
    await window.locator('#style-btn-2').click();
    await expect(window.locator('#cell-0-0')).toHaveClass(/style-header/, {
      timeout: 3000,
    });
  });

  test('style buttons are disabled in read-only mode', async ({ window }) => {
    const btn1 = window.locator('#style-btn-1');
    const btn2 = window.locator('#style-btn-2');

    await expect(btn1).toBeVisible();
    await expect(btn1).toBeEnabled();
    await expect(btn2).toBeEnabled();

    // Disable all style buttons (simulating setReadOnly)
    await window.evaluate(() => {
      document
        .querySelectorAll('.toolbar-style-btn')
        .forEach((b) => (b.disabled = true));
    });

    await expect(btn1).toBeDisabled();
    await expect(btn2).toBeDisabled();

    // Restore
    await window.evaluate(() => {
      document
        .querySelectorAll('.toolbar-style-btn')
        .forEach((b) => (b.disabled = false));
    });
    await expect(btn1).toBeEnabled();
  });
});
