// Story 6.1: CSV Import Dialog Tests
// Tests CSV file selection, preview display, and user interaction

const { test, expect } = require('./fixtures');
const { stubDialog } = require('electron-playwright-helpers');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('CSV Import Dialog', () => {
  test('Import CSV button exists', async ({ window }) => {
    const importBtn = window.locator('#import-csv-btn');
    await expect(importBtn).toBeVisible();
    await expect(importBtn).toHaveText('Import CSV');
  });

  test('CSV preview modal opens and displays file info', async ({ window, electronApp }) => {
    // Create test CSV file
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'test.csv');
    const csvContent = 'Name,Age,City\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF';
    fs.writeFileSync(csvPath, csvContent);

    // Stub the file dialog to return our test CSV
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [csvPath] });

    // Click Import CSV button
    await window.locator('#import-csv-btn').click();

    // Wait for preview modal to appear
    const modal = window.locator('#csv-preview-modal');
    await expect(modal).toBeVisible();

    // Verify file info is displayed
    const info = window.locator('#csv-preview-info');
    await expect(info).toContainText('test.csv');
    await expect(info).toContainText('4 rows');
    await expect(info).toContainText('3 columns');

    // Verify preview table is displayed
    const table = window.locator('#csv-preview-table');
    await expect(table).toBeVisible();

    // Verify column headers (A, B, C)
    await expect(table.locator('th').nth(0)).toHaveText('A');
    await expect(table.locator('th').nth(1)).toHaveText('B');
    await expect(table.locator('th').nth(2)).toHaveText('C');

    // Verify first data row
    const firstRow = table.locator('tbody tr').first();
    await expect(firstRow.locator('td').nth(0)).toHaveText('Name');
    await expect(firstRow.locator('td').nth(1)).toHaveText('Age');
    await expect(firstRow.locator('td').nth(2)).toHaveText('City');

    // Verify second data row
    const secondRow = table.locator('tbody tr').nth(1);
    await expect(secondRow.locator('td').nth(0)).toHaveText('Alice');
    await expect(secondRow.locator('td').nth(1)).toHaveText('30');
    await expect(secondRow.locator('td').nth(2)).toHaveText('NYC');

    // Close modal
    await window.locator('#csv-preview-cancel').click();
    await expect(modal).not.toBeVisible();

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('CSV preview handles large files (shows first 10 rows)', async ({ window, electronApp }) => {
    // Create test CSV with 20 rows
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'large.csv');
    let csvContent = 'Col1,Col2,Col3\n';
    for (let i = 1; i <= 20; i++) {
      csvContent += `Row${i},Value${i},Data${i}\n`;
    }
    fs.writeFileSync(csvPath, csvContent);

    // Stub the file dialog
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [csvPath] });

    // Click Import CSV button
    await window.locator('#import-csv-btn').click();

    // Wait for preview modal
    const modal = window.locator('#csv-preview-modal');
    await expect(modal).toBeVisible();

    // Verify info shows total rows but preview is limited
    const info = window.locator('#csv-preview-info');
    await expect(info).toContainText('21 rows'); // Header + 20 data rows
    await expect(info).toContainText('First 10 rows'); // Preview limit

    // Verify preview table has exactly 10 rows (header row + 9 data rows in preview)
    const table = window.locator('#csv-preview-table');
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(10);

    // Close modal
    await window.locator('#csv-preview-cancel').click();

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('CSV preview Cancel button closes modal', async ({ window, electronApp }) => {
    // Create test CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'test.csv');
    fs.writeFileSync(csvPath, 'A,B\n1,2');

    // Stub the file dialog
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [csvPath] });

    // Open preview
    await window.locator('#import-csv-btn').click();
    const modal = window.locator('#csv-preview-modal');
    await expect(modal).toBeVisible();

    // Click Cancel
    await window.locator('#csv-preview-cancel').click();
    await expect(modal).not.toBeVisible();

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('CSV import loads data into spreadsheet', async ({ window, electronApp }) => {
    // Create test CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'test.csv');
    fs.writeFileSync(csvPath, 'Name,Age,City\nAlice,30,NYC\nBob,25,LA');

    // Stub the file dialog
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [csvPath] });

    // Open preview
    await window.locator('#import-csv-btn').click();
    const modal = window.locator('#csv-preview-modal');
    await expect(modal).toBeVisible();

    // Click Import
    await window.locator('#csv-preview-import').click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Wait for data to load
    await window.waitForTimeout(500);

    // Verify data is in spreadsheet
    await expect(window.locator('#cell-0-0')).toHaveText('Name');
    await expect(window.locator('#cell-0-1')).toHaveText('Age');
    await expect(window.locator('#cell-0-2')).toHaveText('City');
    await expect(window.locator('#cell-1-0')).toHaveText('Alice');
    await expect(window.locator('#cell-1-1')).toHaveText('30');
    await expect(window.locator('#cell-1-2')).toHaveText('NYC');
    await expect(window.locator('#cell-2-0')).toHaveText('Bob');
    await expect(window.locator('#cell-2-1')).toHaveText('25');
    await expect(window.locator('#cell-2-2')).toHaveText('LA');

    // Verify file status shows unsaved
    const fileStatus = window.locator('#file-status');
    await expect(fileStatus).toContainText('Unsaved');

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('CSV import warns on unsaved changes', async ({ window, electronApp }) => {
    // First, create some data
    await window.locator('#cell-0-0').click();
    await window.keyboard.type('Test');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);

    // Verify unsaved changes
    const fileStatus = window.locator('#file-status');
    await expect(fileStatus).toContainText('Unsaved');

    // Create test CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'test.csv');
    fs.writeFileSync(csvPath, 'A,B\n1,2');

    // Stub the file dialog
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [csvPath] });

    // Open preview
    await window.locator('#import-csv-btn').click();
    const previewModal = window.locator('#csv-preview-modal');
    await expect(previewModal).toBeVisible();

    // Click Import
    await window.locator('#csv-preview-import').click();

    // Confirmation modal should appear
    const confirmModal = window.locator('#modal-overlay');
    await expect(confirmModal).toBeVisible();
    await expect(window.locator('#modal-message')).toContainText('unsaved changes');

    // Click OK to confirm
    await window.locator('#modal-ok').click();

    // Wait for import to complete
    await window.waitForTimeout(500);

    // Verify data was imported
    await expect(window.locator('#cell-0-0')).toHaveText('A');
    await expect(window.locator('#cell-0-1')).toHaveText('B');

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('CSV import clears existing data', async ({ window, electronApp }) => {
    // First, create some data
    await window.locator('#cell-0-0').click();
    await window.keyboard.type('Old Data');
    await window.keyboard.press('Enter');
    await window.locator('#cell-1-0').click();
    await window.keyboard.type('More Old Data');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);

    // Create test CSV with different data
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'test.csv');
    fs.writeFileSync(csvPath, 'New,Data\n1,2');

    // Stub the file dialog
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [csvPath] });

    // Import CSV
    await window.locator('#import-csv-btn').click();
    await window.locator('#csv-preview-import').click();

    // Confirm unsaved changes warning
    const confirmModal = window.locator('#modal-overlay');
    if (await confirmModal.isVisible()) {
      await window.locator('#modal-ok').click();
    }

    // Wait for import
    await window.waitForTimeout(500);

    // Verify old data is gone and new data is present
    await expect(window.locator('#cell-0-0')).toHaveText('New');
    await expect(window.locator('#cell-0-1')).toHaveText('Data');
    await expect(window.locator('#cell-1-0')).toHaveText('1');
    await expect(window.locator('#cell-1-1')).toHaveText('2');

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('Cancelled file dialog does not show preview', async ({ window, electronApp }) => {
    // Stub the file dialog to return cancelled
    await stubDialog(electronApp, 'showOpenDialog', { canceled: true });

    // Click Import CSV button
    await window.locator('#import-csv-btn').click();

    // Wait a moment
    await window.waitForTimeout(500);

    // Modal should NOT appear
    const modal = window.locator('#csv-preview-modal');
    await expect(modal).not.toBeVisible();
  });

  test('Invalid CSV file shows error', async ({ window, electronApp }) => {
    // Create CSV with unclosed quote (parse error)
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'invalid.csv');
    // Unclosed quote will cause CSV parser to fail
    fs.writeFileSync(csvPath, 'Name,Age\n"John,30\nJane,25');

    // Stub the file dialog
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [csvPath] });

    // Click Import CSV button
    await window.locator('#import-csv-btn').click();

    // Wait for error alert
    await window.waitForTimeout(1000);
    const alertModal = window.locator('#modal-overlay');
    await expect(alertModal).toBeVisible();
    await expect(window.locator('#modal-message')).toContainText('Error previewing CSV');

    // Close alert
    await window.locator('#modal-ok').click();

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('Empty CSV file shows error', async ({ window, electronApp }) => {
    // Create empty CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'empty.csv');
    fs.writeFileSync(csvPath, '');

    // Stub the file dialog
    await stubDialog(electronApp, 'showOpenDialog', { filePaths: [csvPath] });

    // Click Import CSV button
    await window.locator('#import-csv-btn').click();

    // Wait for error alert
    await window.waitForTimeout(500);
    const alertModal = window.locator('#modal-overlay');
    await expect(alertModal).toBeVisible();
    await expect(window.locator('#modal-message')).toContainText('Error previewing CSV');

    // Close alert
    await window.locator('#modal-ok').click();

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });
});

