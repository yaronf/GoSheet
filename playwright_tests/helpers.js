// Story 8.2: Shared test helpers for welcome screen navigation
// CSV modal, toolbar, spreadsheet grid are inside spreadsheet-view; navigate from welcome if needed

const { expect } = require('@playwright/test');

async function ensureSpreadsheetView(window) {
  const welcomeScreen = window.locator('#welcome-screen');
  if (await welcomeScreen.isVisible()) {
    await window.locator('#welcome-btn-new').click();
    await expect(window.locator('#spreadsheet')).toBeVisible({ timeout: 5000 });
  }
}

/** Wait for cell edit mode to be ready (cell-editor visible) before typing. Avoids first-char loss. */
async function waitForEditModeReady(window) {
  await expect(window.locator('.cell-editor')).toBeVisible({ timeout: 3000 });
}

/**
 * Edit a cell: click, dblclick, wait for edit mode, type, Enter.
 * Uses explicit waits instead of arbitrary timeouts.
 */
async function editCell(window, cell, text) {
  await cell.click();
  await cell.dblclick();
  await waitForEditModeReady(window);
  await window.keyboard.type(text);
  await window.keyboard.press('Enter');
}

/** Wait for Save button to become enabled (indicates unsaved changes). */
async function waitForSaveEnabled(window) {
  await expect(window.locator('#save-btn')).toBeEnabled({ timeout: 5000 });
}

module.exports = {
  ensureSpreadsheetView,
  waitForEditModeReady,
  editCell,
  waitForSaveEnabled,
};
