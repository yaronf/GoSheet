// Story 7.10: Dark Mode Support Tests
// Test system preference detection and automatic theme switching

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

test.describe('Dark Mode Support', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    window = await electronApp.firstWindow();
    
    // Wait for app to be ready
    await window.waitForSelector('.spreadsheet', { timeout: 10000 });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('Dark mode is applied when system preference is dark', async () => {
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
      return window.getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary').trim();
    });
    
    expect(bgColor).toBe('#111827');
  });

  test('Light mode is applied when system preference is light', async () => {
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
      return window.getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary').trim();
    });
    
    expect(bgColor).toBe('#FFFFFF');
  });

  test('App switches theme when system preference changes', async () => {
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

  test('Dark mode colors are applied to UI elements', async () => {
    // Set to dark mode
    await electronApp.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark';
    });
    
    await window.waitForTimeout(200);
    
    // Check that dark mode CSS variables are active
    const colors = await window.evaluate(() => {
      const root = document.documentElement;
      return {
        bgPrimary: window.getComputedStyle(root).getPropertyValue('--color-bg-primary').trim(),
        bgSurface: window.getComputedStyle(root).getPropertyValue('--color-bg-surface').trim(),
        textPrimary: window.getComputedStyle(root).getPropertyValue('--color-text-primary').trim(),
        primary: window.getComputedStyle(root).getPropertyValue('--color-primary').trim()
      };
    });
    
    expect(colors.bgPrimary).toBe('#111827');
    expect(colors.bgSurface).toBe('#1F2937');
    expect(colors.textPrimary).toBe('#F9FAFB');
    expect(colors.primary).toBe('#14B8A6');
  });

  test('Light mode colors are applied to UI elements', async () => {
    // Set to light mode
    await electronApp.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light';
    });
    
    await window.waitForTimeout(200);
    
    // Check that light mode CSS variables are active
    const colors = await window.evaluate(() => {
      const root = document.documentElement;
      return {
        bgPrimary: window.getComputedStyle(root).getPropertyValue('--color-bg-primary').trim(),
        bgSurface: window.getComputedStyle(root).getPropertyValue('--color-bg-surface').trim(),
        textPrimary: window.getComputedStyle(root).getPropertyValue('--color-text-primary').trim(),
        primary: window.getComputedStyle(root).getPropertyValue('--color-primary').trim()
      };
    });
    
    expect(colors.bgPrimary).toBe('#FFFFFF');
    expect(colors.bgSurface).toBe('#F8F9FA');
    expect(colors.textPrimary).toBe('#1A1A1A');
    expect(colors.primary).toBe('#00A896');
  });
});