test.describe('CSV Export', () => {
  test('Export CSV button exists', async ({ window }) => {
    const exportBtn = window.locator('#export-csv-btn');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toHaveText('Export CSV');
  });

  test('Export CSV creates file with data', async ({ window, electronApp }) => {
    // Create some data
    await window.locator('#cell-0-0').click();
    await window.keyboard.type('Name');
    await window.keyboard.press('Enter');
    await window.locator('#cell-0-1').click();
    await window.keyboard.type('Age');
    await window.keyboard.press('Enter');
    await window.locator('#cell-1-0').click();
    await window.keyboard.type('Alice');
    await window.keyboard.press('Enter');
    await window.locator('#cell-1-1').click();
    await window.keyboard.type('30');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);

    // Create export path
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'export.csv');

    // Stub the save dialog
    await stubDialog(electronApp, 'showSaveDialog', { filePath: csvPath });

    // Click Export CSV
    await window.locator('#export-csv-btn').click();

    // Wait for success alert
    await window.waitForTimeout(500);
    const alertModal = window.locator('#modal-overlay');
    await expect(alertModal).toBeVisible();
    await expect(window.locator('#modal-message')).toContainText('Exported to');

    // Close alert
    await window.locator('#modal-ok').click();

    // Verify file was created
    expect(fs.existsSync(csvPath)).toBe(true);

    // Verify file contents
    const content = fs.readFileSync(csvPath, 'utf-8');
    expect(content).toContain('Name');
    expect(content).toContain('Age');
    expect(content).toContain('Alice');
    expect(content).toContain('30');

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('Export CSV with formulas exports computed values', async ({ window, electronApp }) => {
    // Create data with formula
    await window.locator('#cell-0-0').click();
    await window.keyboard.type('10');
    await window.keyboard.press('Enter');
    await window.locator('#cell-0-1').click();
    await window.keyboard.type('20');
    await window.keyboard.press('Enter');
    await window.locator('#cell-0-2').click();
    await window.keyboard.type('=A1+B1');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);

    // Verify formula is computed
    await expect(window.locator('#cell-0-2')).toHaveText('30');

    // Create export path
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'export.csv');

    // Stub the save dialog
    await stubDialog(electronApp, 'showSaveDialog', { filePath: csvPath });

    // Export CSV
    await window.locator('#export-csv-btn').click();
    await window.waitForTimeout(500);
    await window.locator('#modal-ok').click();

    // Verify file contents (should have computed value, not formula)
    const content = fs.readFileSync(csvPath, 'utf-8');
    expect(content).toContain('10');
    expect(content).toContain('20');
    expect(content).toContain('30');
    expect(content).not.toContain('=A1+B1');

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('Export empty spreadsheet creates empty file', async ({ window, electronApp }) => {
    // Clear any existing data - New button might show unsaved changes modal
    await window.locator('#new-btn').click();
    
    // Check if unsaved changes modal appeared and dismiss it
    const confirmModal = window.locator('#modal-overlay');
    await window.waitForTimeout(200);
    if (await confirmModal.isVisible()) {
      await window.locator('#modal-ok').click();
      await window.waitForTimeout(200);
    }

    // Create export path
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'empty.csv');

    // Stub the save dialog
    await stubDialog(electronApp, 'showSaveDialog', { filePath: csvPath });

    // Export CSV
    await window.locator('#export-csv-btn').click();
    await window.waitForTimeout(500);
    await window.locator('#modal-ok').click();

    // Verify file was created and is empty
    expect(fs.existsSync(csvPath)).toBe(true);
    const content = fs.readFileSync(csvPath, 'utf-8');
    expect(content).toBe('');

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('Export CSV cancelled does not create file', async ({ window, electronApp }) => {
    // Stub the save dialog to return cancelled
    await stubDialog(electronApp, 'showSaveDialog', { canceled: true });

    // Click Export CSV
    await window.locator('#export-csv-btn').click();

    // Wait a moment
    await window.waitForTimeout(500);

    // No alert should appear
    const alertModal = window.locator('#modal-overlay');
    await expect(alertModal).not.toBeVisible();
  });
});
