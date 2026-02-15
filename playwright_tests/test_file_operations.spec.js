// Playwright Electron File Operation Tests
// Story 5.4: Create File Operation Tests
// End-to-end tests for New, Open, Save workflows

const { test, expect } = require('./fixtures');
const eph = require('electron-playwright-helpers');
const fs = require('fs');
const path = require('path');
const os = require('os');

test.describe('File Operation Tests', () => {
  
  // Helper: Clean up test file
  function cleanupTestFile(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  test('New spreadsheet workflow', async ({ electronApp, window }) => {
    await window.waitForTimeout(500);
    
    // Enter data in a cell to trigger unsaved state
    const cell = window.locator('#cell-5-5');
    await cell.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('999');
    await window.keyboard.press('Enter');
    
    // Wait for status to show "Unsaved"
    const status = window.locator('#file-status');
    await expect(status).toContainText('Unsaved', { timeout: 5000 });
    
    // Click New button
    await window.locator('#new-btn').click();
    await window.waitForTimeout(300);
    
    // Modal should appear asking about unsaved changes
    const modal = window.locator('#modal-overlay');
    await expect(modal).toBeVisible();
    
    // Click OK in modal
    await window.locator('#modal-ok').click();
    await window.waitForTimeout(500);
    
    // Modal should close
    await expect(modal).not.toBeVisible();
    
    // Verify grid is cleared (cell should be empty)
    await expect(window.locator('#cell-5-5')).toHaveText('');
    
    // Verify status shows "Saved" (new empty spreadsheet has no unsaved changes)
    await expect(status).toContainText('Saved');
  });

  test('Open file workflow', async ({ electronApp, window }) => {
    await window.waitForTimeout(500);
    
    const testFilePath = path.join(os.tmpdir(), 'test-open.sheet');
    
    try {
      // First, create a test file by entering data and saving it
      // Enter data in cells A1, B1, C1
      const cellA1 = window.locator('#cell-0-0');
      await cellA1.click();
      await window.waitForTimeout(200);
      await window.keyboard.type('100');
      await window.keyboard.press('Enter');
      await window.waitForTimeout(300);
      
      // Click B1 (row 0, col 1)
      const cellB1 = window.locator('#cell-0-1');
      await cellB1.click();
      await window.waitForTimeout(200);
      await window.keyboard.type('200');
      await window.keyboard.press('Enter');
      await window.waitForTimeout(300);
      
      // Click C1 (row 0, col 2)
      const cellC1 = window.locator('#cell-0-2');
      await cellC1.click();
      await window.waitForTimeout(200);
      await window.keyboard.type('=A1+B1');
      await window.keyboard.press('Enter');
      await window.waitForTimeout(500);
      
      // Save the file
      await eph.stubDialog(electronApp, 'showSaveDialog', { 
        filePath: testFilePath 
      });
      await window.locator('#save-btn').click();
      await window.waitForTimeout(1000);
      
      // Ensure no modal is visible
      const modal = window.locator('#modal-overlay');
      await expect(modal).not.toBeVisible({ timeout: 2000 });
      
      // Now create a new spreadsheet to clear the data
      await window.locator('#new-btn').click();
      await window.waitForTimeout(300);
      
      // Verify cells are empty
      await expect(window.locator('#cell-0-0')).toHaveText('');
      
      // Now test loading the file
      await eph.stubDialog(electronApp, 'showOpenDialog', { 
        filePaths: [testFilePath] 
      });
      
      await window.locator('#load-btn').click();
      await window.waitForTimeout(300);
      
      // Handle unsaved changes modal if it appears
      const isModalVisible = await modal.isVisible();
      if (isModalVisible) {
        await window.locator('#modal-ok').click();
        await window.waitForTimeout(300);
      }
      
      await window.waitForTimeout(500);
      
      // Verify file was loaded (check cell values)
      await expect(window.locator('#cell-0-0')).toHaveText('100'); // A1
      await expect(window.locator('#cell-0-1')).toHaveText('200'); // B1
      await expect(window.locator('#cell-0-2')).toHaveText('300'); // C1 (formula result)
      
      // Verify status shows "Saved"
      const status = window.locator('#file-status');
      await expect(status).toContainText('Saved');
    } finally {
      // Cleanup test file
      cleanupTestFile(testFilePath);
    }
  });

  test('Save file workflow', async ({ electronApp, window }) => {
    await window.waitForTimeout(500);
    
    const testFilePath = path.join(os.tmpdir(), 'test-save.sheet');
    
    try {
      // Enter data in cells
      const cellA1 = window.locator('#cell-0-0');
      await cellA1.click();
      await window.waitForTimeout(200);
      await window.keyboard.type('42');
      await window.keyboard.press('Enter');
      await window.waitForTimeout(500);
      
      // Verify status shows "Unsaved"
      const status = window.locator('#file-status');
      await expect(status).toContainText('Unsaved', { timeout: 5000 });
      
      // Stub save dialog to return test file path
      await eph.stubDialog(electronApp, 'showSaveDialog', { 
        filePath: testFilePath 
      });
      
      // Click Save button
      await window.locator('#save-btn').click();
      await window.waitForTimeout(1000);
      
      // Ensure no modal is visible
      const modal = window.locator('#modal-overlay');
      await expect(modal).not.toBeVisible({ timeout: 2000 });
      
      // Verify status shows "Saved" (file status doesn't show filename in current implementation)
      await expect(status).toContainText('Saved');
      
      // Verify file exists on disk
      expect(fs.existsSync(testFilePath)).toBeTruthy();
      
      // Verify file has content (it's a gob-encoded binary file, not JSON)
      const stats = fs.statSync(testFilePath);
      expect(stats.size).toBeGreaterThan(0);
    } finally {
      // Cleanup test file
      cleanupTestFile(testFilePath);
    }
  });

  test('file status tracking', async ({ electronApp, window }) => {
    await window.waitForTimeout(500);
    
    const testFilePath = path.join(os.tmpdir(), 'test-status.sheet');
    
    try {
      // Create a test file by entering data and saving
      const cellA1 = window.locator('#cell-0-0');
      await cellA1.click();
      await window.waitForTimeout(200);
      await window.keyboard.type('50');
      await window.keyboard.press('Enter');
      await window.waitForTimeout(500);
      
      // Save the file
      await eph.stubDialog(electronApp, 'showSaveDialog', { 
        filePath: testFilePath 
      });
      await window.locator('#save-btn').click();
      await window.waitForTimeout(1000);
      
      const modal = window.locator('#modal-overlay');
      await expect(modal).not.toBeVisible({ timeout: 2000 });
      
      // Verify status shows "Saved"
      const status = window.locator('#file-status');
      await expect(status).toContainText('Saved');
      
      // Edit a cell
      const cell = window.locator('#cell-1-1');
      await cell.click();
      await window.waitForTimeout(200);
      await window.keyboard.type('75');
      await window.keyboard.press('Enter');
      await window.waitForTimeout(500);
      
      // Verify status shows "Unsaved changes"
      await expect(status).toContainText('Unsaved', { timeout: 5000 });
      
      // Stub save dialog and save file
      await eph.stubDialog(electronApp, 'showSaveDialog', { 
        filePath: testFilePath 
      });
      
      await window.locator('#save-btn').click();
      await window.waitForTimeout(1000);
      
      // Verify status shows "Saved" again
      await expect(status).toContainText('Saved');
    } finally {
      // Cleanup test file
      cleanupTestFile(testFilePath);
    }
  });

  test('dialog cancellation handling', async ({ electronApp, window }) => {
    await window.waitForTimeout(500);
    
    // Stub open dialog to return cancellation
    await eph.stubDialog(electronApp, 'showOpenDialog', { 
      canceled: true 
    });
    
    // Click Load button
    await window.locator('#load-btn').click();
    await window.waitForTimeout(500);
    
    // Verify app returns to normal state (no error, no crash)
    // Check that the spreadsheet is still visible and functional
    const table = window.locator('#spreadsheet');
    await expect(table).toBeVisible();
    
    // Verify we can still interact with cells
    const cell = window.locator('#cell-0-0');
    await cell.click();
    await expect(cell).toHaveClass(/selected/);
    
    // Now test save dialog cancellation
    await eph.stubDialog(electronApp, 'showSaveDialog', { 
      canceled: true 
    });
    
    await window.locator('#save-btn').click();
    await window.waitForTimeout(500);
    
    // Verify app is still functional
    await expect(table).toBeVisible();
  });

});
