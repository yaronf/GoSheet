// Story 7.3: Help Menu Tests
// Tests for Help menu and About dialog functionality
// Story 8.2: Navigate from welcome screen before testing

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView } = require('./helpers');

test.describe('Help Menu Tests', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('Help menu exists with About item', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded');

    // Wait for grid to be visible
    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Poll for Help menu to be fully populated
    let helpMenuItems = [];
    for (let i = 0; i < 20; i++) {
      helpMenuItems = await electronApp.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        const helpMenu = menu.items.find((item) => item.label === 'Help');

        if (!helpMenu) return [];

        return helpMenu.submenu.items.map((item) => ({
          label: item.label,
          id: item.id,
        }));
      });

      if (helpMenuItems.length >= 1) {
        break;
      }

      await window.waitForTimeout(100);
    }

    console.log(
      '[Help Menu Test] Found',
      helpMenuItems.length,
      'Help menu items'
    );

    // Verify menu structure
    expect(helpMenuItems.length).toBeGreaterThanOrEqual(1);

    // Check for About GoSheet
    const aboutItem = helpMenuItems.find(
      (item) => item.label === 'About GoSheet'
    );
    expect(aboutItem).toBeTruthy();
    expect(aboutItem.id).toBe('about');

    console.log('[Help Menu Test] Help menu structure verified');
  });

  test('Help menu exists', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Check that Help menu exists (role: 'help' removed to allow custom submenu items to receive clicks)
    const hasHelpMenu = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const helpMenu = menu.items.find((item) => item.label === 'Help');
      return !!helpMenu;
    });

    expect(hasHelpMenu).toBe(true);
    console.log('[Help Menu Test] Help menu exists');
  });

  test('About item has correct ID', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Poll for menu to be ready
    let hasAboutId = false;
    for (let i = 0; i < 20; i++) {
      hasAboutId = await electronApp.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        if (!menu) return false;

        const aboutItem = menu.getMenuItemById('about');
        return !!aboutItem;
      });

      if (hasAboutId) break;
      await window.waitForTimeout(100);
    }

    expect(hasAboutId).toBe(true);
    console.log('[Help Menu Test] About item has correct ID');
  });

  test('App version is available', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Get app version
    const version = await electronApp.evaluate(({ app }) => {
      return app.getVersion();
    });

    expect(version).toBeTruthy();
    expect(version).toMatch(/^\d+\.\d+\.\d+/); // Semantic versioning format

    console.log('[Help Menu Test] App version:', version);
  });

  test('About panel options are configured', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');

    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible();

    // Verify About panel can be shown (we can't easily test the actual panel appearance)
    // But we can verify the menu item exists and is clickable
    const aboutItemExists = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const helpMenu = menu.items.find((item) => item.label === 'Help');
      const aboutItem = helpMenu?.submenu?.items.find(
        (item) => item.label === 'About GoSheet'
      );

      return {
        exists: !!aboutItem,
        hasClick: typeof aboutItem?.click === 'function',
      };
    });

    expect(aboutItemExists.exists).toBe(true);
    expect(aboutItemExists.hasClick).toBe(true);

    console.log('[Help Menu Test] About panel is configured and clickable');
  });
});
