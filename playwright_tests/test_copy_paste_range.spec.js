// Story 17.3: Copy/Paste Rectangular Range

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

// Trigger copy via Electron menu (more reliable than Meta+C in headless test mode)
async function menuCopy(electronApp) {
  await electronApp.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const editMenu = menu.items.find((item) => item.label === 'Edit');
    const copyItem = editMenu?.submenu?.items?.find(
      (item) => item.label === 'Copy'
    );
    copyItem?.click?.();
  });
}

// Trigger paste via Electron menu
async function menuPaste(electronApp) {
  await electronApp.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const editMenu = menu.items.find((item) => item.label === 'Edit');
    const pasteItem = editMenu?.submenu?.items?.find(
      (item) => item.label === 'Paste'
    );
    pasteItem?.click?.();
  });
}

test.describe('Copy/paste range (Story 17.3)', () => {
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
  });

  test('copy 2x2 range and paste at new location', async ({
    electronApp,
    window,
  }) => {
    // Set A1:B2
    await setCellViaApi(window, 0, 0, 'hello');
    await setCellViaApi(window, 0, 1, 'world');
    await setCellViaApi(window, 1, 0, 'foo');
    await setCellViaApi(window, 1, 1, 'bar');

    // Select A1, then Shift-click B2
    await window.locator('#cell-0-0').click();
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);
    await window.locator('#cell-1-1').click({ modifiers: ['Shift'] });
    await expect(window.locator('#cell-1-1')).toHaveClass(/selected/);

    // Copy via menu and wait for clipboard to contain TSV
    await menuCopy(electronApp);
    await window.waitForFunction(
      async () => (await navigator.clipboard.readText()).includes('\t'),
      { timeout: 3000 }
    );

    // Select D1 as paste target
    await window.locator('#cell-0-3').click();
    await expect(window.locator('#cell-0-3')).toHaveClass(/selected/);

    // Paste via menu
    await menuPaste(electronApp);

    // Verify D1:E2
    await expect(window.locator('#cell-0-3')).toHaveText('hello', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-0-4')).toHaveText('world', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-1-3')).toHaveText('foo', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-1-4')).toHaveText('bar', {
      timeout: 3000,
    });
  });

  test('single cell copy/paste (backward compat)', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'solo');

    await window.locator('#cell-0-0').click();
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);

    await menuCopy(electronApp);
    // Wait for clipboard to contain the copied value
    await window.waitForFunction(
      async () => (await navigator.clipboard.readText()).trim() === 'solo',
      { timeout: 3000 }
    );

    await window.locator('#cell-5-5').click();
    await expect(window.locator('#cell-5-5')).toHaveClass(/selected/);

    await menuPaste(electronApp);

    await expect(window.locator('#cell-5-5')).toHaveText('solo', {
      timeout: 3000,
    });
  });

  test('address box shows range during multi-cell selection', async ({
    window,
  }) => {
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-1-1').click({ modifiers: ['Shift'] });
    const cellRef = window.locator('#cell-ref');
    await expect(cellRef).toHaveText('A1:B2', { timeout: 2000 });
  });

  test('paste TSV that extends beyond current grid expands it', async ({
    electronApp,
    window,
  }) => {
    // Default grid is 100 rows. Paste 3 rows starting at row 99 (last row, 0-indexed)
    // to force expansion to at least 101 rows.
    const lastRow = 99;

    // Write a 3-row TSV directly to clipboard
    await window.evaluate(async () => {
      await navigator.clipboard.writeText('a\tb\nc\td\ne\tf');
    });

    // Select the last visible row
    await window.locator(`#cell-${lastRow}-0`).click();
    await expect(window.locator(`#cell-${lastRow}-0`)).toHaveClass(/selected/);

    // Paste — should expand grid to fit 3 rows starting at row 99
    await menuPaste(electronApp);

    // Row 101 (index 100) should now exist
    await expect(window.locator('#cell-100-0')).toBeVisible({ timeout: 3000 });
    await expect(window.locator(`#cell-${lastRow}-0`)).toHaveText('a', {
      timeout: 3000,
    });
    await expect(window.locator('#cell-100-0')).toHaveText('c', {
      timeout: 3000,
    });
  });
});
