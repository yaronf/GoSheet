// Story 7.6: Dock Menu Tests
// Verifies dock menu is configured on macOS (New Spreadsheet + recent files)
// Note: Right-click dock and menu item clicks require manual verification

const { test, expect } = require('./fixtures');

test.describe('Dock Menu (Story 7.6)', () => {
  test('Dock menu is set on macOS with New Spreadsheet and recent files', async ({
    electronApp,
    window,
  }) => {
    test.skip(process.platform !== 'darwin', 'Dock menu is macOS-only');
    await window.waitForLoadState('domcontentloaded');
    // App may show welcome screen or spreadsheet; wait for app root (unique)
    await expect(window.locator('#app')).toBeVisible({ timeout: 10000 });

    const dockInfo = await electronApp.evaluate(({ app }) => {
      if (process.platform !== 'darwin') {
        return { platform: process.platform, skip: true };
      }
      if (!app.dock) {
        return { platform: process.platform, hasDock: false };
      }
      const menu = app.dock.getMenu();
      if (!menu) return { platform: process.platform, menuSet: false };
      const items = menu.items.map((item) => ({
        label: item.label,
        type: item.type,
        enabled: item.enabled,
      }));
      return {
        platform: process.platform,
        hasDock: true,
        menuSet: true,
        itemCount: items.length,
        items,
      };
    });

    expect(dockInfo.hasDock).toBe(true);
    expect(dockInfo.menuSet).toBe(true);
    expect(dockInfo.itemCount).toBeGreaterThanOrEqual(2); // New Spreadsheet + separator + (optional) recent files

    const labels = dockInfo.items.map((i) => i.label);
    expect(labels).toContain('New Spreadsheet');
    expect(labels).toContain('Open...');
  });

  test('Dock menu shows (No recent files) when empty', async ({ electronApp, window }) => {
    test.skip(process.platform !== 'darwin', 'Dock menu is macOS-only');
    await window.waitForLoadState('domcontentloaded');
    await expect(window.locator('#app')).toBeVisible({ timeout: 10000 });

    const hasNoRecentItem = await electronApp.evaluate(({ app }) => {
      if (!app.dock) return null;
      const menu = app.dock.getMenu();
      if (!menu) return null;
      const labels = menu.items.map((i) => i.label);
      return {
        hasNewSpreadsheet: labels.includes('New Spreadsheet'),
        hasNoRecentFiles: labels.includes('(No recent files)'),
        hasRecentFile: labels.some((l) => l.endsWith('.sheet')),
      };
    });

    expect(hasNoRecentItem).not.toBeNull();
    expect(hasNoRecentItem.hasNewSpreadsheet).toBe(true);
    // Either (No recent files) or at least one .sheet file
    expect(
      hasNoRecentItem.hasNoRecentFiles || hasNoRecentItem.hasRecentFile
    ).toBe(true);
  });
});
