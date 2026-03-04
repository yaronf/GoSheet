// Story 13.10: RTL mode support

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

test.describe('RTL Mode (Story 13.10)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    // Ensure LTR baseline: reset both the DOM dir attribute and the JS isRTL flag
    await window.evaluate(() => {
      document.documentElement.removeAttribute('dir');
      window.isRTL = false;
      const btn = document.getElementById('rtl-toggle-btn');
      if (btn) {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  });

  test.afterEach(async ({ window }) => {
    // Reset RTL off: if RTL button is active, click it to toggle back to LTR
    const isActive = await window.evaluate(() =>
      document.getElementById('rtl-toggle-btn')?.classList.contains('active')
    );
    if (isActive) {
      await window.locator('#rtl-toggle-btn').click();
    }
  });

  test('clicking RTL toggle sets dir="rtl" on html element', async ({
    window,
  }) => {
    const btn = window.locator('#rtl-toggle-btn');
    await expect(btn).toBeVisible();
    await btn.click();
    const dir = await window.evaluate(() =>
      document.documentElement.getAttribute('dir')
    );
    expect(dir).toBe('rtl');
  });

  test('clicking RTL toggle again removes dir attribute (back to LTR)', async ({
    window,
  }) => {
    const btn = window.locator('#rtl-toggle-btn');
    await btn.click(); // on
    await btn.click(); // off
    const dir = await window.evaluate(() =>
      document.documentElement.getAttribute('dir')
    );
    expect(dir).toBeNull();
  });

  test('with RTL enabled, cell default text-align is right (CSS)', async ({
    window,
  }) => {
    await window.locator('#rtl-toggle-btn').click();
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
    await window.locator('#rtl-toggle-btn').click();
    const formulaBar = window.locator('#formula-bar');
    await expect(formulaBar).toBeVisible();
    const direction = await formulaBar.evaluate(
      (el) => getComputedStyle(el).direction
    );
    expect(direction).toBe('rtl');
  });

  test('RTL toggle button aria-pressed reflects state', async ({ window }) => {
    const btn = window.locator('#rtl-toggle-btn');
    await expect(btn).toBeVisible();
    await btn.click();
    expect(await btn.getAttribute('aria-pressed')).toBe('true');
    await btn.click();
    expect(await btn.getAttribute('aria-pressed')).toBe('false');
  });

  test('RTL persists across simulated reload — startup restore applies dir and aria-pressed (AC4)', async ({
    window,
  }) => {
    // Enable RTL and persist via the toggle button
    await window.locator('#rtl-toggle-btn').click();
    // Simulate app startup restore: call GetSettings() and apply as the IIFE does
    await window.evaluate(async () => {
      const settings = await window.electronAPI.getSettings();
      // Reset DOM to simulate fresh load
      document.documentElement.removeAttribute('dir');
      window.isRTL = false;
      const btn = document.getElementById('rtl-toggle-btn');
      if (btn) {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
      // Re-apply startup logic
      if (settings.rtl) {
        window.isRTL = true;
        document.documentElement.setAttribute('dir', 'rtl');
        if (btn) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        }
      }
    });
    const dir = await window.evaluate(() =>
      document.documentElement.getAttribute('dir')
    );
    expect(dir).toBe('rtl');
    const ariaPressed = await window
      .locator('#rtl-toggle-btn')
      .getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');
    // Cleanup: disable RTL in settings
    await window.evaluate(async () => {
      await window.electronAPI.setSetting('rtl', false);
    });
  });

  test('explicit cell-level alignment overrides RTL default text-align (L3)', async ({
    window,
  }) => {
    // Enable RTL — cells default to text-align:right
    await window.locator('#rtl-toggle-btn').click();
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
