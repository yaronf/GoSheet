// Playwright Electron Smoke Test
// Story 5.1: Setup Playwright Electron Environment
// Purpose: Verify Electron app launches and basic UI is visible

const { test, expect } = require('./fixtures');

test.describe('Electron App Smoke Tests', () => {
  test('Electron app launches successfully', async ({ electronApp, window }) => {
    // Verify app launched
    expect(electronApp).toBeTruthy();
    console.log('[Smoke Test] Electron app launched');
    
    // Verify window exists
    expect(window).toBeTruthy();
    console.log('[Smoke Test] Window created');
    
    // Verify window title
    const title = await window.title();
    expect(title).toContain('GoSheet');
    console.log(`[Smoke Test] Window title: ${title}`);
    
    // Verify grid is visible (correct element ID is 'spreadsheet', not 'spreadsheet-grid')
    const grid = await window.locator('#spreadsheet');
    await expect(grid).toBeVisible({ timeout: 10000 });
    console.log('[Smoke Test] Spreadsheet grid is visible');
    
    // Verify at least one cell is rendered
    const cell = await window.locator('.cell').first();
    await expect(cell).toBeVisible();
    console.log('[Smoke Test] Cell elements are rendered');
  });
  
  test('App has expected UI elements', async ({ window }) => {
    // Verify formula bar exists
    const formulaBar = await window.locator('#formula-bar');
    await expect(formulaBar).toBeVisible();
    console.log('[Smoke Test] Formula bar is visible');
    
    // Verify file status area exists
    const fileStatus = await window.locator('#file-status');
    await expect(fileStatus).toBeVisible();
    console.log('[Smoke Test] File status is visible');
    
    // Verify buttons exist
    const newButton = await window.locator('button:has-text("New")');
    await expect(newButton).toBeVisible();
    console.log('[Smoke Test] New button is visible');
    
    const loadButton = await window.locator('button:has-text("Load")');
    await expect(loadButton).toBeVisible();
    console.log('[Smoke Test] Load button is visible');
    
    const saveButton = await window.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
    console.log('[Smoke Test] Save button is visible');
  });
});
