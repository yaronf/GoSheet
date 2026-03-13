// Story 7.4: Keyboard Shortcuts Tests
// Comprehensive tests for all keyboard shortcuts
// Story 8.2: Navigate from welcome screen before testing shortcuts

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView } = require('./helpers');

test.describe('Keyboard Shortcuts Tests', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('All menu items have correct accelerators', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Get all accelerators from menus
    const accelerators = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const result = {};

      menu.items.forEach((topLevelItem) => {
        if (topLevelItem.submenu) {
          topLevelItem.submenu.items.forEach((item) => {
            if (item.accelerator) {
              result[item.label] = item.accelerator;
            }
          });
        }
      });

      return result;
    });

    // Verify all required shortcuts
    expect(accelerators['New']).toContain('N');
    expect(accelerators['Open...']).toContain('O');
    expect(accelerators['Save']).toContain('S');
    expect(accelerators['Save As...']).toContain('Shift+S');
    expect(accelerators['Close Window']).toContain('W');
    expect(accelerators['Cut']).toContain('X');
    expect(accelerators['Copy']).toContain('C');
    expect(accelerators['Paste']).toContain('V');
    expect(accelerators['Go to Range\u2026']).toContain('G');

    // Note: Quit is in the macOS app menu (handled by Electron role: 'quit')
    // We can't easily verify it from the accelerators list, but it's standard Electron behavior
    // Just verify we have all the main shortcuts
    console.log(
      '[Keyboard Shortcuts Test] Found accelerators:',
      Object.keys(accelerators)
    );

    console.log(
      '[Keyboard Shortcuts Test] All accelerators verified:',
      accelerators
    );
  });

  test('File menu shortcuts are properly formatted', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    const fileShortcuts = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const fileMenu = menu.items.find((item) => item.label === 'File');

      if (!fileMenu) return null;

      const shortcuts = {};
      fileMenu.submenu.items.forEach((item) => {
        if (item.accelerator) {
          shortcuts[item.id || item.label] = {
            label: item.label,
            accelerator: item.accelerator,
            enabled: item.enabled,
          };
        }
      });

      return shortcuts;
    });

    expect(fileShortcuts).not.toBeNull();
    expect(fileShortcuts['new'].accelerator).toBe('CmdOrCtrl+N');
    expect(fileShortcuts['open'].accelerator).toBe('CmdOrCtrl+O');
    expect(fileShortcuts['save'].accelerator).toBe('CmdOrCtrl+S');
    expect(fileShortcuts['save-as'].accelerator).toBe('CmdOrCtrl+Shift+S');
    expect(fileShortcuts['close'].accelerator).toBe('CmdOrCtrl+W');

    console.log('[Keyboard Shortcuts Test] File menu shortcuts verified');
  });

  test('Edit menu shortcuts are properly formatted', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    const editShortcuts = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((item) => item.label === 'Edit');

      if (!editMenu) return null;

      const shortcuts = {};
      editMenu.submenu.items.forEach((item) => {
        if (item.accelerator) {
          shortcuts[item.id || item.label] = {
            label: item.label,
            accelerator: item.accelerator,
          };
        }
      });

      return shortcuts;
    });

    expect(editShortcuts).not.toBeNull();
    expect(editShortcuts['cut'].accelerator).toBe('CmdOrCtrl+X');
    expect(editShortcuts['copy'].accelerator).toBe('CmdOrCtrl+C');
    expect(editShortcuts['paste'].accelerator).toBe('CmdOrCtrl+V');
    expect(editShortcuts['select-all'].accelerator).toBe('CmdOrCtrl+G');

    console.log('[Keyboard Shortcuts Test] Edit menu shortcuts verified');
  });

  test('Cmd+N shortcut is registered', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Verify Cmd+N is registered in the menu
    const hasNewShortcut = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const newItem = menu.getMenuItemById('new');
      return newItem && newItem.accelerator === 'CmdOrCtrl+N';
    });

    expect(hasNewShortcut).toBe(true);

    console.log(
      '[Keyboard Shortcuts Test] Cmd+N shortcut is properly registered'
    );
  });

  test('Cmd+S is disabled when no changes', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Check Save menu item is disabled initially
    const saveEnabled = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const saveItem = menu.getMenuItemById('save');
      return saveItem ? saveItem.enabled : null;
    });

    expect(saveEnabled).toBe(false);

    console.log(
      '[Keyboard Shortcuts Test] Cmd+S correctly disabled when no changes'
    );
  });

  test('Cmd+S becomes enabled after changes', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Make a change via API (avoids flaky click/dblclick in Electron)
    const { setCellViaApi } = require('./helpers');
    await setCellViaApi(window, 0, 0, 'Change');
    const cell = window.locator('.cell[data-row="0"][data-col="0"]');
    await expect(cell).toHaveText('Change', { timeout: 5000 });

    // Wait for menu state to update
    await window.waitForTimeout(1000);

    // Check Save menu item is now enabled
    let saveEnabled = false;
    for (let i = 0; i < 10; i++) {
      saveEnabled = await electronApp.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        const saveItem = menu.getMenuItemById('save');
        return saveItem ? saveItem.enabled : false;
      });

      if (saveEnabled) break;
      await window.waitForTimeout(200);
    }

    expect(saveEnabled).toBe(true);

    console.log(
      '[Keyboard Shortcuts Test] Cmd+S correctly enabled after changes'
    );
  });

  test('ArrowUp at top row does not move selection', async ({ window }) => {
    // Select A1 (row 0) — pressing ArrowUp should be a no-op
    await window.locator('#cell-0-0').click();
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);
    await window.keyboard.press('ArrowUp');
    // Should still be on row 0
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/, {
      timeout: 1000,
    });
  });

  test('ArrowLeft at col 0 does not move selection', async ({ window }) => {
    await window.locator('#cell-0-0').click();
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);
    await window.keyboard.press('ArrowLeft');
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/, {
      timeout: 1000,
    });
  });

  test('Tab key moves selection to next cell', async ({ window }) => {
    const { setCellViaApi } = require('./helpers');
    await setCellViaApi(window, 0, 0, 'start');
    // Click cell A1 to select it
    await window.locator('#cell-0-0').click();
    await expect(window.locator('#cell-0-0')).toHaveClass(/selected/);

    // Press Tab — should move to B1
    await window.keyboard.press('Tab');
    await expect(window.locator('#cell-0-1')).toHaveClass(/selected/, {
      timeout: 2000,
    });
  });

  test('Enter key starts editing the selected cell', async ({ window }) => {
    const { setCellViaApi } = require('./helpers');
    await setCellViaApi(window, 1, 0, 'editable');
    await window.locator('#cell-1-0').click();
    await expect(window.locator('#cell-1-0')).toHaveClass(/selected/);

    // Press Enter — should open edit mode
    await window.keyboard.press('Enter');
    await expect(window.locator('.cell-editor')).toBeVisible({ timeout: 2000 });
    await window.keyboard.press('Escape');
    await expect(window.locator('.cell-editor')).toBeHidden();
  });

  test('F2 key starts editing the selected cell', async ({ window }) => {
    await window.locator('#cell-2-0').click();
    await expect(window.locator('#cell-2-0')).toHaveClass(/selected/);

    // Press F2 — should open edit mode
    await window.keyboard.press('F2');
    await expect(window.locator('.cell-editor')).toBeVisible({ timeout: 2000 });
    await window.keyboard.press('Escape');
    await expect(window.locator('.cell-editor')).toBeHidden();
  });

  test('Ctrl+Backslash clears formatting from selected cell', async ({
    window,
  }) => {
    const { setCellViaApi, setStyleViaApi } = require('./helpers');
    await setCellViaApi(window, 0, 2, 'styled');
    await setStyleViaApi(window, 0, 2, 0, 2, 1); // Title style
    await expect(window.locator('#cell-0-2')).toHaveClass(/style-title/);

    // Select the cell
    await window.locator('#cell-0-2').click();
    await expect(window.locator('#cell-0-2')).toHaveClass(/selected/);

    // Press Ctrl+\ — clears formatting
    await window.keyboard.press('Control+\\');
    await window.waitForFunction(
      () =>
        !document.getElementById('cell-0-2')?.classList.contains('style-title'),
      { timeout: 3000 }
    );
    await expect(window.locator('#cell-0-2')).not.toHaveClass(/style-title/);
  });

  test('Formula bar allows text editing shortcuts', async ({ window }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Focus formula bar and type
    const formulaBar = await window.locator('#formula-bar');
    await formulaBar.click();
    await formulaBar.fill('=SUM(A1:A10)');

    // Verify formula bar has the text
    const formulaText = await formulaBar.inputValue();
    expect(formulaText).toBe('=SUM(A1:A10)');

    // Use fill() to replace text (tests that formula bar is editable)
    await formulaBar.fill('=A1+A2');

    const newFormulaText = await formulaBar.inputValue();
    expect(newFormulaText).toBe('=A1+A2');

    console.log(
      '[Keyboard Shortcuts Test] Formula bar editing works correctly'
    );
  });

  test('All shortcuts use CmdOrCtrl for cross-platform compatibility', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Get all accelerators and verify they use CmdOrCtrl (not just Cmd or Ctrl)
    const allUseCmdOrCtrl = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const accelerators = [];

      menu.items.forEach((topLevelItem) => {
        if (topLevelItem.submenu) {
          topLevelItem.submenu.items.forEach((item) => {
            if (item.accelerator) {
              accelerators.push(item.accelerator);
            }
          });
        }
      });

      // Check all accelerators use CmdOrCtrl (not platform-specific Cmd or Ctrl)
      return accelerators.every(
        (acc) =>
          (!acc.includes('Cmd+') && !acc.includes('Ctrl+')) ||
          acc.includes('CmdOrCtrl')
      );
    });

    expect(allUseCmdOrCtrl).toBe(true);

    console.log(
      '[Keyboard Shortcuts Test] All shortcuts use CmdOrCtrl for cross-platform compatibility'
    );
  });
});
