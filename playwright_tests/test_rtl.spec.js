// Story 13.10: RTL mode support

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

test.describe('RTL Mode (Story 13.10)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    // Ensure LTR baseline by calling setRTL(false)
    await window.evaluate(async () => {
      await window.setRTL(false);
    });
  });

  test.afterEach(async ({ window }) => {
    // Reset RTL off
    await window.evaluate(async () => {
      await window.setRTL(false);
    });
  });

  test('enabling RTL sets dir="rtl" on html element', async ({ window }) => {
    await window.evaluate(async () => {
      await window.setRTL(true);
    });
    const dir = await window.evaluate(() =>
      document.documentElement.getAttribute('dir')
    );
    expect(dir).toBe('rtl');
  });

  test('disabling RTL removes dir attribute (back to LTR)', async ({
    window,
  }) => {
    await window.evaluate(async () => {
      await window.setRTL(true);
    });
    await window.evaluate(async () => {
      await window.setRTL(false);
    });
    const dir = await window.evaluate(() =>
      document.documentElement.getAttribute('dir')
    );
    expect(dir).toBeNull();
  });

  test('with RTL enabled, cell default text-align is right (CSS)', async ({
    window,
  }) => {
    await window.evaluate(async () => {
      await window.setRTL(true);
    });
    const cell = window.locator('#cell-0-0');
    await expect(cell).toBeVisible();
    const computedAlign = await cell.evaluate(
      (el) => getComputedStyle(el).textAlign
    );
    expect(computedAlign).toBe('right');
  });

  test('with RTL enabled, formula bar has direction rtl', async ({
    window,
  }) => {
    await window.evaluate(async () => {
      await window.setRTL(true);
    });
    const formulaBar = window.locator('#formula-bar');
    await expect(formulaBar).toBeVisible();
    const direction = await formulaBar.evaluate(
      (el) => getComputedStyle(el).direction
    );
    expect(direction).toBe('rtl');
  });

  test('RTL persists — startup restore applies dir (AC4)', async ({
    window,
  }) => {
    // Enable RTL and persist via setRTL
    await window.evaluate(async () => {
      await window.setRTL(true);
    });
    // Simulate app startup restore: call GetSettings() and apply as the IIFE does
    await window.evaluate(async () => {
      const settings = await window.electronAPI.getSettings();
      // Reset DOM to simulate fresh load
      document.documentElement.removeAttribute('dir');
      window.isRTL = false;
      // Re-apply startup logic
      if (settings.rtl) {
        window.isRTL = true;
        document.documentElement.setAttribute('dir', 'rtl');
      }
    });
    const dir = await window.evaluate(() =>
      document.documentElement.getAttribute('dir')
    );
    expect(dir).toBe('rtl');
    // Cleanup: disable RTL in settings
    await window.evaluate(async () => {
      await window.electronAPI.setSetting('rtl', false);
    });
  });

  test('explicit cell-level alignment overrides RTL default text-align (L3)', async ({
    window,
  }) => {
    // Enable RTL — cells default to text-align:right
    await window.evaluate(async () => {
      await window.setRTL(true);
    });
    await setCellViaApi(window, 0, 0, 'hello');
    // Apply explicit left alignment via API
    await window.evaluate(async () => {
      await fetch('/api/cell/alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: 0, col: 0, alignment: 'left' }),
      });
      if (typeof window.refreshAllCells === 'function')
        await window.refreshAllCells();
    });
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('hello');
    // Inline style should be 'left', overriding the RTL CSS rule
    const textAlign = await cell.evaluate((el) => el.style.textAlign);
    expect(textAlign).toBe('left');
    // Cleanup
    await window.evaluate(async () => {
      await fetch('/api/cell/alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: 0, col: 0, alignment: '' }),
      });
    });
    await setCellViaApi(window, 0, 0, '');
  });
});
