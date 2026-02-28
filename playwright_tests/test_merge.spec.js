// Story 11.4: Merge-aware cell logic - Playwright tests
// Story 11.5: Format menu Merge/Unmerge - E2E tests
// Verifies selection, formula bar, editing, and Format menu merge/unmerge

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  selectCellByClick,
  selectCellViaApp,
  setMergeViaApi,
  startEditingViaApp,
  waitForEditModeReady,
} = require('./helpers');

test.describe('Merge-aware cell behavior (Story 11.4)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('selecting anchor shows value in formula bar', async ({ window }) => {
    await setMergeViaApi(window, 0, 0, 1, 2); // A1:B1 merged
    await setCellViaApi(window, 0, 0, 'merged');
    await selectCellViaApp(window, 0, 0);

    const formulaBar = window.locator('#formula-bar');
    await expect(formulaBar).toHaveValue('merged');
  });

  test('selecting covered cell resolves to anchor and shows anchor value', async ({
    window,
  }) => {
    await setMergeViaApi(window, 0, 0, 1, 2); // A1:B1 merged
    await setCellViaApi(window, 0, 0, 'anchor');
    await selectCellViaApp(window, 0, 1); // B1 is covered, should resolve to A1

    const formulaBar = window.locator('#formula-bar');
    await expect(formulaBar).toHaveValue('anchor');
  });

  test('merged cell displays value across span', async ({ window }) => {
    await setMergeViaApi(window, 0, 0, 1, 3); // A1:C1 merged
    await setCellViaApi(window, 0, 0, 'wide');

    const anchorCell = window.locator('#cell-0-0');
    await expect(anchorCell).toHaveText('wide');
    // B1 and C1 are covered - no separate td; anchor spans them
    await expect(anchorCell).toHaveAttribute('colspan', '3');
  });

  test('editing merged cell updates anchor', async ({ window }) => {
    await setMergeViaApi(window, 2, 0, 2, 1); // A3:A4 merged
    await setCellViaApi(window, 2, 0, '');
    await selectCellViaApp(window, 2, 0);

    const cell = window.locator('#cell-2-0');
    await startEditingViaApp(window, 2, 0);
    await waitForEditModeReady(window);
    await window.keyboard.type('edited');
    await window.keyboard.press('Enter');

    await expect(cell).toHaveText('edited');
  });
});

test.describe('Format menu Merge/Unmerge (Story 11.5)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('Format → Merge Cells merges selected range', async ({
    electronApp,
    window,
  }) => {
    const cellA1 = window.locator('#cell-0-0');
    const cellB1 = window.locator('#cell-0-1');
    await cellA1.click();
    await cellB1.click({ modifiers: ['Shift'] });

    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const formatMenu = menu.items.find((item) => item.label === 'Format');
      const mergeItem = formatMenu?.submenu?.items.find(
        (item) => item.label === 'Merge Cells'
      );
      if (mergeItem?.click) mergeItem.click();
    });

    await window.waitForTimeout(500);
    const anchor = window.locator('#cell-0-0');
    await expect(anchor).toHaveAttribute('colspan', '2');
  });

  test('Format → Unmerge splits merged cell', async ({
    electronApp,
    window,
  }) => {
    await setMergeViaApi(window, 0, 0, 1, 2);
    await setCellViaApi(window, 0, 0, 'header');
    await selectCellViaApp(window, 0, 0);

    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const formatMenu = menu.items.find((item) => item.label === 'Format');
      const unmergeItem = formatMenu?.submenu?.items.find(
        (item) => item.label === 'Unmerge'
      );
      if (unmergeItem?.click) unmergeItem.click();
    });

    await window.waitForTimeout(500);
    const cellA1 = window.locator('#cell-0-0');
    const cellB1 = window.locator('#cell-0-1');
    await expect(cellA1).toHaveText('header');
    await expect(cellB1).toBeVisible();
  });
});
