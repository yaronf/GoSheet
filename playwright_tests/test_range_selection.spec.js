// Story 17.1: Range Selection — Shift-Click and Drag
// Tests: shift-click, drag, arrow-key collapse, Shift+Arrow extend, address box

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView } = require('./helpers');

test.describe('Range selection (Story 17.1)', () => {
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

  test('shift-click selects rectangular range', async ({ window }) => {
    // Click A1 (row=0, col=0)
    await window.locator('#cell-0-0').click();
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);

    // Shift-click C3 (row=2, col=2) — expects 9 cells selected
    await window.locator('#cell-2-2').click({ modifiers: ['Shift'] });

    await window.waitForFunction(
      () => document.querySelectorAll('.cell.selected').length === 9,
      { timeout: 3000 }
    );
    const selected = await window.locator('.cell.selected').count();
    expect(selected).toBe(9);
  });

  test('shift-click shows range address in address box', async ({ window }) => {
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-1-1').click({ modifiers: ['Shift'] });

    await window.waitForFunction(
      () => document.querySelectorAll('.cell.selected').length === 4,
      { timeout: 3000 }
    );
    const addr = await window.locator('#cell-ref').inputValue();
    expect(addr).toBe('A1:B2');
  });

  test('drag selects range', async ({ window }) => {
    const cell00 = window.locator('#cell-0-0');
    const cell11 = window.locator('#cell-1-1');

    await cell00.waitFor({ state: 'visible' });
    await cell11.waitFor({ state: 'visible' });

    const box00 = await cell00.boundingBox();
    const box11 = await cell11.boundingBox();

    // Use page.mouse for a real drag (mousedown → mousemove → mouseup)
    await window.mouse.move(
      box00.x + box00.width / 2,
      box00.y + box00.height / 2
    );
    await window.mouse.down();
    await window.mouse.move(
      box11.x + box11.width / 2,
      box11.y + box11.height / 2,
      { steps: 5 }
    );
    await window.mouse.up();

    await window.waitForFunction(
      () => document.querySelectorAll('.cell.selected').length === 4,
      { timeout: 3000 }
    );
    const selected = await window.locator('.cell.selected').count();
    expect(selected).toBe(4);
  });

  test('plain arrow key collapses range to single cell', async ({ window }) => {
    // Select A1:C3 via shift-click
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-2-2').click({ modifiers: ['Shift'] });
    await window.waitForFunction(
      () => document.querySelectorAll('.cell.selected').length === 9,
      { timeout: 3000 }
    );

    // Press ArrowRight (no shift) — should collapse to anchor (A1) then move right to B1
    await window.keyboard.press('ArrowRight');
    await window.waitForFunction(
      () => document.querySelectorAll('.cell.selected').length === 1,
      { timeout: 3000 }
    );
    const selected = await window.locator('.cell.selected').count();
    expect(selected).toBe(1);
    await expect(window.locator('#cell-0-1')).toHaveClass(/selected/);
  });

  test('Shift+Arrow extends selection', async ({ window }) => {
    // Click A1
    await window.locator('#cell-0-0').click();
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);

    // Shift+ArrowRight twice — should give A1:C1 (3 cells)
    await window.keyboard.press('Shift+ArrowRight');
    await window.keyboard.press('Shift+ArrowRight');

    await window.waitForFunction(
      () => document.querySelectorAll('.cell.selected').length === 3,
      { timeout: 3000 }
    );
    const selected = await window.locator('.cell.selected').count();
    expect(selected).toBe(3);

    // Address box should show A1:C1
    const addr = await window.locator('#cell-ref').inputValue();
    expect(addr).toBe('A1:C1');
  });
});
