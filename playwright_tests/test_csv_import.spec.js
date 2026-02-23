// Story 6.1: CSV Import Dialog Tests
// Tests CSV file selection, preview display, and user interaction

const { test, expect } = require('./fixtures');
const { stubDialog, clickMenuItemById } = require('electron-playwright-helpers');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Story 7.12: Use menu click + stubDialog instead of window.evaluate (avoids Electron 27+ flakiness)
async function triggerImportCSV(electronApp, stubValue) {
  await stubDialog(electronApp, 'showOpenDialog', stubValue);
  await clickMenuItemById(electronApp, 'import-csv');
}

const { ensureSpreadsheetView } = require('./helpers');

// Use menu click + stubDialog instead of window.evaluate (avoids Electron 27+ flakiness)
async function triggerExportCSV(electronApp, stubValue) {
  await stubDialog(electronApp, 'showSaveDialog', stubValue);
  await clickMenuItemById(electronApp, 'export-csv');
}

test.describe('CSV Import Dialog', () => {
  // Story 7.12: CSV buttons removed from toolbar, now accessible via File menu
  test('Import CSV menu item exists', async ({ electronApp, window }) => {
    // Verify Import CSV menu item exists in File menu
    const hasImportCSV = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const fileMenu = menu.items.find(item => item.label === 'File');
      if (!fileMenu) return false;
      
      const importItem = fileMenu.submenu.items.find(item => 
        item.label && item.label.includes('Import CSV')
      );
      return importItem !== undefined;
    });
    
    expect(hasImportCSV).toBe(true);
  });

  test('CSV preview modal opens and displays file info', async ({ window, electronApp }) => {
    await ensureSpreadsheetView(window);
    // Create test CSV file
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'test.csv');
    const csvContent = 'Name,Age,City\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF';
    fs.writeFileSync(csvPath, csvContent);

    // Trigger Import CSV via menu
    await triggerImportCSV(electronApp, { filePaths: [csvPath] });

    // Wait for preview modal to appear (check for active class)
    const modal = window.locator('#csv-preview-modal.active');
    await expect(modal).toBeVisible({ timeout: 5000 });

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
    await ensureSpreadsheetView(window);
    // Create test CSV with 20 rows
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'large.csv');
    let csvContent = 'Col1,Col2,Col3\n';
    for (let i = 1; i <= 20; i++) {
      csvContent += `Row${i},Value${i},Data${i}\n`;
    }
    fs.writeFileSync(csvPath, csvContent);

    // Trigger Import CSV via menu
    await triggerImportCSV(electronApp, { filePaths: [csvPath] });

    // Wait for preview modal
    const modal = window.locator('#csv-preview-modal.active');
    await expect(modal).toBeVisible({ timeout: 5000 });

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
    await ensureSpreadsheetView(window);
    // Create test CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'test.csv');
    fs.writeFileSync(csvPath, 'A,B\n1,2');

    // Trigger Import CSV via menu
    await triggerImportCSV(electronApp, { filePaths: [csvPath] });
    const modal = window.locator('#csv-preview-modal.active');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click Cancel
    await window.locator('#csv-preview-cancel').click();
    await expect(modal).not.toBeVisible();

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('CSV import loads data into spreadsheet', async ({ window, electronApp }) => {
    await ensureSpreadsheetView(window);
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'test.csv');
    
    try {
      // Create test CSV
      fs.writeFileSync(csvPath, 'Name,Age,City\nAlice,30,NYC\nBob,25,LA');

    // Trigger Import CSV via menu
    await triggerImportCSV(electronApp, { filePaths: [csvPath] });
    const modal = window.locator('#csv-preview-modal.active');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click Import
    await window.locator('#csv-preview-import').click();

    // Modal should close (active class removed)
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Check if unsaved changes confirmation modal appeared (shouldn't on fresh start, but handle it)
    const confirmModal = window.locator('#modal-overlay.active');
    const isConfirmVisible = await confirmModal.isVisible();
    if (isConfirmVisible) {
      await window.locator('#modal-ok').click();
      await expect(confirmModal).not.toBeVisible();
    }

    // Wait for data to load
    await window.waitForTimeout(1000);

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
      await expect(fileStatus).toContainText('Unsaved', { timeout: 5000 });
    } finally {
      // Cleanup
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
      if (fs.existsSync(testDir)) fs.rmdirSync(testDir);
    }
  });

  test('CSV import warns on unsaved changes', async ({ window, electronApp }) => {
    await ensureSpreadsheetView(window);
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

    // Trigger Import CSV via menu
    await triggerImportCSV(electronApp, { filePaths: [csvPath] });
    const previewModal = window.locator('#csv-preview-modal.active');
    await expect(previewModal).toBeVisible({ timeout: 5000 });

    // Click Import
    await window.locator('#csv-preview-import').click();

    // Confirmation modal should appear
    const confirmModal = window.locator('#modal-overlay.active');
    await expect(confirmModal).toBeVisible({ timeout: 5000 });
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
    await ensureSpreadsheetView(window);
    // First, create some data
    await window.locator('#cell-0-0').click();
    await window.keyboard.type('Old Data');
    await window.keyboard.press('Enter');
    await window.locator('#cell-1-0').click();
    await window.keyboard.type('More Old Data');
    await window.keyboard.press('Enter');
    // Wait for backend to register unsaved changes before triggering import
    await expect(window.locator('#file-status')).toContainText('Unsaved', { timeout: 5000 });

    // Create test CSV with different data
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'test.csv');
    fs.writeFileSync(csvPath, 'New,Data\n1,2');

    // Trigger Import CSV via menu
    await triggerImportCSV(electronApp, { filePaths: [csvPath] });
    // Wait for preview modal to appear before clicking import
    const modal = window.locator('#csv-preview-modal.active');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await window.locator('#csv-preview-import').click();

    // Wait for and confirm unsaved changes warning (appears async after Import click)
    const confirmModal = window.locator('#modal-overlay.active');
    await expect(confirmModal).toBeVisible({ timeout: 5000 });
    await window.locator('#modal-ok').click();
    await expect(confirmModal).not.toBeVisible();

    // Wait for import and grid reload
    await window.waitForTimeout(800);

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
    await ensureSpreadsheetView(window);
    // Trigger Import CSV via menu (stub returns cancelled)
    await triggerImportCSV(electronApp, { canceled: true });

    // Modal should NOT appear (dialog was cancelled)
    const modal = window.locator('#csv-preview-modal.active');
    // Wait a bit to ensure modal doesn't appear
    await window.waitForTimeout(500);
    await expect(modal).not.toBeVisible();
  });

  test('Invalid CSV file shows error', async ({ window, electronApp }) => {
    await ensureSpreadsheetView(window);
    // Create CSV with unclosed quote (parse error)
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'invalid.csv');
    // Unclosed quote will cause CSV parser to fail
    fs.writeFileSync(csvPath, 'Name,Age\n"John,30\nJane,25');

    // Trigger Import CSV via menu
    await triggerImportCSV(electronApp, { filePaths: [csvPath] });

    // Wait for error alert to appear
    const alertModal = window.locator('#modal-overlay.active');
    await expect(alertModal).toBeVisible({ timeout: 5000 });
    await expect(window.locator('#modal-message')).toContainText('Error previewing CSV');

    // Close alert
    await window.locator('#modal-ok').click();

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });

  test('Empty CSV file shows error', async ({ window, electronApp }) => {
    await ensureSpreadsheetView(window);
    // Create empty CSV
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'empty.csv');
    fs.writeFileSync(csvPath, '');

    // Trigger Import CSV via menu
    await triggerImportCSV(electronApp, { filePaths: [csvPath] });

    // Wait for error alert to appear
    const alertModal = window.locator('#modal-overlay.active');
    await expect(alertModal).toBeVisible({ timeout: 5000 });
    await expect(window.locator('#modal-message')).toContainText('Error previewing CSV');

    // Close alert
    await window.locator('#modal-ok').click();

    // Cleanup
    fs.unlinkSync(csvPath);
    fs.rmdirSync(testDir);
  });
});

