// Story 16.4: Read-Only / View Mode
// Tests: indicator visibility, editing blocked, save blocked, navigation works, exit read-only.

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

test.describe('Read-Only Mode (Story 16.4)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    // Reset to clean state: new spreadsheet, dismiss any modal
    await window.locator('#new-btn').click();
    const modal = window.locator('#modal-overlay');
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await window.locator('#modal-ok').click();
      await expect(modal).toBeHidden();
    }
    await expect(window.locator('#cell-0-0')).toBeVisible();
    // Ensure read-only is off before each test
    await window.waitForFunction(
      () => typeof window.__testSetReadOnly === 'function',
      { timeout: 5000 }
    );
    await window.evaluate(() => window.__testSetReadOnly(false));
  });

  // AC 1: read-only indicator visible when set, hidden when cleared
  test('readonly indicator shown when read-only is set', async ({ window }) => {
    const indicator = window.locator('#readonly-indicator');
    await expect(indicator).toBeHidden();

    await window.evaluate(() => window.__testSetReadOnly(true));
    await expect(indicator).toBeVisible();

    await window.evaluate(() => window.__testSetReadOnly(false));
    await expect(indicator).toBeHidden();
  });

  // AC 1: typing into a cell has no effect in read-only mode
  test('typing in a cell has no effect when read-only', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'original');
    await expect(window.locator('#cell-0-0')).toHaveText('original');

    await window.evaluate(() => window.__testSetReadOnly(true));

    // Click cell to select it
    await window.evaluate(() => {
      const el = document.getElementById('cell-0-0');
      if (el) el.click();
    });
    // Type a character — should not trigger editing
    await window.keyboard.type('X');

    // Cell content must be unchanged
    await expect(window.locator('#cell-0-0')).toHaveText('original', {
      timeout: 2000,
    });
    // Edit input must not be visible
    await expect(window.locator('.cell-editor')).toBeHidden();
  });

  // AC 1: Delete key should not clear a cell in read-only mode
  test('Delete key does not clear cell when read-only', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'keep-me');
    await expect(window.locator('#cell-0-0')).toHaveText('keep-me');

    await window.evaluate(() => window.__testSetReadOnly(true));

    // Select and press Delete
    await window.evaluate(() => {
      const el = document.getElementById('cell-0-0');
      if (el) el.click();
    });
    await window.keyboard.press('Delete');

    await expect(window.locator('#cell-0-0')).toHaveText('keep-me', {
      timeout: 2000,
    });
  });

  // AC 2: Save is blocked in read-only mode, alert shown
  test('save button does nothing and shows no alert when read-only (btn disabled)', async ({
    window,
  }) => {
    await window.evaluate(() => window.__testSetReadOnly(true));

    // Save button should be disabled
    await expect(window.locator('#save-btn')).toBeDisabled();
  });

  // AC 2: menu save handler shows alert in read-only mode
  test('menu save shows read-only alert when read-only', async ({ window }) => {
    await window.evaluate(() => window.__testSetReadOnly(true));

    // Trigger the menu save handler directly (bypasses IPC, tests the guard logic)
    await window.waitForFunction(
      () => typeof window.__testMenuSave === 'function',
      { timeout: 5000 }
    );
    // Fire without awaiting — it blocks on showAlert modal
    window.evaluate(() => window.__testMenuSave());

    // Alert modal should appear
    await window
      .locator('#modal-overlay.active')
      .waitFor({ state: 'visible', timeout: 5000 });
    const modalText = await window.locator('#modal-message').textContent();
    expect(modalText).toContain('read-only');
    await window.locator('#modal-ok').click();
    await expect(window.locator('#modal-overlay')).toBeHidden();
  });

  // AC 3: Cell navigation (arrow keys, click) still works in read-only mode
  test('arrow key navigation works in read-only mode', async ({ window }) => {
    await window.evaluate(() => window.__testSetReadOnly(true));

    // Select cell 0,0 then press ArrowRight to move to 0,1
    await window.evaluate(() => {
      const el = document.getElementById('cell-0-0');
      if (el) el.click();
    });
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/, {
      timeout: 2000,
    });

    await window.keyboard.press('ArrowRight');
    await expect(window.locator('#cell-0-1')).toHaveClass(/selected/, {
      timeout: 2000,
    });

    await window.keyboard.press('ArrowDown');
    await expect(window.locator('#cell-1-1')).toHaveClass(/selected/, {
      timeout: 2000,
    });
  });

  // AC 3: Click-to-select works in read-only mode
  test('click to select cell works in read-only mode', async ({ window }) => {
    await window.evaluate(() => window.__testSetReadOnly(true));

    await window.evaluate(() => {
      const el = document.getElementById('cell-1-2');
      if (el) el.click();
    });
    await expect(window.locator('#cell-1-2')).toHaveClass(/selected/, {
      timeout: 2000,
    });
  });

  // AC 4: setReadOnly(false) re-enables editing
  test('editing is re-enabled after setReadOnly(false)', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'before');
    await window.evaluate(() => window.__testSetReadOnly(true));

    // Confirm read-only blocks typing
    await window.evaluate(() => document.getElementById('cell-0-0')?.click());
    await window.keyboard.type('X');
    await expect(window.locator('#cell-0-0')).toHaveText('before', {
      timeout: 1000,
    });

    // Exit read-only
    await window.evaluate(() => window.__testSetReadOnly(false));
    await expect(window.locator('#readonly-indicator')).toBeHidden();

    // Now typing should work
    await window.evaluate(() => document.getElementById('cell-0-0')?.click());
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/, {
      timeout: 2000,
    });
    await window.keyboard.type('Y');
    await expect(window.locator('.cell-editor')).toBeVisible({ timeout: 2000 });
    await window.keyboard.press('Escape');
  });
});
