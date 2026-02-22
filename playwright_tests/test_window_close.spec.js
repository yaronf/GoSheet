// Story 8.4: Window Close Behavior Tests
// Verifies Close Window menu config and that close handler quits app (Story 7.11)
// NODE_ENV=test: handler skips dialog and quits immediately

const { test, expect } = require('./fixtures');

test.describe('Window Close Behavior (Story 8.4)', () => {
  test('Close Window menu item exists with correct accelerator', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');
    await expect(window.locator('#app')).toBeVisible({ timeout: 10000 });

    const closeItem = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const close = menu.getMenuItemById('close');
      return close
        ? { exists: true, accelerator: close.accelerator, role: close.role }
        : { exists: false };
    });

    expect(closeItem.exists).toBe(true);
    expect(closeItem.accelerator).toMatch(/CmdOrCtrl\+W/);
    expect(closeItem.role).toBe('close');
  });

  test('Programmatic window close triggers handler and app exits', async ({
    electronApp,
    window,
  }) => {
    await window.waitForLoadState('domcontentloaded');
    await expect(window.locator('#app')).toBeVisible({ timeout: 10000 });

    // Close via main process - triggers mainWindow.on('close'); in test mode, handler quits
    const closePromise = window.waitForEvent('close', { timeout: 5000 });
    await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      if (wins.length > 0) wins[0].close();
    });
    await closePromise;

    expect(electronApp.windows().length).toBe(0);
  });

  test('app.quit from main process exits cleanly', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded');
    await expect(window.locator('#app')).toBeVisible({ timeout: 10000 });

    // Same path as Close/Quit: before-quit runs ensureRecentFilesSaved, cleanup
    const closePromise = window.waitForEvent('close', { timeout: 5000 });
    await electronApp.evaluate(({ app }) => app.quit());
    await closePromise;

    expect(electronApp.windows().length).toBe(0);
  });
});