test.describe('CSV Export', () => {
  // Story 7.12: CSV buttons removed from toolbar, now accessible via File menu
  test('Export CSV menu item exists', async ({ electronApp, window }) => {
    // Verify Export CSV menu item exists in File menu
    const hasExportCSV = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const fileMenu = menu.items.find(item => item.label === 'File');
      if (!fileMenu) return false;
      
      const exportItem = fileMenu.submenu.items.find(item => 
        item.label && item.label.includes('Export CSV')
      );
      return exportItem !== undefined;
    });
    
    expect(hasExportCSV).toBe(true);
  });

  test('Export CSV creates file with data', async ({ window, electronApp }) => {
    await ensureSpreadsheetView(window);
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

    // Export CSV via menu (stubDialog + clickMenuItemById - avoids flaky window.evaluate)
    await triggerExportCSV(electronApp, { canceled: false, filePath: csvPath });

    // Wait for success alert
    const alertModal = window.locator('#modal-overlay.active');
    await expect(alertModal).toBeVisible({ timeout: 5000 });
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
    await ensureSpreadsheetView(window);
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

    // Export CSV via menu
    await triggerExportCSV(electronApp, { canceled: false, filePath: csvPath });
    
    // Wait for success alert
    const alertModal = window.locator('#modal-overlay.active');
    await expect(alertModal).toBeVisible({ timeout: 5000 });
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
    await ensureSpreadsheetView(window);
    // Clear any existing data - New button might show unsaved changes modal
    await window.locator('#new-btn').click();
    
    // Check if unsaved changes modal appeared and dismiss it
    const confirmModal = window.locator('#modal-overlay.active');
    await window.waitForTimeout(200);
    const isConfirmVisible = await confirmModal.isVisible();
    if (isConfirmVisible) {
      await window.locator('#modal-ok').click();
      await expect(confirmModal).not.toBeVisible();
    }

    // Create export path
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-test-'));
    const csvPath = path.join(testDir, 'empty.csv');

    // Export CSV via menu
    await triggerExportCSV(electronApp, { canceled: false, filePath: csvPath });
    
    // Wait for success alert
    const alertModal = window.locator('#modal-overlay.active');
    await expect(alertModal).toBeVisible({ timeout: 5000 });
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
    await ensureSpreadsheetView(window);
    // Export CSV via menu (stub returns cancelled)
    await triggerExportCSV(electronApp, { canceled: true });

    // Wait a moment
    await window.waitForTimeout(500);

    // No alert should appear
    const alertModal = window.locator('#modal-overlay');
    await expect(alertModal).not.toBeVisible();
  });
});
