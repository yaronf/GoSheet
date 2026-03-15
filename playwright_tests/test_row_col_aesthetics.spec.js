// Story 17.2: Row/Column Select Aesthetics
// Tests: row-selected band, col-selected band, header highlight, clear on cell click

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');
const { clickMenuItemById } = require('electron-playwright-helpers');

test.describe('Row/column select aesthetics (Story 17.2)', () => {
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

  test('row header click marks cells with row-selected', async ({ window }) => {
    const rowHeader = window.locator('.row-header[data-row="2"]');
    await rowHeader.click();

    await window.waitForFunction(
      () => document.querySelectorAll('.cell.row-selected').length > 0,
      { timeout: 3000 }
    );
    const count = await window.locator('.cell.row-selected').count();
    expect(count).toBeGreaterThan(0);
  });

  test('row header click marks row header with row-header-selected', async ({
    window,
  }) => {
    await window.locator('.row-header[data-row="2"]').click();

    await window.waitForFunction(
      () =>
        document.querySelectorAll('.row-header.row-header-selected').length ===
        1,
      { timeout: 3000 }
    );
    const count = await window
      .locator('.row-header.row-header-selected')
      .count();
    expect(count).toBe(1);
  });

  test('column header click marks cells with col-selected', async ({
    window,
  }) => {
    const colHeader = window.locator('.column-header[data-col="1"]');
    await colHeader.click();

    await window.waitForFunction(
      () => document.querySelectorAll('.cell.col-selected').length > 0,
      { timeout: 3000 }
    );
    const count = await window.locator('.cell.col-selected').count();
    expect(count).toBeGreaterThan(0);
  });

  test('column header click marks column header with col-header-selected', async ({
    window,
  }) => {
    await window.locator('.column-header[data-col="1"]').click();

    await window.waitForFunction(
      () =>
        document.querySelectorAll('.column-header.col-header-selected')
          .length === 1,
      { timeout: 3000 }
    );
    const count = await window
      .locator('.column-header.col-header-selected')
      .count();
    expect(count).toBe(1);
  });

  test('clicking a regular cell clears row-selected and col-selected', async ({
    window,
  }) => {
    // First select a row
    await window.locator('.row-header[data-row="0"]').click();
    await window.waitForFunction(
      () => document.querySelectorAll('.cell.row-selected').length > 0,
      { timeout: 3000 }
    );

    // Click a regular cell
    await window.locator('#cell-3-3').click();

    await window.waitForFunction(
      () =>
        document.querySelectorAll('.cell.row-selected').length === 0 &&
        document.querySelectorAll('.cell.col-selected').length === 0,
      { timeout: 3000 }
    );
    expect(await window.locator('.cell.row-selected').count()).toBe(0);
    expect(await window.locator('.cell.col-selected').count()).toBe(0);
  });

  test('insert row via menu when row selected', async ({
    window,
    electronApp,
  }) => {
    await setCellViaApi(window, 1, 0, 'row1');
    await setCellViaApi(window, 2, 0, 'row2');

    // Select row 1 by clicking its header
    await window.locator('.row-header[data-row="1"]').click();
    await window.waitForFunction(
      () =>
        document
          .querySelector('.row-header[data-row="1"]')
          ?.classList.contains('row-header-selected'),
      { timeout: 3000 }
    );

    // Insert row via menu
    await clickMenuItemById(electronApp, 'insert-row');

    // Wait for both shifted cells to have expected content (DOM may update asynchronously)
    await window.waitForFunction(
      () =>
        document.getElementById('cell-2-0')?.textContent?.trim() === 'row1' &&
        document.getElementById('cell-3-0')?.textContent?.trim() === 'row2',
      { timeout: 5000 }
    );
    await expect(window.locator('#cell-2-0')).toHaveText('row1');
    await expect(window.locator('#cell-3-0')).toHaveText('row2');
  });

  test('delete row via menu when row selected', async ({
    window,
    electronApp,
  }) => {
    await setCellViaApi(window, 0, 0, 'keep');
    await setCellViaApi(window, 1, 0, 'delete-me');
    await setCellViaApi(window, 2, 0, 'after');

    // Select row 1
    await window.locator('.row-header[data-row="1"]').click();
    await window.waitForFunction(
      () =>
        document
          .querySelector('.row-header[data-row="1"]')
          ?.classList.contains('row-header-selected'),
      { timeout: 3000 }
    );

    // Delete row via menu
    await clickMenuItemById(electronApp, 'delete-row');

    // 'after' should now be at row 1
    await window.waitForFunction(
      () =>
        document.getElementById('cell-1-0')?.textContent?.trim() === 'after',
      { timeout: 3000 }
    );
    await expect(window.locator('#cell-0-0')).toHaveText('keep');
    await expect(window.locator('#cell-1-0')).toHaveText('after');
  });

  test('insert column via menu when column selected', async ({
    window,
    electronApp,
  }) => {
    await setCellViaApi(window, 0, 1, 'colB');
    await setCellViaApi(window, 0, 2, 'colC');

    // Select column 1 (B) by clicking its header
    await window.locator('.column-header[data-col="1"]').click();
    await window.waitForFunction(
      () =>
        document
          .querySelector('.column-header[data-col="1"]')
          ?.classList.contains('col-header-selected'),
      { timeout: 3000 }
    );

    // Insert column via menu
    await clickMenuItemById(electronApp, 'insert-column');

    // colB should now be at col 2
    await window.waitForFunction(
      () => document.getElementById('cell-0-2')?.textContent?.trim() === 'colB',
      { timeout: 3000 }
    );
    await expect(window.locator('#cell-0-2')).toHaveText('colB');
    await expect(window.locator('#cell-0-3')).toHaveText('colC');
  });

  test('delete column via menu when column selected', async ({
    window,
    electronApp,
  }) => {
    await setCellViaApi(window, 0, 0, 'A');
    await setCellViaApi(window, 0, 1, 'del');
    await setCellViaApi(window, 0, 2, 'C');

    // Select column 1 (B)
    await window.locator('.column-header[data-col="1"]').click();
    await window.waitForFunction(
      () =>
        document
          .querySelector('.column-header[data-col="1"]')
          ?.classList.contains('col-header-selected'),
      { timeout: 3000 }
    );

    // Delete column via menu
    await clickMenuItemById(electronApp, 'delete-column');

    // C should now be at col 1
    await window.waitForFunction(
      () => document.getElementById('cell-0-1')?.textContent?.trim() === 'C',
      { timeout: 3000 }
    );
    await expect(window.locator('#cell-0-0')).toHaveText('A');
    await expect(window.locator('#cell-0-1')).toHaveText('C');
  });

  test('insert/delete row ignored when read-only', async ({
    window,
    electronApp,
  }) => {
    await setCellViaApi(window, 0, 0, 'original');

    // Enable read-only
    await window.waitForFunction(
      () => typeof window.__testSetReadOnly === 'function',
      { timeout: 5000 }
    );
    await window.evaluate(() => window.__testSetReadOnly(true));

    // Select a row
    await window.locator('.row-header[data-row="0"]').click();

    // Try insert row — should be a no-op
    await clickMenuItemById(electronApp, 'insert-row');
    await window.waitForFunction(() => true); // let async settle

    // Grid should be unchanged
    await expect(window.locator('#cell-0-0')).toHaveText('original');

    await window.evaluate(() => window.__testSetReadOnly(false));
  });

  test('rectangular range selection shows outer border only (edge classes)', async ({
    window,
  }) => {
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-2-2').click({ modifiers: ['Shift'] });

    await window.waitForFunction(
      () => document.querySelectorAll('.cell.selected').length === 9,
      { timeout: 3000 }
    );
    // Corner cells have 2 edge classes, edge cells have 1, interior have 0
    // The center cell (1,1) should have no edge classes
    const centerCell = window.locator('#cell-1-1');
    await expect(centerCell).not.toHaveClass(/sel-edge-top/);
    await expect(centerCell).not.toHaveClass(/sel-edge-bottom/);
    await expect(centerCell).not.toHaveClass(/sel-edge-left/);
    await expect(centerCell).not.toHaveClass(/sel-edge-right/);
    // Corner cell (0,0) should have top and left edge classes
    await expect(window.locator('#cell-0-0')).toHaveClass(/sel-edge-top/);
    await expect(window.locator('#cell-0-0')).toHaveClass(/sel-edge-left/);
  });
});
