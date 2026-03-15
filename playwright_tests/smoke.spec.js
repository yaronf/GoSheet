// Playwright Electron Smoke Test
// Story 5.1: Setup Playwright Electron Environment
// Story 8.2: Updated for welcome screen - app shows welcome first, then spreadsheet
// Purpose: Verify Electron app launches and basic UI is visible

const { test, expect } = require('./fixtures');

test.describe('Electron App Smoke Tests', () => {
  test('Electron app launches successfully', async ({
    electronApp,
    window,
  }) => {
    // Verify app launched
    expect(electronApp).toBeTruthy();

    // Verify window exists
    expect(window).toBeTruthy();

    // Verify window title
    const title = await window.title();
    expect(title).toContain('GoSheet');

    // Story 8.2: App shows welcome screen first
    const welcomeScreen = window.locator('#welcome-screen');
    await expect(welcomeScreen).toBeVisible({ timeout: 10000 });

    // Verify welcome screen has Create New Spreadsheet button
    const createBtn = window.locator('#welcome-btn-new');
    await expect(createBtn).toBeVisible();
    expect(await createBtn.textContent()).toContain('Create New Spreadsheet');

    // Click Create New to navigate to spreadsheet
    await createBtn.click();

    // Verify spreadsheet grid is visible after navigation
    const grid = window.locator('#spreadsheet');
    await expect(grid).toBeVisible({ timeout: 5000 });

    // Verify at least one cell is rendered
    const cell = window.locator('.cell').first();
    await expect(cell).toBeVisible();
  });

  test('App has expected UI elements', async ({ window }) => {
    // Story 8.2: Welcome screen shown first - navigate to spreadsheet
    const welcomeScreen = window.locator('#welcome-screen');
    await expect(welcomeScreen).toBeVisible({ timeout: 10000 });
    await window.locator('#welcome-btn-new').click();

    // Verify formula bar exists (in spreadsheet view)
    const formulaBar = window.locator('#formula-bar');
    await expect(formulaBar).toBeVisible({ timeout: 5000 });

    // Verify file status area exists
    const fileStatus = window.locator('#file-status');
    await expect(fileStatus).toBeVisible();

    // Verify toolbar buttons exist (Story 7.12: Icon buttons)
    const newButton = window.locator('#new-btn');
    await expect(newButton).toBeVisible();

    const loadButton = window.locator('#load-btn');
    await expect(loadButton).toBeVisible();

    const saveButton = window.locator('#save-btn');
    await expect(saveButton).toBeVisible();
  });
});
