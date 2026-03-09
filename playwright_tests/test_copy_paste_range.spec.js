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

// Trigger cut via Electron menu
async function menuCut(electronApp) {
  await electronApp.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const editMenu = menu.items.find((item) => item.label === 'Edit');
    const cutItem = editMenu?.submenu?.items?.find(
      (item) => item.label === 'Cut'
    );
    cutItem?.click?.();
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

    // Wait for paste to land in DOM before asserting
    await window.waitForFunction(
      () => document.getElementById('cell-0-3')?.textContent?.trim() !== '',
      { timeout: 3000 }
    );

    // Verify D1:E2
    await expect(window.locator('#cell-0-3')).toHaveText('hello');
    await expect(window.locator('#cell-0-4')).toHaveText('world');
    await expect(window.locator('#cell-1-3')).toHaveText('foo');
    await expect(window.locator('#cell-1-4')).toHaveText('bar');
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

    await window.waitForFunction(
      () => document.getElementById('cell-5-5')?.textContent?.trim() !== '',
      { timeout: 3000 }
    );
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
    await window.waitForFunction(
      () => document.getElementById('cell-ref')?.value === 'A1:B2',
      { timeout: 2000 }
    );
    expect(await cellRef.inputValue()).toBe('A1:B2');
  });

  test('single row copy/paste fills horizontally (AC3)', async ({
    electronApp,
    window,
  }) => {
    // Set A1:C1 (single row, 3 columns)
    await setCellViaApi(window, 0, 0, 'x');
    await setCellViaApi(window, 0, 1, 'y');
    await setCellViaApi(window, 0, 2, 'z');

    // Select A1, then Shift-click C1 (same row)
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-0-2').click({ modifiers: ['Shift'] });

    await menuCopy(electronApp);
    await window.waitForFunction(
      async () => (await navigator.clipboard.readText()).includes('\t'),
      { timeout: 3000 }
    );

    // Paste at E3 (row 2, col 4)
    await window.locator('#cell-2-4').click();
    await menuPaste(electronApp);

    await window.waitForFunction(
      () => document.getElementById('cell-2-4')?.textContent?.trim() !== '',
      { timeout: 3000 }
    );

    await expect(window.locator('#cell-2-4')).toHaveText('x');
    await expect(window.locator('#cell-2-5')).toHaveText('y');
    await expect(window.locator('#cell-2-6')).toHaveText('z');
  });

  test('single column copy/paste fills vertically (AC4)', async ({
    electronApp,
    window,
  }) => {
    // Set A1:A3 (single column, 3 rows)
    await setCellViaApi(window, 0, 0, 'p');
    await setCellViaApi(window, 1, 0, 'q');
    await setCellViaApi(window, 2, 0, 'r');

    // Select A1, then Shift-click A3 (same column)
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-2-0').click({ modifiers: ['Shift'] });

    await menuCopy(electronApp);
    // Wait for clipboard to contain exactly 3 rows with no tabs
    await window.waitForFunction(
      async () => {
        const text = await navigator.clipboard.readText();
        const rows = text.replace(/\n$/, '').split('\n');
        return rows.length === 3 && !text.includes('\t');
      },
      { timeout: 3000 }
    );

    // Paste at C5 (row 4, col 2)
    await window.locator('#cell-4-2').click();
    await menuPaste(electronApp);

    await window.waitForFunction(
      () => document.getElementById('cell-4-2')?.textContent?.trim() !== '',
      { timeout: 3000 }
    );

    await expect(window.locator('#cell-4-2')).toHaveText('p');
    await expect(window.locator('#cell-5-2')).toHaveText('q');
    await expect(window.locator('#cell-6-2')).toHaveText('r');
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

  test('undo of range paste restores all cells at once', async ({
    electronApp,
    window,
  }) => {
    // Set A1:B2 as source
    await setCellViaApi(window, 0, 0, 'p1');
    await setCellViaApi(window, 0, 1, 'p2');
    await setCellViaApi(window, 1, 0, 'p3');
    await setCellViaApi(window, 1, 1, 'p4');

    // Copy A1:B2
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-1-1').click({ modifiers: ['Shift'] });
    await menuCopy(electronApp);
    await window.waitForFunction(
      async () => (await navigator.clipboard.readText()).includes('\t'),
      { timeout: 3000 }
    );

    // Paste at D1
    await window.locator('#cell-0-3').click();
    await menuPaste(electronApp);
    await window.waitForFunction(
      () => document.getElementById('cell-0-3')?.textContent?.trim() !== '',
      { timeout: 3000 }
    );
    await expect(window.locator('#cell-0-3')).toHaveText('p1');
    await expect(window.locator('#cell-1-4')).toHaveText('p4');

    // Undo — ALL 4 pasted cells must be cleared in a single undo
    await window.evaluate(async () => {
      const res = await fetch('/api/undo', { method: 'POST' });
      return res.json();
    });
    await window.evaluate(() => window.refreshAllCells?.());

    await expect(window.locator('#cell-0-3')).toHaveText('', { timeout: 3000 });
    await expect(window.locator('#cell-0-4')).toHaveText('', { timeout: 3000 });
    await expect(window.locator('#cell-1-3')).toHaveText('', { timeout: 3000 });
    await expect(window.locator('#cell-1-4')).toHaveText('', { timeout: 3000 });
  });

  test('paste of TSV row from clipboard (e.g. from Excel) fills correctly', async ({
    electronApp,
    window,
  }) => {
    // Simulate a full-row paste from an external app: single row with tabs, trailing newline
    await window.evaluate(async () => {
      await navigator.clipboard.writeText('alpha\tbeta\tgamma\n');
    });

    await window.locator('#cell-2-0').click();
    await menuPaste(electronApp);

    await window.waitForFunction(
      () => document.getElementById('cell-2-0')?.textContent?.trim() !== '',
      { timeout: 3000 }
    );

    await expect(window.locator('#cell-2-0')).toHaveText('alpha');
    await expect(window.locator('#cell-2-1')).toHaveText('beta');
    await expect(window.locator('#cell-2-2')).toHaveText('gamma');
    // Row 3 should NOT be written (trailing newline is stripped, not treated as empty row)
    await expect(window.locator('#cell-3-0')).toHaveText('', { timeout: 2000 });
  });

  test('cut 2x2 range copies to clipboard and clears source cells', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'cut1');
    await setCellViaApi(window, 0, 1, 'cut2');
    await setCellViaApi(window, 1, 0, 'cut3');
    await setCellViaApi(window, 1, 1, 'cut4');

    // Select A1:B2
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-1-1').click({ modifiers: ['Shift'] });

    await menuCut(electronApp);

    // Source cells should be cleared
    await expect(window.locator('#cell-0-0')).toHaveText('', { timeout: 3000 });
    await expect(window.locator('#cell-0-1')).toHaveText('', { timeout: 3000 });
    await expect(window.locator('#cell-1-0')).toHaveText('', { timeout: 3000 });
    await expect(window.locator('#cell-1-1')).toHaveText('', { timeout: 3000 });

    // Paste at D1 — clipboard should contain TSV
    await window.locator('#cell-0-3').click();
    await menuPaste(electronApp);

    await window.waitForFunction(
      () => document.getElementById('cell-0-3')?.textContent?.trim() !== '',
      { timeout: 3000 }
    );

    await expect(window.locator('#cell-0-3')).toHaveText('cut1');
    await expect(window.locator('#cell-0-4')).toHaveText('cut2');
    await expect(window.locator('#cell-1-3')).toHaveText('cut3');
    await expect(window.locator('#cell-1-4')).toHaveText('cut4');
  });
});
