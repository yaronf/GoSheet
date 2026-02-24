// Story 7.10: Dark Mode Support Tests
// Test system preference detection and automatic theme switching
// Story 8.2: Navigate from welcome screen before checking theme (spreadsheet view)

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView } = require('./helpers');

test.describe('Dark Mode Support', () => {
  test('Dark mode is applied when system preference is dark', async ({
    electronApp,
    window,
  }) => {
    await ensureSpreadsheetView(window);

    // Set system to dark mode
    await electronApp.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark';
      return nativeTheme.shouldUseDarkColors;
    });

    // Wait for theme to be applied
    await window.waitForTimeout(200);

    // Check HTML attribute
    const theme = await window.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    expect(theme).toBe('dark');

    // Verify dark mode background color is applied
    const bgColor = await window.evaluate(() => {
      return window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('--color-bg-primary')
        .trim();
    });

    expect(bgColor).toBe('#111827');
  });

  test('Light mode is applied when system preference is light', async ({
    electronApp,
    window,
  }) => {
    await ensureSpreadsheetView(window);

    // Set system to light mode
    await electronApp.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light';
      return nativeTheme.shouldUseDarkColors;
    });

    // Wait for theme to be applied
    await window.waitForTimeout(200);

    // Check HTML attribute
    const theme = await window.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    expect(theme).toBe('light');

    // Verify light mode background color is applied
    const bgColor = await window.evaluate(() => {
      return window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('--color-bg-primary')
        .trim();
    });

    expect(bgColor).toBe('#FFFFFF');
  });

  test('App switches theme when system preference changes', async ({
    electronApp,
    window,
  }) => {
    await ensureSpreadsheetView(window);

    // Start in light mode
    await electronApp.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light';
    });

    await window.waitForTimeout(200);

    let theme = await window.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(theme).toBe('light');

    // Switch to dark mode
    await electronApp.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark';
    });

    await window.waitForTimeout(200);

    theme = await window.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(theme).toBe('dark');

    // Switch back to light mode
    await electronApp.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light';
    });

    await window.waitForTimeout(200);

    theme = await window.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(theme).toBe('light');
  });

  test('Dark mode colors are applied to UI elements', async ({
    electronApp,
    window,
  }) => {
    await ensureSpreadsheetView(window);

    // Set to dark mode
    await electronApp.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark';
    });

    await window.waitForTimeout(200);

    // Check that dark mode CSS variables are active
    const colors = await window.evaluate(() => {
      const root = document.documentElement;
      return {
        bgPrimary: window
          .getComputedStyle(root)
          .getPropertyValue('--color-bg-primary')
          .trim(),
        bgSurface: window
          .getComputedStyle(root)
          .getPropertyValue('--color-bg-surface')
          .trim(),
        textPrimary: window
          .getComputedStyle(root)
          .getPropertyValue('--color-text-primary')
          .trim(),
        primary: window
          .getComputedStyle(root)
          .getPropertyValue('--color-primary')
          .trim(),
      };
    });

    expect(colors.bgPrimary).toBe('#111827');
    expect(colors.bgSurface).toBe('#1F2937');
    expect(colors.textPrimary).toBe('#F9FAFB');
    expect(colors.primary).toBe('#14B8A6');
  });

  test('Light mode colors are applied to UI elements', async ({
    electronApp,
    window,
  }) => {
    await ensureSpreadsheetView(window);

    // Set to light mode
    await electronApp.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light';
    });

    await window.waitForTimeout(200);

    // Check that light mode CSS variables are active
    const colors = await window.evaluate(() => {
      const root = document.documentElement;
      return {
        bgPrimary: window
          .getComputedStyle(root)
          .getPropertyValue('--color-bg-primary')
          .trim(),
        bgSurface: window
          .getComputedStyle(root)
          .getPropertyValue('--color-bg-surface')
          .trim(),
        textPrimary: window
          .getComputedStyle(root)
          .getPropertyValue('--color-text-primary')
          .trim(),
        primary: window
          .getComputedStyle(root)
          .getPropertyValue('--color-primary')
          .trim(),
      };
    });

    expect(colors.bgPrimary).toBe('#FFFFFF');
    expect(colors.bgSurface).toBe('#F8F9FA');
    expect(colors.textPrimary).toBe('#1A1A1A');
    expect(colors.primary).toBe('#00A896');
  });
});
