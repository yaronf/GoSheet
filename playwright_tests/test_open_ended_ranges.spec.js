// Story 17.5: Open-Ended Row/Column Range Selection

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView } = require('./helpers');

test.describe('Open-ended row/column ranges (Story 17.5)', () => {
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

  test('row header click: address box shows 1:1', async ({ window }) => {
    const rowHeader = window.locator('.row-header[data-row="0"]');
    await rowHeader.click();
    await window.waitForFunction(
      () => document.getElementById('cell-ref')?.value === '1:1',
      { timeout: 2000 }
    );
    expect(await window.locator('#cell-ref').inputValue()).toBe('1:1');
  });

  test('column header click: address box shows A:A', async ({ window }) => {
    const colHeader = window.locator('.column-header[data-col="0"]');
    await colHeader.click();
    await window.waitForFunction(
      () => document.getElementById('cell-ref')?.value === 'A:A',
      { timeout: 2000 }
    );
    expect(await window.locator('#cell-ref').inputValue()).toBe('A:A');
  });

  test('multi-row shift-click: address box shows 1:3', async ({ window }) => {
    const row0Header = window.locator('.row-header[data-row="0"]');
    const row2Header = window.locator('.row-header[data-row="2"]');
    await row0Header.click();
    await row2Header.click({ modifiers: ['Shift'] });
    await window.waitForFunction(
      () => document.getElementById('cell-ref')?.value === '1:3',
      { timeout: 2000 }
    );
    expect(await window.locator('#cell-ref').inputValue()).toBe('1:3');
  });

  test('multi-col shift-click: address box shows A:C', async ({ window }) => {
    const col0Header = window.locator('.column-header[data-col="0"]');
    const col2Header = window.locator('.column-header[data-col="2"]');
    await col0Header.click();
    await col2Header.click({ modifiers: ['Shift'] });
    await window.waitForFunction(
      () => document.getElementById('cell-ref')?.value === 'A:C',
      { timeout: 2000 }
    );
    expect(await window.locator('#cell-ref').inputValue()).toBe('A:C');
  });

  test('row header click selects all cells in row', async ({ window }) => {
    const rowHeader = window.locator('.row-header[data-row="0"]');
    await rowHeader.click();
    // All cells in row 0 should have .selected class
    await window.waitForFunction(
      () => document.getElementById('cell-0-0')?.classList.contains('selected'),
      { timeout: 2000 }
    );
    // Check a few cells in the row
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);
    await expect(window.locator('#cell-0-5')).toHaveClass(/selected/);
    await expect(window.locator('#cell-0-25')).toHaveClass(/selected/);
  });

  test('column header click selects all cells in column', async ({
    window,
  }) => {
    const colHeader = window.locator('.column-header[data-col="0"]');
    await colHeader.click();
    await window.waitForFunction(
      () => document.getElementById('cell-0-0')?.classList.contains('selected'),
      { timeout: 2000 }
    );
    // Check a few cells in the column
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);
    await expect(window.locator('#cell-5-0')).toHaveClass(/selected/);
    await expect(window.locator('#cell-99-0')).toHaveClass(/selected/);
  });

  // H1: right-click on row/column header should store OPEN_END (not bounded snapshot).
  // Observable: after right-click selects row 1, all visible cells in that row are selected.
  test('right-click row header: address box shows 1:1 and all cells in row selected', async ({
    window,
  }) => {
    const rowHeader = window.locator('.row-header[data-row="0"]');
    await rowHeader.click({ button: 'right' });
    // Dismiss context menu
    await window.keyboard.press('Escape');
    await window.waitForFunction(
      () => document.getElementById('cell-ref')?.value === '1:1',
      { timeout: 2000 }
    );
    expect(await window.locator('#cell-ref').inputValue()).toBe('1:1');
    // All cells in row 0 should be selected
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);
    await expect(window.locator('#cell-0-12')).toHaveClass(/selected/);
    await expect(window.locator('#cell-0-25')).toHaveClass(/selected/);
  });

  test('right-click column header: address box shows A:A and all cells in col selected', async ({
    window,
  }) => {
    const colHeader = window.locator('.column-header[data-col="0"]');
    await colHeader.click({ button: 'right' });
    await window.keyboard.press('Escape');
    await window.waitForFunction(
      () => document.getElementById('cell-ref')?.value === 'A:A',
      { timeout: 2000 }
    );
    expect(await window.locator('#cell-ref').inputValue()).toBe('A:A');
    // All cells in col 0 should be selected
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);
    await expect(window.locator('#cell-50-0')).toHaveClass(/selected/);
    await expect(window.locator('#cell-99-0')).toHaveClass(/selected/);
  });

  // H2: Cut with open-ended row selection must not send Infinity to the API
  test('cut with full-row selection clears cells (resolves OPEN_END before API call)', async ({
    electronApp,
    window,
  }) => {
    const { setCellViaApi } = require('./helpers');
    await setCellViaApi(window, 0, 0, 'tocut');
    await setCellViaApi(window, 0, 1, 'also');

    // Select row 1 via row header (produces endCol=Infinity)
    const rowHeader = window.locator('.row-header[data-row="0"]');
    await rowHeader.click();
    await window.waitForFunction(
      () => document.getElementById('cell-ref')?.value === '1:1',
      { timeout: 2000 }
    );

    // Trigger Cut via menu
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');
      const cutItem = editMenu?.submenu?.items?.find(
        (item) => item.label === 'Cut'
      );
      cutItem?.click?.();
    });

    // Cells should be cleared — previously crashed because Infinity was sent to Go API
    await window.waitForFunction(
      () => document.getElementById('cell-0-0')?.textContent?.trim() === '',
      { timeout: 3000 }
    );
    await expect(window.locator('#cell-0-0')).toHaveText('');
    await expect(window.locator('#cell-0-1')).toHaveText('');
  });

  // M1: Escape in address box must not produce garbled text for open-ended row range
  test('address box Escape restores correct row range notation', async ({
    window,
  }) => {
    // Select row 1 (open-ended)
    const rowHeader = window.locator('.row-header[data-row="0"]');
    await rowHeader.click();
    await window.waitForFunction(
      () => document.getElementById('cell-ref')?.value === '1:1',
      { timeout: 2000 }
    );

    // Focus the address box, type something, then press Escape
    const cellRef = window.locator('#cell-ref');
    await cellRef.click();
    await cellRef.fill('Z99');
    await cellRef.press('Escape');

    // Should restore to '1:1', not garbled 'A1:${colToLetter(Infinity)}Infinity'
    await window.waitForFunction(
      () => document.getElementById('cell-ref')?.value === '1:1',
      { timeout: 2000 }
    );
    expect(await cellRef.inputValue()).toBe('1:1');
  });
});
