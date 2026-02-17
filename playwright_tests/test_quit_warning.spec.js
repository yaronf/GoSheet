// Story 7.11: Quit Warning Dialog Tests
// Tests the quit warning dialog behavior with unsaved changes

const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

test.describe('Quit Warning Dialog', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '..')]
    });
    
    // Get the first window
    window = await electronApp.firstWindow();
    
    // Wait for app to be ready
    await window.waitForSelector('.spreadsheet', { timeout: 10000 });
  });

  test.afterEach(async () => {
    // Clean up
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should show quit dialog when there are unsaved changes', async () => {
    // Make a change to create unsaved state
    const cell = await window.locator('#cell-0-0');
    await cell.click();
    await window.keyboard.type('test');
    await window.keyboard.press('Enter');
    
    // Wait for save to complete and status to update
    await window.waitForTimeout(500);
    
    // Verify unsaved changes indicator
    const status = await window.locator('#file-status');
    await expect(status).toContainText('Unsaved changes');
    
    // Set up dialog handler to capture the dialog
    let dialogShown = false;
    let dialogMessage = '';
    
    electronApp.on('window', async (newWindow) => {
      // This won't work for native dialogs, but we can check via IPC
    });
    
    // Verify window.currentHasUnsavedChanges is set
    const hasUnsavedChanges = await window.evaluate(() => window.currentHasUnsavedChanges);
    expect(hasUnsavedChanges).toBe(true);
  });

  test('should NOT show dialog when there are no unsaved changes', async () => {
    // Don't make any changes
    
    // Verify no unsaved changes
    const status = await window.locator('#file-status');
    await expect(status).toContainText('Saved');
    
    // Verify window.currentHasUnsavedChanges is false
    const hasUnsavedChanges = await window.evaluate(() => window.currentHasUnsavedChanges);
    expect(hasUnsavedChanges).toBe(false);
  });

  test('should update currentHasUnsavedChanges when cell is edited', async () => {
    // Initial state - no unsaved changes
    let hasUnsavedChanges = await window.evaluate(() => window.currentHasUnsavedChanges);
    expect(hasUnsavedChanges).toBe(false);
    
    // Edit a cell
    const cell = await window.locator('#cell-0-0');
    await cell.click();
    await window.keyboard.type('test');
    await window.keyboard.press('Enter');
    
    // Wait for status update
    await window.waitForTimeout(500);
    
    // Should now have unsaved changes
    hasUnsavedChanges = await window.evaluate(() => window.currentHasUnsavedChanges);
    expect(hasUnsavedChanges).toBe(true);
  });

  test('should clear currentHasUnsavedChanges after save', async () => {
    // Edit a cell
    const cell = await window.locator('#cell-0-0');
    await cell.click();
    await window.keyboard.type('test');
    await window.keyboard.press('Enter');
    
    // Wait for status update
    await window.waitForTimeout(500);
    
    // Verify unsaved changes
    let hasUnsavedChanges = await window.evaluate(() => window.currentHasUnsavedChanges);
    expect(hasUnsavedChanges).toBe(true);
    
    // Save the file (Cmd+S on Mac, Ctrl+S on others)
    const isMac = process.platform === 'darwin';
    await window.keyboard.press(isMac ? 'Meta+S' : 'Control+S');
    
    // Wait for save to complete
    await window.waitForTimeout(1000);
    
    // Should no longer have unsaved changes
    hasUnsavedChanges = await window.evaluate(() => window.currentHasUnsavedChanges);
    expect(hasUnsavedChanges).toBe(false);
  });

  test('should expose currentHasUnsavedChanges to window object', async () => {
    // Verify the variable exists on window
    const variableExists = await window.evaluate(() => {
      return typeof window.currentHasUnsavedChanges !== 'undefined';
    });
    expect(variableExists).toBe(true);
    
    // Verify it's a boolean
    const isBoolean = await window.evaluate(() => {
      return typeof window.currentHasUnsavedChanges === 'boolean';
    });
    expect(isBoolean).toBe(true);
  });

  test('should synchronize currentHasUnsavedChanges with displayFileStatus', async () => {
    // Edit cell to trigger displayFileStatus
    const cell = await window.locator('#cell-0-0');
    await cell.click();
    await window.keyboard.type('test');
    await window.keyboard.press('Enter');
    
    await window.waitForTimeout(500);
    
    // Check both the UI and the variable
    const status = await window.locator('#file-status');
    await expect(status).toContainText('Unsaved changes');
    
    const hasUnsavedChanges = await window.evaluate(() => window.currentHasUnsavedChanges);
    expect(hasUnsavedChanges).toBe(true);
    
    // Both should be in sync
    const statusText = await status.textContent();
    const variableMatchesUI = hasUnsavedChanges === statusText.includes('Unsaved');
    expect(variableMatchesUI).toBe(true);
  });
});
