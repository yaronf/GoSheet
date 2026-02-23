// Playwright Electron Tests for GoSheet
// Ported from test_spreadsheet.py (Python browser tests)
// Tests the Electron app with native Playwright Electron API
// Story 8.2: Navigate from welcome screen before testing

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView } = require('./helpers');

test.describe('GoSheet Spreadsheet Tests', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('page loads with correct title', async ({ window }) => {
    // Verify window title
    const title = await window.title();
    expect(title).toContain('GoSheet');
    
    // Check that the spreadsheet table exists
    const table = window.locator('#spreadsheet');
    await expect(table).toBeVisible();
  });

  test('grid has correct structure', async ({ window }) => {
    // Check column headers (A, B, C, etc.)
    const headerA = window.locator('.column-header').first();
    await expect(headerA).toHaveText('A');
    
    // Check row headers (1, 2, 3, etc.)
    const header1 = window.locator('.row-header').first();
    await expect(header1).toHaveText('1');
    
    // Check that data cells exist
    const cellA1 = window.locator('#cell-0-0');
    await expect(cellA1).toBeVisible();
  });

  test('spreadsheet starts empty', async ({ window }) => {
    // Wait a bit for page to load
    await window.waitForTimeout(500);
    
    // Check that spreadsheet starts empty
    await expect(window.locator('#cell-0-0')).toHaveText('');
    await expect(window.locator('#cell-1-0')).toHaveText('');
    await expect(window.locator('#cell-2-0')).toHaveText('');
    
    // Verify file status shows saved (empty spreadsheet is saved state)
    const fileStatus = window.locator('#file-status');
    await expect(fileStatus).toContainText('Saved');
  });

  test('clicking a cell selects it', async ({ window }) => {
    await window.waitForTimeout(500);
    
    const cell = window.locator('#cell-5-5');
    await cell.click();
    
    // Cell should have 'selected' class
    const classAttr = await cell.getAttribute('class');
    expect(classAttr).toContain('selected');
  });

  test('enter single digit', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Click cell and type
    const cell = window.locator('#cell-10-0');
    await cell.click();
    await window.keyboard.type('5');
    await window.keyboard.press('Enter');
    
    await window.waitForTimeout(300);
    
    // Cell should display the value
    await expect(cell).toHaveText('5');
  });

  test('enter multi-digit number', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Click cell and type multi-digit number
    const cell = window.locator('#cell-11-0');
    await cell.click();
    await window.keyboard.type('123');
    await window.keyboard.press('Enter');
    
    await window.waitForTimeout(300);
    
    // Cell should display the full number
    await expect(cell).toHaveText('123');
  });

  test('enter values in multiple cells', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Enter value in first cell
    const cell1 = window.locator('#cell-12-0');
    await cell1.click();
    await window.keyboard.type('10');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    // Enter value in second cell
    const cell2 = window.locator('#cell-13-0');
    await cell2.click();
    await window.keyboard.type('20');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    // Enter value in third cell
    const cell3 = window.locator('#cell-14-0');
    await cell3.click();
    await window.keyboard.type('30');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    // Verify all values
    await expect(cell1).toHaveText('10');
    await expect(cell2).toHaveText('20');
    await expect(cell3).toHaveText('30');
  });

  test('edit existing cell', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Enter initial value
    const cell = window.locator('#cell-15-0');
    await cell.click();
    await window.keyboard.type('100');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    // Edit the cell (double-click to edit)
    await cell.dblclick();
    await window.waitForTimeout(300);
    
    // Get the input element and replace value
    const inputElem = cell.locator('.cell-editor');
    await inputElem.fill('200');
    await inputElem.press('Enter');
    await window.waitForTimeout(500);
    
    // Should have new value
    await expect(cell).toHaveText('200');
  });

  test('escape cancels edit', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Enter initial value
    const cell = window.locator('#cell-16-0');
    await cell.click();
    await window.keyboard.type('50');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    // Start editing and cancel
    await cell.dblclick();
    await window.waitForTimeout(100);
    await window.keyboard.type('999');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    
    // Should still have original value
    await expect(cell).toHaveText('50');
  });

  test('simple formula evaluation', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Enter a formula
    const cell = window.locator('#cell-17-0');
    await cell.click();
    await window.keyboard.type('=5+3');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // Should display computed result
    await expect(cell).toHaveText('8');
    
    // Should have formula-cell class
    const classAttr = await cell.getAttribute('class');
    expect(classAttr).toContain('formula-cell');
  });

  test('edit after formula', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Enter a formula
    const cell1 = window.locator('#cell-18-0');
    await cell1.click();
    await window.keyboard.type('=2*3');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // Enter a regular value in next cell
    const cell2 = window.locator('#cell-19-0');
    await cell2.click();
    await window.keyboard.type('42');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // Verify both cells
    await expect(cell1).toHaveText('6');
    await expect(cell2).toHaveText('42');
  });

  test('formula with cell references', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Enter values in two cells
    const cell1 = window.locator('#cell-20-0');
    await cell1.click();
    await window.keyboard.type('5');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    const cell2 = window.locator('#cell-21-0');
    await cell2.click();
    await window.keyboard.type('3');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    // Enter formula referencing those cells
    const cell3 = window.locator('#cell-22-0');
    await cell3.click();
    await window.keyboard.type('=A21+A22');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // Should display sum
    await expect(cell3).toHaveText('8');
  });

  test('arrow key navigation', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Select a cell
    const cell = window.locator('#cell-5-5');
    await cell.click();
    let classAttr = await cell.getAttribute('class');
    expect(classAttr).toContain('selected');
    
    // Navigate down
    await window.keyboard.press('ArrowDown');
    await window.waitForTimeout(100);
    const cellBelow = window.locator('#cell-6-5');
    classAttr = await cellBelow.getAttribute('class');
    expect(classAttr).toContain('selected');
    
    // Navigate right
    await window.keyboard.press('ArrowRight');
    await window.waitForTimeout(100);
    const cellRight = window.locator('#cell-6-6');
    classAttr = await cellRight.getAttribute('class');
    expect(classAttr).toContain('selected');
  });

  test('enter number in empty cell does not show error', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Click an empty cell
    const cell = window.locator('#cell-25-5');
    await cell.click();
    await window.waitForTimeout(100);
    
    // Type a simple number
    await window.keyboard.type('42');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // Should display the number, not #ERROR
    const cellText = await cell.textContent();
    expect(cellText).not.toContain('#ERROR');
    await expect(cell).toHaveText('42');
  });

  test('formula dependency recalculation', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Enter a value in A10
    const cellA10 = window.locator('#cell-9-0');
    await cellA10.click();
    await window.keyboard.type('10');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    // Enter a formula in A11 that references A10
    const cellA11 = window.locator('#cell-10-0');
    await cellA11.click();
    await window.keyboard.type('=A10*2');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // A11 should show 20
    await expect(cellA11).toHaveText('20');
    
    // Now change A10 to 15
    await cellA10.click();
    await window.keyboard.type('15');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // A11 should now show 30 (15*2)
    await expect(cellA11).toHaveText('30');
  });

  test('click away saves value', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Click empty cell C5
    const cellC5 = window.locator('#cell-4-2');
    await cellC5.click();
    await window.waitForTimeout(200);
    
    // Type a value
    await window.keyboard.type('99');
    await window.waitForTimeout(200);
    
    // Click away to another cell (D6) - this should save the value
    const cellD6 = window.locator('#cell-5-3');
    await cellD6.click();
    await window.waitForTimeout(500);
    
    // Check that C5 has the value
    await expect(cellC5).toHaveText('99');
  });

  test('empty cell reference shows error', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Click empty cell B10
    const cellB10 = window.locator('#cell-9-1');
    await cellB10.click();
    await window.waitForTimeout(200);
    
    // Enter formula referencing empty cell Z99
    await window.keyboard.type('=Z99+1');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    
    // Check that B10 shows error
    const cellText = await cellB10.textContent();
    expect(cellText).toContain('#ERROR');
    expect(cellText.toLowerCase()).toContain('empty cell');
  });

  test('infinite scroll expands grid', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Get initial grid size - row 95 should exist
    const initialRow95 = window.locator('#cell-95-0');
    await expect(initialRow95).toBeVisible();
    
    // Row 105 should NOT exist initially
    const initialRow105 = window.locator('#cell-105-0');
    await expect(initialRow105).not.toBeAttached();
    
    // Scroll to bottom to trigger expansion
    await window.evaluate(() => {
      const container = document.querySelector('.spreadsheet-container');
      container.scrollTop = container.scrollHeight;
    });
    await window.waitForTimeout(1000);
    
    // After scrolling, row 105 should exist
    const expandedRow105 = window.locator('#cell-105-0');
    await expect(expandedRow105).toBeAttached();
    
    // Test column expansion
    const initialColZ = window.locator('#cell-0-25');
    await expect(initialColZ).toBeVisible();
    
    // Column AB (27) should not exist initially
    const initialColAB = window.locator('#cell-0-27');
    await expect(initialColAB).not.toBeAttached();
    
    // Scroll to right edge
    await window.evaluate(() => {
      const container = document.querySelector('.spreadsheet-container');
      container.scrollLeft = container.scrollWidth;
    });
    await window.waitForTimeout(1000);
    
    // After scrolling right, more columns should exist
    const expandedColAB = window.locator('#cell-0-27');
    await expect(expandedColAB).toBeAttached();
  });

  test('string functions work correctly', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Test CONCAT
    const cellD1 = window.locator('#cell-0-3');
    await cellD1.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=CONCAT("Hello"," ","World")');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await expect(cellD1).toHaveText('Hello World');
    
    // Test UPPER
    const cellD2 = window.locator('#cell-1-3');
    await cellD2.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=UPPER("hello")');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await expect(cellD2).toHaveText('HELLO');
    
    // Test LOWER
    const cellD3 = window.locator('#cell-2-3');
    await cellD3.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=LOWER("WORLD")');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await expect(cellD3).toHaveText('world');
    
    // Test LEN
    const cellD4 = window.locator('#cell-3-3');
    await cellD4.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=LEN("Test")');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await expect(cellD4).toHaveText('4');
    
    // Test LEFT
    const cellD5 = window.locator('#cell-4-3');
    await cellD5.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=LEFT("Hello",3)');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await expect(cellD5).toHaveText('Hel');
    
    // Test RIGHT
    const cellD6 = window.locator('#cell-5-3');
    await cellD6.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=RIGHT("World",3)');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await expect(cellD6).toHaveText('rld');
    
    // Test MID
    const cellD7 = window.locator('#cell-6-3');
    await cellD7.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=MID("Hello",2,3)');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await expect(cellD7).toHaveText('ell');
  });

  test('formula bar shows formula for formula cells', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Create test data first
    const cellA1 = window.locator('#cell-0-0');
    await cellA1.click();
    await window.keyboard.type('10');
    await window.keyboard.press('Enter');
    
    const cellB1 = window.locator('#cell-0-1');
    await cellB1.click();
    await window.keyboard.type('=A1*2');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // Click on cell B1 which has formula =A1*2
    await cellB1.click();
    await window.waitForTimeout(300);
    
    // Formula bar should show the formula, not the result
    const formulaBar = window.locator('#formula-bar');
    await expect(formulaBar).toHaveValue('=A1*2');
    
    // Cell reference should show B1
    const cellRef = window.locator('#cell-ref');
    await expect(cellRef).toHaveText('B1');
    
    // Click on cell A1 which has value 10
    await cellA1.click();
    await window.waitForTimeout(300);
    
    // Formula bar should show the value
    await expect(formulaBar).toHaveValue('10');
    await expect(cellRef).toHaveText('A1');
  });

  test('formula bar editing updates cell', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Create test data in A1
    const cellA1 = window.locator('#cell-0-0');
    await cellA1.click();
    await window.keyboard.type('10');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    // Click on empty cell D5
    const cellD5 = window.locator('#cell-4-3');
    await cellD5.click();
    await window.waitForTimeout(300);
    
    // Type in formula bar
    const formulaBar = window.locator('#formula-bar');
    await formulaBar.click();
    await formulaBar.fill('=A1+10');
    await window.waitForTimeout(200);
    
    // Press Enter
    await formulaBar.press('Enter');
    await window.waitForTimeout(500);
    
    // Cell should show result (10 + 10 = 20)
    await expect(cellD5).toHaveText('20');
    
    // Should have moved to next row (D6)
    const cellRef = window.locator('#cell-ref');
    await expect(cellRef).toHaveText('D6');
  });

  test('double-click formula cell shows formula in editor', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Create test data first
    const cellA1 = window.locator('#cell-0-0');
    await cellA1.click();
    await window.keyboard.type('10');
    await window.keyboard.press('Enter');
    
    const cellB1 = window.locator('#cell-0-1');
    await cellB1.click();
    await window.keyboard.type('=A1*2');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // Double-click on cell B1 which has formula =A1*2
    await cellB1.dblclick();
    await window.waitForTimeout(500);
    
    // Input should show formula, not result
    const inputElem = cellB1.locator('.cell-editor');
    await expect(inputElem).toBeVisible();
    const inputValue = await inputElem.inputValue();
    expect(inputValue).toBe('=A1*2');
    
    // Cancel the edit
    await window.keyboard.press('Escape');
    await window.waitForTimeout(300);
  });

  test('formula bar updates after cell edit', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Create test data in A1
    const cellA1 = window.locator('#cell-0-0');
    await cellA1.click();
    await window.keyboard.type('10');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    // Select cell A1 again
    await cellA1.click();
    await window.waitForTimeout(300);
    
    // Formula bar should show "10"
    const formulaBar = window.locator('#formula-bar');
    await expect(formulaBar).toHaveValue('10');
    
    // Double-click to edit in-cell
    await cellA1.dblclick();
    await window.waitForTimeout(300);
    
    // Change value to 99
    const inputElem = cellA1.locator('.cell-editor');
    await inputElem.fill('99');
    await inputElem.press('Enter');
    await window.waitForTimeout(500);
    
    // Formula bar should now show "99"
    await expect(formulaBar).toHaveValue('99');
  });

  test('SUM with empty cells shows error', async ({ window, electronApp }) => {
    // Create new file to get clean state
    await electronApp.evaluate(async () => {
      const response = await fetch('http://localhost:3000/api/file/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    });
    
    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    await ensureSpreadsheetView(window);
    
    // Create a range with an empty cell: E1=5, E2=empty, E3=10
    const cellE1 = window.locator('#cell-0-4');
    await cellE1.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('5');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // Skip E2 (leave it empty)
    const cellE3 = window.locator('#cell-2-4');
    await cellE3.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('10');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    
    // Test SUM with empty cell in range
    const cellF1 = window.locator('#cell-0-5');
    await cellF1.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=SUM(E1:E3)');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    
    const cellText = await cellF1.textContent();
    expect(cellText).toContain('#ERROR');
    expect(cellText.toLowerCase()).toContain('empty cell');
  });

  test('circular reference detection', async ({ window, electronApp }) => {
    // Start with a clean spreadsheet
    await electronApp.evaluate(async () => {
      await fetch('http://localhost:3000/api/file/new', { method: 'POST' });
    });
    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    await ensureSpreadsheetView(window);
    
    // Create a simple circular reference: A1=B1, B1=A1
    // First set B1 to a value
    const cellB1 = window.locator('#cell-0-1');
    await cellB1.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('10');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    
    // Set A1 to =B1
    const cellA1 = window.locator('#cell-0-0');
    await cellA1.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=B1');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    
    // Verify A1 shows computed value (10)
    let a1Value = await cellA1.textContent();
    expect(a1Value).toContain('10');
    
    // Now change B1 to =A1 (creates circular reference)
    await cellB1.click();
    await window.waitForTimeout(200);
    await window.keyboard.press('Delete');
    await window.waitForTimeout(200);
    await window.keyboard.type('=A1');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    
    // B1 should show circular reference error
    const b1Value = await cellB1.textContent();
    const b1Upper = b1Value.toUpperCase();
    expect(b1Upper.includes('#ERROR') || b1Upper.includes('CIRCULAR')).toBeTruthy();
    
    // Test longer chain: A1=B1, B1=C1, C1=A1
    await electronApp.evaluate(async () => {
      await fetch('http://localhost:3000/api/file/new', { method: 'POST' });
    });
    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    await ensureSpreadsheetView(window);
    
    // Set A1=B1
    await cellA1.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=B1');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    
    // Set B1=C1
    await cellB1.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=C1');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    
    // Set C1=A1 (creates 3-cell circular reference)
    const cellC1 = window.locator('#cell-0-2');
    await cellC1.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('=A1');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    
    // C1 should show circular reference error
    const c1Value = await cellC1.textContent();
    const c1Upper = c1Value.toUpperCase();
    expect(c1Upper.includes('#ERROR') || c1Upper.includes('CIRCULAR')).toBeTruthy();
  });

  test('new file clears data', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Create some data first
    const cellA1 = window.locator('#cell-0-0');
    await cellA1.click();
    await window.keyboard.type('Test Data');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(200);
    
    // Verify data exists
    await expect(cellA1).toHaveText('Test Data');
    
    // Click New button
    await window.locator('#new-btn').click();
    await window.waitForTimeout(300);
    
    // Handle unsaved changes modal if it appears
    const modal = window.locator('#modal-overlay');
    if (await modal.isVisible()) {
      await window.locator('#modal-ok').click();
      await window.waitForTimeout(300);
    }
    
    // Cell should be empty after clearing
    await expect(cellA1).toHaveText('');
  });

  test('new file warns on unsaved changes', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Make a change to trigger unsaved state
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
    
    // Modal should appear
    const modal = window.locator('#modal-overlay');
    await expect(modal).toBeVisible();
    
    // Click Cancel
    await window.locator('#modal-cancel').click();
    await window.waitForTimeout(200);
    
    // Modal should close
    await expect(modal).not.toBeVisible();
    
    // Data should still be there
    await expect(window.locator('#cell-5-5')).toHaveText('999');
  });

  test('new file modal OK clears data', async ({ window }) => {
    await window.waitForTimeout(500);
    
    // Make a change to trigger unsaved state
    const cell = window.locator('#cell-5-5');
    await cell.click();
    await window.waitForTimeout(200);
    await window.keyboard.type('888');
    await window.keyboard.press('Enter');
    
    // Wait for status to show "Unsaved"
    const status = window.locator('#file-status');
    await expect(status).toContainText('Unsaved', { timeout: 5000 });
    
    // Click New button
    await window.locator('#new-btn').click();
    await window.waitForTimeout(300);
    
    // Modal should appear
    const modal = window.locator('#modal-overlay');
    await expect(modal).toBeVisible();
    
    // Click OK
    await window.locator('#modal-ok').click();
    await window.waitForTimeout(300);
    
    // Modal should close
    await expect(modal).not.toBeVisible();
    
    // Cell should be empty
    await expect(window.locator('#cell-5-5')).toHaveText('');
  });

});
