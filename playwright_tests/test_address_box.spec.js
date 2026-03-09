// Story 17.4: Range Address Box — Type to Select

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView } = require('./helpers');

test.describe('Address box (Story 17.4)', () => {
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
    // Start with a known selection
    await window.locator('#cell-0-0').click();
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);
  });

  test('type single cell address and press Enter navigates to that cell', async ({
    window,
  }) => {
    const cellRef = window.locator('#cell-ref');
    await cellRef.click();
    await cellRef.fill('C5');
    await cellRef.press('Enter');

    await window.waitForFunction(
      () => document.getElementById('cell-4-2')?.classList.contains('selected'),
      { timeout: 3000 }
    );
    expect(await cellRef.inputValue()).toBe('C5');
  });

  test('type range address and press Enter selects the range', async ({
    window,
  }) => {
    const cellRef = window.locator('#cell-ref');
    await cellRef.click();
    await cellRef.fill('A1:B2');
    await cellRef.press('Enter');

    await window.waitForFunction(
      () => document.querySelectorAll('.cell.selected').length === 4,
      { timeout: 3000 }
    );
    expect(await cellRef.inputValue()).toBe('A1:B2');
  });

  test('invalid address adds cell-ref-invalid class and leaves selection unchanged', async ({
    window,
  }) => {
    // First select a known range
    const cellRef = window.locator('#cell-ref');
    await cellRef.click();
    await cellRef.fill('A1:B2');
    await cellRef.press('Enter');
    await window.waitForFunction(
      () => document.querySelectorAll('.cell.selected').length === 4,
      { timeout: 3000 }
    );

    // Now type invalid address
    await cellRef.click();
    await cellRef.fill('ZZQQ99:');
    await cellRef.press('Enter');

    const hasInvalidClass = await cellRef.evaluate((el) =>
      el.classList.contains('cell-ref-invalid')
    );
    expect(hasInvalidClass).toBe(true);
    // Selection still 4 cells (A1:B2 unchanged)
    expect(await window.locator('.cell.selected').count()).toBe(4);
  });

  test('typing in address box clears invalid state', async ({ window }) => {
    const cellRef = window.locator('#cell-ref');
    await cellRef.click();
    await cellRef.fill('ZZQQ99:');
    await cellRef.press('Enter');
    expect(
      await cellRef.evaluate((el) => el.classList.contains('cell-ref-invalid'))
    ).toBe(true);

    await cellRef.fill('A');
    expect(
      await cellRef.evaluate((el) => el.classList.contains('cell-ref-invalid'))
    ).toBe(false);
  });

  test('Escape reverts address box to current selection', async ({
    window,
  }) => {
    // Select A1:B2 via address box
    const cellRef = window.locator('#cell-ref');
    await cellRef.click();
    await cellRef.fill('A1:B2');
    await cellRef.press('Enter');
    await window.waitForFunction(
      () => document.querySelectorAll('.cell.selected').length === 4,
      { timeout: 3000 }
    );

    // Start typing something else, then Escape
    await cellRef.click();
    await cellRef.fill('D10');
    await cellRef.press('Escape');

    expect(await cellRef.inputValue()).toBe('A1:B2');
  });

  test('selection change updates address box', async ({ window }) => {
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-2-2').click({ modifiers: ['Shift'] });

    await window.waitForFunction(
      () => {
        const el = document.getElementById('cell-ref');
        return el && el.value === 'A1:C3';
      },
      { timeout: 2000 }
    );
    expect(await window.locator('#cell-ref').inputValue()).toBe('A1:C3');
  });
});
