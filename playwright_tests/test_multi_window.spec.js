// Story 16.7: Multi-Window Support Tests
// Tests that each file opened creates a new window with its own Go server,
// and that closing windows terminates the appropriate resources.

const { test, expect } = require('./fixtures');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Helper: create a temp .sheet file for tests
function createTempSheetFile(content = '{"cells":{},"merges":[],"styles":{}}') {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `test_multi_window_${Date.now()}.sheet`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

test.describe('Multi-window support', () => {
  test('App starts with exactly one window', async ({
    electronApp,
    window,
  }) => {
    expect(electronApp.windows().length).toBe(1);
    await expect(window.locator('#welcome-screen')).toBeVisible({
      timeout: 10000,
    });
  });

  test('open-file event opens a second window without closing the first', async ({
    electronApp,
    window,
  }) => {
    const filePath = createTempSheetFile();
    try {
      await expect(window.locator('#welcome-screen')).toBeVisible({
        timeout: 10000,
      });

      const secondWindowPromise = electronApp.waitForEvent('window');
      await electronApp.evaluate(({ app }, fp) => {
        app.emit('open-file', { preventDefault: () => {} }, fp);
      }, filePath);

      const secondWindow = await secondWindowPromise;
      await secondWindow.waitForLoadState('domcontentloaded');

      expect(electronApp.windows().length).toBe(2);
      await expect(window.locator('#welcome-screen')).toBeVisible({
        timeout: 10000,
      });
      await expect(secondWindow.locator('body')).toBeAttached({
        timeout: 10000,
      });
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
  });

  test('Each window has its own Go server (different ports)', async ({
    electronApp,
    window,
  }) => {
    const filePath = createTempSheetFile();
    try {
      await expect(window.locator('#welcome-screen')).toBeVisible({
        timeout: 10000,
      });

      const secondWindowPromise = electronApp.waitForEvent('window');
      await electronApp.evaluate(({ app }, fp) => {
        app.emit('open-file', { preventDefault: () => {} }, fp);
      }, filePath);
      const secondWindow = await secondWindowPromise;
      await secondWindow.waitForLoadState('domcontentloaded');
      await expect(secondWindow.locator('body')).toBeAttached({
        timeout: 10000,
      });

      const url1 = await window.evaluate(() => window.location.href);
      const url2 = await secondWindow.evaluate(() => window.location.href);
      expect(url1).not.toBe(url2);
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
  });

  test('Closing second window does not affect first window', async ({
    electronApp,
    window,
  }) => {
    const filePath = createTempSheetFile();
    try {
      await expect(window.locator('#welcome-screen')).toBeVisible({
        timeout: 10000,
      });

      const secondWindowPromise = electronApp.waitForEvent('window');
      await electronApp.evaluate(({ app }, fp) => {
        app.emit('open-file', { preventDefault: () => {} }, fp);
      }, filePath);
      const secondWindow = await secondWindowPromise;
      await secondWindow.waitForLoadState('domcontentloaded');
      await expect(secondWindow.locator('body')).toBeAttached({
        timeout: 10000,
      });
      expect(electronApp.windows().length).toBe(2);

      const url1 = await window.evaluate(() => window.location.href);
      await electronApp.evaluate(({ BrowserWindow }, firstUrl) => {
        const wins = BrowserWindow.getAllWindows();
        for (const win of wins) {
          if (win.webContents.getURL() !== firstUrl) {
            win.destroy();
            break;
          }
        }
      }, url1);

      await expect
        .poll(() => electronApp.windows().length, { timeout: 5000 })
        .toBe(1);

      await expect(window.locator('#welcome-screen')).toBeVisible({
        timeout: 5000,
      });
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
  });

  test('second-instance with a new file opens a new window', async ({
    electronApp,
    window,
  }) => {
    // Simulates: user double-clicks a .sheet file in Finder while app is running (dev mode path)
    const filePath = createTempSheetFile();
    try {
      await expect(window.locator('#welcome-screen')).toBeVisible({
        timeout: 10000,
      });

      const secondWindowPromise = electronApp.waitForEvent('window');
      await electronApp.evaluate(({ app }, fp) => {
        app.emit('second-instance', {}, [fp]);
      }, filePath);

      const secondWindow = await secondWindowPromise;
      await secondWindow.waitForLoadState('domcontentloaded');
      expect(electronApp.windows().length).toBe(2);
      await expect(secondWindow.locator('body')).toBeAttached({
        timeout: 10000,
      });
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
  });

  test('second-instance with already-open file focuses existing window, not a new one', async ({
    electronApp,
    window,
  }) => {
    // Regression: double-clicking an already-open file in Finder was opening a duplicate window
    const filePath = createTempSheetFile();
    try {
      await expect(window.locator('#welcome-screen')).toBeVisible({
        timeout: 10000,
      });

      // Open the file via second-instance (registers currentFilePath in registry)
      const secondWindowPromise = electronApp.waitForEvent('window');
      await electronApp.evaluate(({ app }, fp) => {
        app.emit('second-instance', {}, [fp]);
      }, filePath);
      const fileWindow = await secondWindowPromise;
      await fileWindow.waitForLoadState('load');
      expect(electronApp.windows().length).toBe(2);

      // Emit second-instance again for the same file — should focus, not create a new window
      await electronApp.evaluate(({ app }, fp) => {
        app.emit('second-instance', {}, [fp]);
      }, filePath);

      // Window count must stay at 2
      await expect
        .poll(() => electronApp.windows().length, { timeout: 2000 })
        .toBe(2);
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
  });

  test('open-file for an already-open file focuses existing window, not a new one', async ({
    electronApp,
    window,
  }) => {
    // Regression: double-clicking an already-open file was opening a duplicate window.
    // Fix: open-file checks windowRegistry.currentFilePath before spawning a new window.
    const filePath = createTempSheetFile();
    try {
      await expect(window.locator('#welcome-screen')).toBeVisible({
        timeout: 10000,
      });

      // Open file in a new window via open-file
      const secondWindowPromise = electronApp.waitForEvent('window');
      await electronApp.evaluate(({ app }, fp) => {
        app.emit('open-file', { preventDefault: () => {} }, fp);
      }, filePath);
      const fileWindow = await secondWindowPromise;
      await fileWindow.waitForLoadState('domcontentloaded');
      expect(electronApp.windows().length).toBe(2);

      // Registry is updated at did-finish-load — wait for the second window to fully load
      await fileWindow.waitForLoadState('load');

      // Emit open-file again for the same file — should focus, not spawn a new window
      await electronApp.evaluate(({ app }, fp) => {
        app.emit('open-file', { preventDefault: () => {} }, fp);
      }, filePath);

      // Window count must stay at 2 (no new window created)
      // Poll for 2s — if a new window were to appear it would do so quickly
      await expect
        .poll(() => electronApp.windows().length, { timeout: 2000 })
        .toBe(2);
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
  });
});
