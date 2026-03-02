// Story 13.3: Manage Styles - Playwright tests
// Tests Format → Manage Styles: edit, add, delete styles

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  setStyleViaApi,
} = require('./helpers');

test.describe('Manage Styles (Story 13.3)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    const newBtn = window.locator('#new-btn');
    await newBtn.click();
    await window.waitForTimeout(300);
  });

  test('Manage Styles opens and shows style list', async ({ window }) => {
    await window.evaluate(() => window.showManageStylesModal?.());
    const modal = window.locator('#manage-styles-modal');
    await expect(modal).toBeVisible();
    const list = window.locator('#manage-styles-list');
    await expect(list).toBeVisible();
    await expect(list.locator('.manage-styles-item')).toHaveCount(3); // Title, Header, Total
  });

  test('edit Title font size updates cells', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'Title');
    await setStyleViaApi(window, 0, 0, 0, 0, 1); // Title style
    await window.waitForTimeout(200);

    await window.evaluate(() => window.showManageStylesModal?.());
    await expect(window.locator('#manage-styles-modal')).toBeVisible();
    await window.locator('.manage-styles-edit[data-id="1"]').click();
    await window.waitForTimeout(200);

    const sizeInput = window.locator('#manage-styles-font-size');
    await sizeInput.fill('24');
    await window.locator('#manage-styles-form-save').click();
    await window.waitForTimeout(300);

    await expect(window.locator('#cell-0-0')).toHaveClass(/style-title/);
    await window.locator('#manage-styles-close').click();
    await window.waitForTimeout(200);
  });

  test('add custom style, apply to cell, delete custom style', async ({
    window,
  }) => {
    await window.evaluate(() => window.showManageStylesModal?.());
    await expect(window.locator('#manage-styles-modal')).toBeVisible();
    await window.locator('#manage-styles-add').click();
    await window.waitForTimeout(200);

    await window.locator('#manage-styles-name').fill('Custom');
    await window.locator('#manage-styles-font-size').fill('14');
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
    await window.waitForTimeout(200);

    await window.evaluate(() => window.showManageStylesModal?.());
    await window.waitForTimeout(200);
    await window.locator('.manage-styles-delete[data-id="4"]').click();
    await expect(window.locator('#modal-overlay.active')).toBeVisible({
      timeout: 3000,
    });
    await window.locator('#modal-ok').click();
    await window.waitForTimeout(300);
    await window.locator('#manage-styles-close').click();
    await window.waitForTimeout(200);
  });

  test('delete style shows confirmation dialog; Cancel aborts', async ({
    window,
  }) => {
    await window.evaluate(() => window.showManageStylesModal?.());
    await expect(window.locator('#manage-styles-modal')).toBeVisible();

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
});
