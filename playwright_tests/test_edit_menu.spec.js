// Story 7.2: Edit Menu Tests
// Tests for Cut, Copy, Paste, and Select All menu functionality
// Story 8.2: Navigate from welcome screen; #new-btn is in spreadsheet view

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellAndSelect,
  selectCellViaApp,
} = require('./helpers');

test.describe('Edit Menu Tests', () => {
  // Create new file before each test to ensure isolation
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    // Click New button to start with fresh spreadsheet
    const newBtn = window.locator('#new-btn');
    await newBtn.click();
    await window.waitForTimeout(300);
  });

  test('Edit menu exists with all required items', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');

    // Wait for grid to be visible
    const grid = await window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Poll for Edit menu to be fully populated
    let editMenuItems = [];
    for (let i = 0; i < 20; i++) {
      editMenuItems = await electronApp.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        const editMenu = menu.items.find((item) => item.label === 'Edit');

        if (!editMenu) return [];

        return editMenu.submenu.items.map((item) => ({
          label: item.label,
          accelerator: item.accelerator,
          type: item.type,
        }));
      });

      if (editMenuItems.length >= 4) {
        break;
      }

      await window.waitForTimeout(100);
    }

    console.log(
      '[Edit Menu Test] Found',
      editMenuItems.length,
      'Edit menu items'
    );

    // Verify menu structure
    expect(editMenuItems.length).toBeGreaterThanOrEqual(4);

    // Check for Cut
    const cutItem = editMenuItems.find((item) => item.label === 'Cut');
    expect(cutItem).toBeTruthy();
    expect(cutItem.accelerator).toContain('X');

    // Check for Copy
    const copyItem = editMenuItems.find((item) => item.label === 'Copy');
    expect(copyItem).toBeTruthy();
    expect(copyItem.accelerator).toContain('C');

    // Check for Paste
    const pasteItem = editMenuItems.find((item) => item.label === 'Paste');
    expect(pasteItem).toBeTruthy();
    expect(pasteItem.accelerator).toContain('V');

    // Check for Select All
    const selectAllItem = editMenuItems.find(
      (item) => item.label === 'Select All'
    );
    expect(selectAllItem).toBeTruthy();
    expect(selectAllItem.accelerator).toContain('A');

    // Check for separator before Select All
    const separatorIndex = editMenuItems.findIndex(
      (item) => item.type === 'separator'
    );
    expect(separatorIndex).toBeGreaterThan(-1);

    console.log('[Edit Menu Test] Edit menu structure verified');
  });

  test('Edit menu items have correct IDs', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = await window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Poll for menu to be ready
    let hasIds = false;
    for (let i = 0; i < 20; i++) {
      hasIds = await electronApp.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        if (!menu) return false;

        const editMenu = menu.items.find((item) => item.label === 'Edit');
        if (!editMenu) return false;

        const cutItem = menu.getMenuItemById('cut');
        const copyItem = menu.getMenuItemById('copy');
        const pasteItem = menu.getMenuItemById('paste');
        const selectAllItem = menu.getMenuItemById('select-all');

        return !!(cutItem && copyItem && pasteItem && selectAllItem);
      });

      if (hasIds) break;
      await window.waitForTimeout(100);
    }

    expect(hasIds).toBe(true);
    console.log('[Edit Menu Test] All menu items have correct IDs');
  });

  test('Copy menu item copies cell value to clipboard', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = await window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    const cell = window.locator('#cell-0-0');
    await expect(cell).toBeVisible();
    await setCellAndSelect(window, 0, 0, 'Test Value');

    // Trigger Copy from menu
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');
      const copyItem = editMenu.submenu.items.find(
        (item) => item.label === 'Copy'
      );
      if (copyItem && copyItem.click) {
        copyItem.click();
      }
    });

    // Wait for clipboard operation to complete
    await window.waitForTimeout(800);

    // Verify clipboard content by pasting into another cell
    const cellB1 = await window.locator('.cell[data-row="0"][data-col="1"]');
    await selectCellViaApp(window, 0, 1);
    await window.waitForTimeout(200);

    // Trigger paste from menu (more reliable than keyboard shortcut)
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');
      const pasteItem = editMenu.submenu.items.find(
        (item) => item.label === 'Paste'
      );
      if (pasteItem && pasteItem.click) {
        pasteItem.click();
      }
    });

    await expect(cellB1).toHaveText('Test Value', { timeout: 5000 });

    console.log('[Edit Menu Test] Copy operation successful');
  });

  test('Cut menu item cuts cell value', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = await window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    const cell = window.locator('.cell[data-row="0"][data-col="0"]');
    await expect(cell).toBeVisible();
    await setCellAndSelect(window, 0, 0, 'Cut Me');

    // Trigger Cut from menu
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');
      const cutItem = editMenu.submenu.items.find(
        (item) => item.label === 'Cut'
      );
      if (cutItem && cutItem.click) {
        cutItem.click();
      }
    });

    // Wait for cell to be cleared
    await expect(cell).toHaveText('', { timeout: 5000 });

    // Paste into B1 to verify clipboard
    const cellB1 = await window.locator('.cell[data-row="0"][data-col="1"]');
    await selectCellViaApp(window, 0, 1);
    await window.waitForTimeout(200);

    // Use menu paste instead of keyboard
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');
      const pasteItem = editMenu.submenu.items.find(
        (item) => item.label === 'Paste'
      );
      if (pasteItem && pasteItem.click) {
        pasteItem.click();
      }
    });

    await expect(cellB1).toHaveText('Cut Me', { timeout: 5000 });

    console.log('[Edit Menu Test] Cut operation successful');
  });

  test('Paste menu item pastes clipboard content', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = await window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    const cellA1 = window.locator('.cell[data-row="0"][data-col="0"]');
    await expect(cellA1).toBeVisible();
    await setCellAndSelect(window, 0, 0, 'Original');

    // Copy A1 using menu
    await window.waitForTimeout(200);

    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');
      const copyItem = editMenu.submenu.items.find(
        (item) => item.label === 'Copy'
      );
      if (copyItem && copyItem.click) {
        copyItem.click();
      }
    });

    await window.waitForTimeout(800);

    // Select B1 and use Paste menu
    const cellB1 = window.locator('.cell[data-row="0"][data-col="1"]');
    await selectCellViaApp(window, 0, 1);

    // Trigger Paste from menu
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');
      const pasteItem = editMenu.submenu.items.find(
        (item) => item.label === 'Paste'
      );
      if (pasteItem && pasteItem.click) {
        pasteItem.click();
      }
    });

    // Verify paste worked
    await expect(cellB1).toHaveText('Original', { timeout: 5000 });

    console.log('[Edit Menu Test] Paste operation successful');
  });

  test('Keyboard shortcuts are registered for Edit menu', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = await window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Verify keyboard shortcuts are registered in the menu
    const shortcuts = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');

      if (!editMenu) return null;

      return {
        cut: editMenu.submenu.items.find((item) => item.label === 'Cut')
          ?.accelerator,
        copy: editMenu.submenu.items.find((item) => item.label === 'Copy')
          ?.accelerator,
        paste: editMenu.submenu.items.find((item) => item.label === 'Paste')
          ?.accelerator,
        selectAll: editMenu.submenu.items.find(
          (item) => item.label === 'Select All'
        )?.accelerator,
      };
    });

    expect(shortcuts).not.toBeNull();
    expect(shortcuts.cut).toContain('X');
    expect(shortcuts.copy).toContain('C');
    expect(shortcuts.paste).toContain('V');
    expect(shortcuts.selectAll).toContain('A');

    console.log(
      '[Edit Menu Test] All keyboard shortcuts are registered:',
      shortcuts
    );
  });

  test('Select All menu item works', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = await window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    await setCellAndSelect(window, 0, 0, 'A1');
    await setCellAndSelect(window, 1, 1, 'B2');

    // Trigger Select All from menu
    await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');
      const selectAllItem = editMenu.submenu.items.find(
        (item) => item.label === 'Select All'
      );
      if (selectAllItem && selectAllItem.click) {
        selectAllItem.click();
      }
    });

    // Wait for alert dialog
    await window.waitForTimeout(1000);

    // Check if modal appeared (Select All shows an alert)
    const modal = await window.locator('#modal-overlay');
    const isVisible = await modal.isVisible();

    if (isVisible) {
      // Close the alert
      const okButton = await window.locator('#modal-ok');
      await okButton.click();
    }

    // Verify a cell is selected (Select All selects first cell of range)
    const selectedCell = await window.locator('.cell.selected');
    await expect(selectedCell).toBeVisible();

    console.log('[Edit Menu Test] Select All operation completed');
  });
});
