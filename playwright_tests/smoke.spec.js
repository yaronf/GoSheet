// Playwright Electron Smoke Test
// Story 5.1: Setup Playwright Electron Environment
// Story 8.2: Updated for welcome screen - app shows welcome first, then spreadsheet
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

    // Story 8.2: App shows welcome screen first
    const welcomeScreen = window.locator('#welcome-screen');
    await expect(welcomeScreen).toBeVisible({ timeout: 10000 });
    console.log('[Smoke Test] Welcome screen is visible');

    // Verify welcome screen has Create New Spreadsheet button
    const createBtn = window.locator('#welcome-btn-new');
    await expect(createBtn).toBeVisible();
    expect(await createBtn.textContent()).toContain('Create New Spreadsheet');
    console.log('[Smoke Test] Create New Spreadsheet button is visible');

    // Click Create New to navigate to spreadsheet
    await createBtn.click();

    // Verify spreadsheet grid is visible after navigation
    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible({ timeout: 5000 });
    console.log('[Smoke Test] Spreadsheet grid is visible');

    // Verify at least one cell is rendered
    const cell = window.locator('.cell').first();
    await expect(cell).toBeVisible();
    console.log('[Smoke Test] Cell elements are rendered');
  });

  test('App has expected UI elements', async ({ window }) => {
    // Story 8.2: Welcome screen shown first - navigate to spreadsheet
    const welcomeScreen = window.locator('#welcome-screen');
    await expect(welcomeScreen).toBeVisible({ timeout: 10000 });
    await window.locator('#welcome-btn-new').click();

    // Verify formula bar exists (in spreadsheet view)
    const formulaBar = window.locator('#formula-bar');
    await expect(formulaBar).toBeVisible({ timeout: 5000 });
    console.log('[Smoke Test] Formula bar is visible');

    // Verify file status area exists
    const fileStatus = window.locator('#file-status');
    await expect(fileStatus).toBeVisible();
    console.log('[Smoke Test] File status is visible');

    // Verify toolbar buttons exist (Story 7.12: Icon buttons)
    const newButton = window.locator('#new-btn');
    await expect(newButton).toBeVisible();
    console.log('[Smoke Test] New button is visible');

    const loadButton = window.locator('#load-btn');
    await expect(loadButton).toBeVisible();
    console.log('[Smoke Test] Load button is visible');

    const saveButton = window.locator('#save-btn');
    await expect(saveButton).toBeVisible();
    console.log('[Smoke Test] Save button is visible');
  });
});
