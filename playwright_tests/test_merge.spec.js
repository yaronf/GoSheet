// Story 11.4: Merge-aware cell logic - Playwright tests
// Verifies selection, formula bar, and editing work correctly with merged cells

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
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
    await setCellViaApi(window, 2, 0, 'edit-me');
    await selectCellViaApp(window, 2, 0);

    const cell = window.locator('#cell-2-0');
    await startEditingViaApp(window, 2, 0);
    await waitForEditModeReady(window);
    await window.keyboard.type('edited');
    await window.keyboard.press('Enter');

    await expect(cell).toHaveText('edited');
  });
});
