// Story 6.4: CSV Round-Trip Verification Tests
// Tests CSV import → export → import to verify data integrity

const { test, expect } = require('./fixtures');
const { stubDialog } = require('electron-playwright-helpers');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Helper to clear spreadsheet and ensure no modals are open
async function clearSpreadsheet(window) {
  await window.locator('#new-btn').click();
  await window.waitForTimeout(300);
  
  // Dismiss any unsaved changes modal
  const modal = window.locator('#modal-overlay');
  if (await modal.isVisible()) {
    await window.locator('#modal-ok').click();
    await window.waitForTimeout(300);
    await expect(modal).not.toBeVisible();
  }
}

// TODO: These tests use old #import-csv-btn and #export-csv-btn buttons that were removed in Story 7.12
// Need to update to use menu handlers like test_csv_import.spec.js
test.describe.skip('CSV Round-Trip Verification', () => {
  test('Simple data round-trip preserves values', async ({ window, electronApp }) => {
    // Create test CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const importPath = path.join(testDir, 'import.csv');
    const exportPath = path.join(testDir, 'export.csv');
    
    const originalData = 'Name,Age,City\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF';
    fs.writeFileSync(importPath, originalData);

    // Import CSV
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [importPath] });
    await window.locator('#import-csv-btn').click();
    await window.locator('#csv-preview-import').click();
    await window.waitForTimeout(500);

    // Verify data imported
    await expect(window.locator('#cell-0-0')).toHaveText('Name');
    await expect(window.locator('#cell-1-0')).toHaveText('Alice');
    await expect(window.locator('#cell-1-1')).toHaveText('30');
    await expect(window.locator('#cell-1-2')).toHaveText('NYC');
    await expect(window.locator('#cell-3-2')).toHaveText('SF');

    // Export CSV
    await stubDialog(electronApp, 'showSaveDialog', { filePath: exportPath });
    await window.locator('#export-csv-btn').click();
    await window.waitForTimeout(500);
    await window.locator('#modal-ok').click();

    // Re-import exported CSV
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [exportPath] });
    await window.locator('#import-csv-btn').click();
    await window.waitForTimeout(300);
    await window.locator('#csv-preview-import').click();
    
    // Confirm unsaved changes if modal appears
    const confirmModal = window.locator('#modal-overlay');
    await window.waitForTimeout(300);
    if (await confirmModal.isVisible()) {
      await window.locator('#modal-ok').click();
      await window.waitForTimeout(300);
      // Wait for modal to fully close
      await expect(confirmModal).not.toBeVisible();
    }
    await window.waitForTimeout(300);

    // Verify data matches after round-trip
    await expect(window.locator('#cell-0-0')).toHaveText('Name');
    await expect(window.locator('#cell-1-0')).toHaveText('Alice');
    await expect(window.locator('#cell-1-1')).toHaveText('30');
    await expect(window.locator('#cell-1-2')).toHaveText('NYC');
    await expect(window.locator('#cell-3-2')).toHaveText('SF');

    // Cleanup
    fs.unlinkSync(importPath);
    fs.unlinkSync(exportPath);
    fs.rmdirSync(testDir);
  });

  test('Formula round-trip exports computed values', async ({ window, electronApp }) => {
    // Clear spreadsheet
    await clearSpreadsheet(window);

    // Create data with formulas
    await window.locator('#cell-0-0').click();
    await window.keyboard.type('10');
    await window.keyboard.press('Enter');
    await window.locator('#cell-1-0').click();
    await window.keyboard.type('20');
    await window.keyboard.press('Enter');
    await window.locator('#cell-2-0').click();
    await window.keyboard.type('=A1+A2');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);

    // Verify formula computed
    await expect(window.locator('#cell-2-0')).toHaveText('30');

    // Export CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const exportPath = path.join(testDir, 'formulas.csv');
    await stubDialog(electronApp, 'showSaveDialog', { filePath: exportPath });
    await window.locator('#export-csv-btn').click();
    await window.waitForTimeout(500);
    await window.locator('#modal-ok').click();

    // Verify exported CSV has computed value, not formula
    const exportContent = fs.readFileSync(exportPath, 'utf-8');
    expect(exportContent).toContain('10');
    expect(exportContent).toContain('20');
    expect(exportContent).toContain('30');
    expect(exportContent).not.toContain('=A1+A2');

    // Re-import exported CSV
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [exportPath] });
    await window.locator('#import-csv-btn').click();
    await window.waitForTimeout(300);
    await window.locator('#csv-preview-import').click();
    
    // Confirm unsaved changes
    const confirmModal = window.locator('#modal-overlay');
    await window.waitForTimeout(300);
    if (await confirmModal.isVisible()) {
      await window.locator('#modal-ok').click();
      await window.waitForTimeout(300);
      // Wait for modal to fully close
      await expect(confirmModal).not.toBeVisible();
    }
    await window.waitForTimeout(300);

    // Verify values preserved (formula lost)
    await expect(window.locator('#cell-0-0')).toHaveText('10');
    await expect(window.locator('#cell-1-0')).toHaveText('20');
    await expect(window.locator('#cell-2-0')).toHaveText('30');

    // Cleanup
    fs.unlinkSync(exportPath);
    fs.rmdirSync(testDir);
  });

  test('Special characters round-trip (commas, quotes)', async ({ window, electronApp }) => {
    // Clear spreadsheet
    await clearSpreadsheet(window);

    // Create data with special characters
    await window.locator('#cell-0-0').click();
    await window.keyboard.type('Smith, John');  // Comma in value
    await window.keyboard.press('Enter');
    await window.locator('#cell-0-1').click();
    await window.keyboard.type('He said "hello"');  // Quotes in value
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);

    // Export CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const exportPath = path.join(testDir, 'special.csv');
    await stubDialog(electronApp, 'showSaveDialog', { filePath: exportPath });
    await window.locator('#export-csv-btn').click();
    await window.waitForTimeout(500);
    await window.locator('#modal-ok').click();

    // Re-import exported CSV
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [exportPath] });
    await window.locator('#import-csv-btn').click();
    await window.waitForTimeout(300);
    await window.locator('#csv-preview-import').click();
    
    // Confirm unsaved changes
    const confirmModal = window.locator('#modal-overlay');
    await window.waitForTimeout(300);
    if (await confirmModal.isVisible()) {
      await window.locator('#modal-ok').click();
      await window.waitForTimeout(300);
      // Wait for modal to fully close
      await expect(confirmModal).not.toBeVisible();
    }
    await window.waitForTimeout(300);

    // Verify special characters preserved
    await expect(window.locator('#cell-0-0')).toHaveText('Smith, John');
    await expect(window.locator('#cell-0-1')).toHaveText('He said "hello"');

    // Cleanup
    fs.unlinkSync(exportPath);
    fs.rmdirSync(testDir);
  });

  test('Large dataset round-trip (100 rows)', async ({ window, electronApp }) => {
    // Clear spreadsheet first
    await clearSpreadsheet(window);
    
    // Create large CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const importPath = path.join(testDir, 'large.csv');
    const exportPath = path.join(testDir, 'large-export.csv');
    
    let csvContent = 'ID,Name,Value\n';
    for (let i = 1; i <= 100; i++) {
      csvContent += `${i},Row${i},${i * 10}\n`;
    }
    fs.writeFileSync(importPath, csvContent);

    // Import CSV
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [importPath] });
    await window.locator('#import-csv-btn').click();
    await window.locator('#csv-preview-import').click();
    await window.waitForTimeout(1000);

    // Verify first and some middle rows (grid only renders 100 rows initially)
    await expect(window.locator('#cell-0-0')).toHaveText('ID');
    await expect(window.locator('#cell-1-0')).toHaveText('1');
    await expect(window.locator('#cell-50-0')).toHaveText('50');
    await expect(window.locator('#cell-50-2')).toHaveText('500');

    // Export CSV
    await stubDialog(electronApp, 'showSaveDialog', { filePath: exportPath });
    await window.locator('#export-csv-btn').click();
    await window.waitForTimeout(500);
    await window.locator('#modal-ok').click();

    // Verify exported file size
    const stats = fs.statSync(exportPath);
    expect(stats.size).toBeGreaterThan(1000); // Should have substantial content

    // Re-import and verify
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [exportPath] });
    await window.locator('#import-csv-btn').click();
    await window.locator('#csv-preview-import').click();
    
    // Confirm unsaved changes
    const confirmModal = window.locator('#modal-overlay');
    await window.waitForTimeout(200);
    if (await confirmModal.isVisible()) {
      await window.locator('#modal-ok').click();
    }
    await window.waitForTimeout(1000);

    // Verify data integrity after round-trip (check first and middle rows)
    await expect(window.locator('#cell-0-0')).toHaveText('ID');
    await expect(window.locator('#cell-50-1')).toHaveText('Row50');
    await expect(window.locator('#cell-50-2')).toHaveText('500');

    // Cleanup
    fs.unlinkSync(importPath);
    fs.unlinkSync(exportPath);
    fs.rmdirSync(testDir);
  });

  test('Empty cells preserved in round-trip', async ({ window, electronApp }) => {
    // Clear spreadsheet
    await clearSpreadsheet(window);

    // Create sparse data (with empty cells)
    await window.locator('#cell-0-0').click();
    await window.keyboard.type('A');
    await window.keyboard.press('Enter');
    // Skip cell-0-1 (leave empty)
    await window.locator('#cell-0-2').click();
    await window.keyboard.type('C');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);

    // Export CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const exportPath = path.join(testDir, 'sparse.csv');
    await stubDialog(electronApp, 'showSaveDialog', { filePath: exportPath });
    await window.locator('#export-csv-btn').click();
    await window.waitForTimeout(500);
    await window.locator('#modal-ok').click();

    // Re-import
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [exportPath] });
    await window.locator('#import-csv-btn').click();
    await window.locator('#csv-preview-import').click();
    
    // Confirm unsaved changes
    const confirmModal = window.locator('#modal-overlay');
    await window.waitForTimeout(200);
    if (await confirmModal.isVisible()) {
      await window.locator('#modal-ok').click();
    }
    await window.waitForTimeout(500);

    // Verify sparse data preserved
    await expect(window.locator('#cell-0-0')).toHaveText('A');
    await expect(window.locator('#cell-0-1')).toHaveText('');
    await expect(window.locator('#cell-0-2')).toHaveText('C');

    // Cleanup
    fs.unlinkSync(exportPath);
    fs.rmdirSync(testDir);
  });
});
