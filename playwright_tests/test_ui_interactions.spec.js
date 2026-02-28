// UI interaction tests - run in Chromium (web) for reliable clicks
// Per technical-ui-testing-research-2026-02-28: Chromium avoids Electron click flakiness
// These tests MUST use real DOM interactions (single click, double click, shift+click)
// Serial mode + shared page: go through welcome flow once, avoid flaky per-test setup

const { test, expect } = require('@playwright/test');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  waitForEditModeReady,
} = require('./helpers');

test.describe('UI interactions (Chromium - real clicks)', () => {
  test.describe.configure({ mode: 'serial' });

  let page;
  let context;
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      baseURL: `http://localhost:${process.env.GOSHEET_WEB_PORT || 3001}`,
    });
    page = await context.newPage();
    await page.goto('/');
    await ensureSpreadsheetView(page);
  });

  test.beforeEach(async () => {
    await ensureSpreadsheetView(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('single click selects cell', async () => {
    const cell = page.locator('#cell-5-5');
    await cell.click();
    await expect(cell).toHaveClass(/selected/, { timeout: 2000 });
  });

  test('single click updates formula bar', async () => {
    await setCellViaApi(page, 3, 2, 'hello');
    const cell = page.locator('#cell-3-2');
    await cell.click();
    await expect(cell).toHaveClass(/selected/);
    const cellRef = page.locator('#cell-ref');
    await expect(cellRef).toHaveText('C4');
  });

  test('double click enters edit mode', async () => {
    await setCellViaApi(page, 2, 1, 'edit-me');
    const cell = page.locator('#cell-2-1');
    await cell.dblclick();
    const editor = page.locator('.cell-editor');
    await expect(editor).toBeVisible({ timeout: 2000 });
    await editor.type('X');
    await page.keyboard.press('Enter');
    await expect(cell).toHaveText('edit-meX');
  });

  test('shift+click extends selection to range', async () => {
    const cellA1 = page.locator('#cell-0-0');
    const cellC3 = page.locator('#cell-2-2');
    await cellA1.click();
    await expect(cellA1).toHaveClass(/selected/);
    await cellC3.click({ modifiers: ['Shift'] });
    await expect(cellA1).toHaveClass(/selected/);
    await expect(cellC3).toHaveClass(/selected/);
    const selectedCount = await page.locator('.cell.selected').count();
    expect(selectedCount).toBe(9);
  });

  test('click away from cell saves edit', async () => {
    await setCellViaApi(page, 4, 2, '99');
    const cell = page.locator('#cell-4-2');
    await cell.dblclick();
    await waitForEditModeReady(page);
    await page.keyboard.type('00');
    const otherCell = page.locator('#cell-0-0');
    await otherCell.click();
    await expect(cell).toHaveText('9900');
  });
});
