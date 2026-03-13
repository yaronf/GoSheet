// Story 13.3: Manage Styles - Playwright tests
// Tests Format → Manage Styles: edit, add, delete styles

const { test, expect } = require('./fixtures');
const { clickMenuItemById } = require('electron-playwright-helpers');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  setStyleViaApi,
} = require('./helpers');

async function openManageStylesModal(electronApp, window) {
  await clickMenuItemById(electronApp, 'manage-styles');
  await expect(window.locator('#manage-styles-modal')).toBeVisible();
}

test.describe('Manage Styles (Story 13.3)', () => {
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
    await expect(window.locator('#file-status')).toContainText('Saved', {
      timeout: 3000,
    });
  });

  test('Manage Styles opens and shows style list', async ({
    window,
    electronApp,
  }) => {
    await openManageStylesModal(electronApp, window);
    const list = window.locator('#manage-styles-list');
    await expect(list).toBeVisible();
    await expect(list.locator('.manage-styles-item')).toHaveCount(3); // Title, Header, Total
  });

  test('Edit form has color pickers, font size slider, and font picker (Story 13.3b)', async ({
    window,
    electronApp,
  }) => {
    await openManageStylesModal(electronApp, window);
    await window.locator('.manage-styles-edit[data-id="1"]').click();
    await expect(window.locator('#manage-styles-form')).toBeVisible();

    await expect(
      window.locator('#manage-styles-font-color-picker')
    ).toHaveAttribute('type', 'color');
    await expect(
      window.locator('#manage-styles-fill-color-picker')
    ).toHaveAttribute('type', 'color');
    await expect(window.locator('#manage-styles-font-size')).toHaveAttribute(
      'type',
      'range'
    );
    await expect(window.locator('#manage-styles-font-size')).toHaveAttribute(
      'min',
      '8'
    );
    await expect(window.locator('#manage-styles-font-size')).toHaveAttribute(
      'max',
      '72'
    );
    const fontSelect = window.locator('#manage-styles-font-name');
    await expect(fontSelect).toHaveCount(1);
    await expect(fontSelect.locator('option')).toHaveCount(5);
  });

  test('edit Title font size updates cells', async ({
    window,
    electronApp,
  }) => {
    await setCellViaApi(window, 0, 0, 'Title');
    await setStyleViaApi(window, 0, 0, 0, 0, 1); // Title style
    await window.waitForTimeout(200);

    await openManageStylesModal(electronApp, window);
    await window.locator('.manage-styles-edit[data-id="1"]').click();
    await window.waitForTimeout(200);

    const sizeInput = window.locator('#manage-styles-font-size');
    await sizeInput.evaluate((el) => {
      el.value = '24';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await window.locator('#manage-styles-form-save').click();
    await window.waitForTimeout(300);

    await expect(window.locator('#cell-0-0')).toHaveClass(/style-title/);
    await window.locator('#manage-styles-close').click();
    await window.waitForTimeout(200);
  });

  test('add custom style, apply to cell, delete custom style', async ({
    window,
    electronApp,
  }) => {
    await openManageStylesModal(electronApp, window);
    await window.locator('#manage-styles-add').click();
    await window.waitForTimeout(200);

    await window.locator('#manage-styles-name').fill('Custom');
    await window.locator('#manage-styles-font-size').evaluate((el) => {
      el.value = '14';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await window.locator('#manage-styles-form-save').click();
    await window.waitForTimeout(300);

    const items = window.locator('.manage-styles-item');
    await expect(items).toHaveCount(4);
    await window.locator('#manage-styles-close').click();
    await window.waitForTimeout(200);

    await setCellViaApi(window, 0, 0, 'Styled');
    const styles = await window.evaluate(async () => {
      const res = await fetch('/api/styles');
      const json = await res.json();
      return json.data?.styles ?? [];
    });
    const customStyle = styles.find((s) => s.name === 'Custom');
    expect(customStyle).toBeTruthy();
    await setStyleViaApi(window, 0, 0, 0, 0, customStyle.id);
    await expect(window.locator('#cell-0-0')).toContainText('Styled');

    await openManageStylesModal(electronApp, window);
    await window
      .locator('.manage-styles-item:has-text("Custom") .manage-styles-delete')
      .click();
    await expect(window.locator('#modal-overlay.active')).toBeVisible({
      timeout: 3000,
    });
    await window.locator('#modal-ok').click();
    await window.waitForTimeout(300);
    await window.locator('#manage-styles-close').click();
    await window.waitForTimeout(200);
  });

  test('add style with duplicate name shows alert and does not save', async ({
    window,
    electronApp,
  }) => {
    await openManageStylesModal(electronApp, window);
    // Try to add a style named "Title" which already exists
    await window.locator('#manage-styles-add').click();
    await expect(window.locator('#manage-styles-form')).toBeVisible();
    await window.locator('#manage-styles-name').fill('Title');
    await window.locator('#manage-styles-form-save').click();

    // Alert modal should appear with duplicate-name message
    await expect(window.locator('#modal-overlay.active')).toBeVisible({
      timeout: 3000,
    });
    await expect(window.locator('#modal-message')).toContainText(
      'already exists'
    );
    await window.locator('#modal-ok').click();
    await expect(window.locator('#modal-overlay')).toBeHidden();

    // Form should still be visible (save was aborted)
    await expect(window.locator('#manage-styles-form')).toBeVisible();
    // Style count should be unchanged (still 3)
    await window.locator('#manage-styles-form-cancel').click();
    await expect(window.locator('.manage-styles-item')).toHaveCount(3);
    await window.locator('#manage-styles-close').click();
  });

  test('Escape dismisses alert dialog', async ({ window, electronApp }) => {
    await openManageStylesModal(electronApp, window);
    await window.locator('#manage-styles-add').click();
    await expect(window.locator('#manage-styles-form')).toBeVisible();
    // Trigger alert via empty name save
    await window.locator('#manage-styles-name').fill('');
    await window.locator('#manage-styles-form-save').click();
    await expect(window.locator('#modal-overlay.active')).toBeVisible({
      timeout: 3000,
    });
    // Press Escape to dismiss (same as clicking OK)
    await window.keyboard.press('Escape');
    await expect(window.locator('#modal-overlay')).toBeHidden({
      timeout: 2000,
    });
    await window.locator('#manage-styles-form-cancel').click();
    await window.locator('#manage-styles-close').click();
  });

  test('clicking overlay background dismisses alert dialog', async ({
    window,
    electronApp,
  }) => {
    await openManageStylesModal(electronApp, window);
    await window.locator('#manage-styles-add').click();
    await expect(window.locator('#manage-styles-form')).toBeVisible();
    await window.locator('#manage-styles-name').fill('');
    await window.locator('#manage-styles-form-save').click();
    await expect(window.locator('#modal-overlay.active')).toBeVisible({
      timeout: 3000,
    });
    // Click the overlay background (outside the dialog box) to dismiss
    await window.locator('#modal-overlay').click({ position: { x: 5, y: 5 } });
    await expect(window.locator('#modal-overlay')).toBeHidden({
      timeout: 2000,
    });
    await window.locator('#manage-styles-form-cancel').click();
    await window.locator('#manage-styles-close').click();
  });

  test('add style with empty name shows alert', async ({
    window,
    electronApp,
  }) => {
    await openManageStylesModal(electronApp, window);
    await window.locator('#manage-styles-add').click();
    await expect(window.locator('#manage-styles-form')).toBeVisible();
    // Leave name blank and save
    await window.locator('#manage-styles-name').fill('');
    await window.locator('#manage-styles-form-save').click();

    // Alert modal should appear
    await expect(window.locator('#modal-overlay.active')).toBeVisible({
      timeout: 3000,
    });
    await expect(window.locator('#modal-message')).toContainText('style name');
    await window.locator('#modal-ok').click();
    await window.locator('#manage-styles-form-cancel').click();
    await window.locator('#manage-styles-close').click();
  });

  test('delete style shows confirmation dialog; Cancel aborts', async ({
    window,
    electronApp,
  }) => {
    await openManageStylesModal(electronApp, window);

    await window.locator('.manage-styles-delete[data-id="1"]').click();
    await expect(window.locator('#modal-overlay.active')).toBeVisible({
      timeout: 3000,
    });
    await expect(window.locator('#modal-message')).toContainText('Delete');

    await window.locator('#modal-cancel').click();
    await window.waitForTimeout(200);

    await expect(
      window.locator('.manage-styles-item[data-id="1"]')
    ).toBeVisible();
  });

  test('close with unsaved form changes shows confirm; Cancel keeps modal open', async ({
    window,
    electronApp,
  }) => {
    await openManageStylesModal(electronApp, window);
    // Open the edit form for Title style
    await window.locator('.manage-styles-edit[data-id="1"]').click();
    await expect(window.locator('#manage-styles-form')).toBeVisible();

    // Change the font size to mark the form as dirty
    await window.locator('#manage-styles-font-size').evaluate((el) => {
      el.value = '30';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Click Close — should show unsaved-changes confirm dialog
    await window.locator('#manage-styles-close').click();
    await expect(window.locator('#modal-overlay.active')).toBeVisible({
      timeout: 3000,
    });
    await expect(window.locator('#modal-message')).toContainText(
      'unsaved changes'
    );

    // Cancel — modal should remain open
    await window.locator('#modal-cancel').click();
    await expect(window.locator('#manage-styles-modal.active')).toBeVisible();

    // Now cancel the form and close cleanly
    await window.locator('#manage-styles-form-cancel').click();
    await window.locator('#manage-styles-close').click();
    await expect(window.locator('#manage-styles-modal')).not.toHaveClass(
      'active'
    );
  });

  test('custom style appears in context menu and Format menu', async ({
    window,
    electronApp,
  }) => {
    await openManageStylesModal(electronApp, window);
    await window.locator('#manage-styles-add').click();
    await expect(window.locator('#manage-styles-form')).toBeVisible();

    await window.locator('#manage-styles-name').fill('MyStyle');
    await window.locator('#manage-styles-font-size').evaluate((el) => {
      el.value = '16';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await window.locator('#manage-styles-form-save').click();
    await expect(window.locator('#manage-styles-form')).toBeHidden();
    await window.locator('#manage-styles-close').click();

    await setCellViaApi(window, 0, 0, 'Test');
    await window.locator('#cell-0-0').click();

    const cell = window.locator('#cell-0-0');
    await cell.click({ button: 'right' });
    await expect(window.locator('#context-menu')).toBeVisible();
    await expect(
      window.locator('#context-menu [data-action="format-style-4"]')
    ).toBeVisible({ timeout: 3000 });
    await expect(
      window.locator('#context-menu [data-action="format-style-4"]')
    ).toContainText('MyStyle');
    await window
      .locator('#context-menu [data-action="format-style-4"]')
      .click();

    await expect(window.locator('#cell-0-0')).toContainText('Test');

    const formatMenu = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const formatMenu = menu?.items?.find((item) => item.label === 'Format');
      const submenu = formatMenu?.submenu?.items ?? [];
      const myStyleItem = submenu.find((item) => item.label === 'MyStyle');
      return myStyleItem ? { label: myStyleItem.label } : null;
    });
    expect(formatMenu).toBeTruthy();
    expect(formatMenu.label).toBe('MyStyle');
  });
});
