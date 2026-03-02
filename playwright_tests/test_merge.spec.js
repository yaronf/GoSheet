// Story 11.4: Merge-aware cell logic - Playwright tests
// Story 11.5: Format menu Merge/Unmerge - E2E tests
// Verifies selection, formula bar, editing, and Format menu merge/unmerge

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  selectCellViaApp,
  setMergeViaApi,
  setStyleViaApi,
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

  test('arrow keys skip covered cells (Story 11.6)', async ({ window }) => {
    await setMergeViaApi(window, 0, 0, 1, 2); // A1:B1 merged
    await setCellViaApi(window, 0, 0, 'h');
    await selectCellViaApp(window, 0, 0);

    await window.keyboard.press('ArrowRight');
    await window.waitForTimeout(150);
    const cellC1 = window.locator('#cell-0-2');
    await expect(cellC1).toHaveClass(/selected/);

    await window.keyboard.press('ArrowLeft');
    await window.waitForTimeout(150);
    const cellA1 = window.locator('#cell-0-0');
    await expect(cellA1).toHaveClass(/selected/);
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

test.describe('Format menu styles (Story 12.2)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('Format → Title applies Title style to selection', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'Report Title');
    await selectCellViaApp(window, 0, 0);

    const styleApplied = window.evaluate(() => {
      return new Promise((resolve, reject) => {
        const handler = () => {
          window.removeEventListener('style-applied', handler);
          clearTimeout(timer);
          resolve();
        };
        window.addEventListener('style-applied', handler);
        const timer = setTimeout(() => {
          window.removeEventListener('style-applied', handler);
          const err = window.__lastStyleError
            ? `Style apply failed: ${window.__lastStyleError}`
            : 'Style apply timed out (no style-applied event, menu may not have triggered)';
          reject(new Error(err));
        }, 5000);
      });
    });

    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const formatMenu = menu.items.find((item) => item.label === 'Format');
      const titleItem = formatMenu?.submenu?.items.find(
        (item) => item.label === 'Title'
      );
      if (titleItem?.click) titleItem.click();
    });

    await styleApplied;
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveClass(/style-title/);
    await expect(cell).toHaveText('Report Title');
  });

  test('Format → Header applies Header style to selection', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 1, 0, 'Col A');
    await setCellViaApi(window, 1, 1, 'Col B');
    const cellA = window.locator('#cell-1-0');
    const cellB = window.locator('#cell-1-1');
    await cellA.click();
    await cellB.click({ modifiers: ['Shift'] });

    const styleApplied = window.evaluate(() => {
      return new Promise((resolve, reject) => {
        const handler = () => {
          window.removeEventListener('style-applied', handler);
          clearTimeout(timer);
          resolve();
        };
        window.addEventListener('style-applied', handler);
        const timer = setTimeout(() => {
          window.removeEventListener('style-applied', handler);
          const err = window.__lastStyleError
            ? `Style apply failed: ${window.__lastStyleError}`
            : 'Style apply timed out (no style-applied event)';
          reject(new Error(err));
        }, 5000);
      });
    });

    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const formatMenu = menu.items.find((item) => item.label === 'Format');
      const headerItem = formatMenu?.submenu?.items.find(
        (item) => item.label === 'Header'
      );
      if (headerItem?.click) headerItem.click();
    });

    await styleApplied;
    await expect(cellA).toHaveClass(/style-header/);
    await expect(cellB).toHaveClass(/style-header/);
  });

  test('Format → Total applies Total style to selection', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 2, 0, 'Subtotal');
    await selectCellViaApp(window, 2, 0);

    const styleApplied = window.evaluate(() => {
      return new Promise((resolve, reject) => {
        const handler = () => {
          window.removeEventListener('style-applied', handler);
          clearTimeout(timer);
          resolve();
        };
        window.addEventListener('style-applied', handler);
        const timer = setTimeout(() => {
          window.removeEventListener('style-applied', handler);
          const err = window.__lastStyleError
            ? `Style apply failed: ${window.__lastStyleError}`
            : 'Style apply timed out (no style-applied event)';
          reject(new Error(err));
        }, 5000);
      });
    });

    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const formatMenu = menu.items.find((item) => item.label === 'Format');
      const totalItem = formatMenu?.submenu?.items.find(
        (item) => item.label === 'Total'
      );
      if (totalItem?.click) totalItem.click();
    });

    await styleApplied;
    const cell = window.locator('#cell-2-0');
    await expect(cell).toHaveClass(/style-total/);
    await expect(cell).toHaveText('Subtotal');
  });

  test('Format → Format Cleanup removes style from empty cells (Story 12.3)', async ({
    electronApp,
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'Keep');
    await setCellViaApi(window, 1, 0, '');
    await setStyleViaApi(window, 1, 0, 1, 0, 1); // Title on empty A2

    const cellA1 = window.locator('#cell-0-0');
    const cellA2 = window.locator('#cell-1-0');
    await expect(cellA1).toHaveText('Keep');
    await expect(cellA2).toHaveClass(/style-title/);

    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const formatMenu = menu.items.find((item) => item.label === 'Format');
      const cleanupItem = formatMenu?.submenu?.items.find(
        (item) => item.label === 'Format Cleanup'
      );
      if (cleanupItem?.click) cleanupItem.click();
    });

    await window.waitForTimeout(300);
    await expect(cellA1).toHaveText('Keep'); // Values must be preserved
    await expect(cellA2).not.toHaveClass(/style-title/);
  });
});
