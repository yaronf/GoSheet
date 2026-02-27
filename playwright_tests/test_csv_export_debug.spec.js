// Debug test: trace why Export CSV creates file with data fails
// Run with: npx playwright test playwright_tests/test_csv_export_debug.spec.js --project=electron
// Check terminal for backend/DOM state before export

const { test, expect } = require('./fixtures');
const {
  stubDialog,
  clickMenuItemById,
} = require('electron-playwright-helpers');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

async function triggerExportCSV(electronApp, stubValue) {
  await stubDialog(electronApp, 'showSaveDialog', stubValue);
  await clickMenuItemById(electronApp, 'export-csv');
}

test('DEBUG: trace cell persistence before CSV export', async ({
  window,
  electronApp,
}) => {
  await ensureSpreadsheetView(window);

  // Set cells via API (bypasses flaky UI click/selected in Electron; export reads from backend)
  console.log('[DEBUG] Setting cell A1 (Name)...');
  await setCellViaApi(window, 0, 0, 'Name');

  console.log('[DEBUG] Setting cell B1 (Age)...');
  await setCellViaApi(window, 0, 1, 'Age');

  console.log('[DEBUG] Setting cell A2 (Alice)...');
  await setCellViaApi(window, 1, 0, 'Alice');

  console.log('[DEBUG] Setting cell B2 (30)...');
  await setCellViaApi(window, 1, 1, '30');

  // Diagnostic: what does the backend have?
  const backendCells = await window.evaluate(async () => {
    try {
      const res = await fetch('/api/cells/all');
      const json = await res.json();
      if (!json.success) return { error: json.error };
      return { cells: json.data };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('[DEBUG] Backend /api/cells/all:', JSON.stringify(backendCells, null, 2));

  // Diagnostic: what does the DOM show?
  const domCells = await window.evaluate(() => {
    const cells = {};
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const el = document.getElementById(`cell-${r}-${c}`);
        cells[`${r},${c}`] = el ? el.textContent?.trim() || '(empty)' : 'N/A';
      }
    }
    return cells;
  });
  console.log('[DEBUG] DOM cell contents:', JSON.stringify(domCells, null, 2));

  // Export
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gosheet-csv-debug-'));
  const csvPath = path.join(testDir, 'export.csv');
  await triggerExportCSV(electronApp, { canceled: false, filePath: csvPath });

  const alertModal = window.locator('#modal-overlay.active');
  await expect(alertModal).toBeVisible({ timeout: 5000 });
  await window.locator('#modal-ok').click();

  const content = fs.readFileSync(csvPath, 'utf-8');
  console.log('[DEBUG] Exported CSV content:', JSON.stringify(content));
  console.log('[DEBUG] CSV length:', content.length);

  // Cleanup
  fs.unlinkSync(csvPath);
  fs.rmdirSync(testDir);

  // Assert so test fails with full context if wrong
  expect(content).toContain('Name');
});
