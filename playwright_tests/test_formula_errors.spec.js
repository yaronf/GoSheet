// Tests for formula error handling, error cell styling, and empty cell coercion.
// Covers FE/BE interaction: IsError field, error-cell CSS class, #ERROR display,
// error propagation, empty cell coercion to 0, and circular reference detection.

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

test.describe('Formula Error Handling', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test.afterEach(async ({ window }) => {
    // Clear cells used by these tests
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        await setCellViaApi(window, row, col, '');
      }
    }
  });

  // --- Error cell styling ---

  test('division by zero shows error-cell class and #ERROR text', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '=10/0');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveClass(/error-cell/);
    const text = await cell.textContent();
    expect(text).toMatch(/^#ERROR/);
    expect(text).toContain('division by zero');
  });

  test('unknown function shows error-cell class and #ERROR text', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '=NOPE(1)');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveClass(/error-cell/);
    const text = await cell.textContent();
    expect(text).toMatch(/^#ERROR/);
  });

  test('non-error formula cell does not have error-cell class', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '5');
    await setCellViaApi(window, 0, 1, '=A1*2');
    const cell = window.locator('#cell-0-1');
    await expect(cell).not.toHaveClass(/error-cell/);
    await expect(cell).toHaveText('10');
  });

  // --- Error propagation ---

  test('referencing an error cell shows "referenced cell has error"', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '=1/0');
    await setCellViaApi(window, 0, 1, '=A1');
    const cell = window.locator('#cell-0-1');
    await expect(cell).toHaveClass(/error-cell/);
    const text = await cell.textContent();
    expect(text).toContain('referenced cell has error');
  });

  test('referencing an error cell in arithmetic propagates error', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '=1/0');
    await setCellViaApi(window, 0, 1, '=A1+5');
    const cell = window.locator('#cell-0-1');
    await expect(cell).toHaveClass(/error-cell/);
    const text = await cell.textContent();
    expect(text).toContain('referenced cell has error');
  });

  test('error does not propagate through unrelated cells', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '=1/0');
    await setCellViaApi(window, 0, 1, '5');
    await setCellViaApi(window, 0, 2, '=B1+3');
    const cell = window.locator('#cell-0-2');
    await expect(cell).not.toHaveClass(/error-cell/);
    await expect(cell).toHaveText('8');
  });

  // --- Empty cell coercion ---

  test('formula chain: B2=C2 then C2=D2 shows empty not raw formula', async ({
    window,
  }) => {
    // Regression: entering =C2 into B2, then =D2 into C2 was showing "=D2" in B2
    // because evaluateCellRef fell back to cell.Value when Computed was empty.
    await setCellViaApi(window, 1, 1, '=C2'); // B2 = C2 (C2 empty)
    await setCellViaApi(window, 1, 2, '=D2'); // C2 = D2 (D2 empty)
    const cellB2 = window.locator('#cell-1-1');
    await expect(cellB2).not.toHaveClass(/error-cell/);
    const text = await cellB2.textContent();
    expect(text).not.toContain('='); // must not show raw formula
    expect(text).toBe(''); // should be empty since D2 is empty
  });

  test('referencing an empty cell returns empty, not an error', async ({
    window,
  }) => {
    // B1 is empty — =B1 should show empty string, not #ERROR
    await setCellViaApi(window, 0, 0, '=B1');
    const cell = window.locator('#cell-0-0');
    await expect(cell).not.toHaveClass(/error-cell/);
    const text = await cell.textContent();
    expect(text).not.toMatch(/^#ERROR/);
  });

  test('empty cell coerces to 0 in arithmetic', async ({ window }) => {
    // A1 is empty — =A1+7 should give 7
    await setCellViaApi(window, 0, 1, '=A1+7');
    const cell = window.locator('#cell-0-1');
    await expect(cell).not.toHaveClass(/error-cell/);
    await expect(cell).toHaveText('7');
  });

  test('SUM over range with empty cells treats empties as 0', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '3');
    await setCellViaApi(window, 1, 0, '4');
    // row 2 col 0 is empty
    await setCellViaApi(window, 3, 0, '=SUM(A1:A3)');
    const cell = window.locator('#cell-3-0');
    await expect(cell).not.toHaveClass(/error-cell/);
    await expect(cell).toHaveText('7');
  });

  // --- Circular reference ---

  test('direct self-reference shows circular reference error', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '=A1');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveClass(/error-cell/);
    const text = await cell.textContent();
    expect(text).toMatch(/^#ERROR/);
    expect(text.toLowerCase()).toContain('circular');
  });

  test('indirect circular reference shows error on both cells', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '=B1');
    await setCellViaApi(window, 0, 1, '=A1'); // closes the cycle
    // B1 directly gets circular reference error
    const cellB1 = window.locator('#cell-0-1');
    await expect(cellB1).toHaveClass(/error-cell/);
    const textB1 = await cellB1.textContent();
    expect(textB1).toMatch(/^#ERROR/);
    expect(textB1.toLowerCase()).toContain('circular');
    // A1 depends on B1 (now an error), so it also shows an error
    const cellA1 = window.locator('#cell-0-0');
    await expect(cellA1).toHaveClass(/error-cell/);
    const textA1 = await cellA1.textContent();
    expect(textA1).toMatch(/^#ERROR/);
  });

  test('3-cell circular reference: all three cells show error', async ({
    window,
  }) => {
    // A1=B1, B1=C1, C1=A1 — closing the cycle on the third cell
    await setCellViaApi(window, 0, 0, '=B1');
    await setCellViaApi(window, 0, 1, '=C1');
    await setCellViaApi(window, 0, 2, '=A1'); // closes the cycle
    const cellA1 = window.locator('#cell-0-0');
    const cellB1 = window.locator('#cell-0-1');
    const cellC1 = window.locator('#cell-0-2');
    // All three must show a circular ref error — not empty and not "referenced cell has error"
    // All three must show circular ref error (not empty, not "referenced cell has error")
    for (const cell of [cellA1, cellB1, cellC1]) {
      await expect(cell).toHaveClass(/error-cell/, { timeout: 3000 });
      const text = await cell.textContent();
      expect(text.toLowerCase()).toContain('circular');
    }
  });

  test('cell referencing a non-anchor cycle member shows error regardless of set order', async ({
    window,
  }) => {
    // D1=A1 set BEFORE the A1↔B1 cycle is created (A1 is not the closing/anchor cell)
    await setCellViaApi(window, 0, 3, '=A1');
    await setCellViaApi(window, 0, 0, '=B1'); // A1 depends on B1
    await setCellViaApi(window, 0, 1, '=A1'); // closes cycle — B1 is anchor
    const cellD1 = window.locator('#cell-0-3');
    await expect(cellD1).toHaveClass(/error-cell/, { timeout: 3000 });
    const text = await cellD1.textContent();
    expect(text).toMatch(/^#ERROR/);
  });

  test('breaking a circular reference by replacing with plain value clears the error', async ({
    window,
  }) => {
    // Create cycle
    await setCellViaApi(window, 0, 0, '=B1');
    await setCellViaApi(window, 0, 1, '=A1');
    const cellB1 = window.locator('#cell-0-1');
    await expect(cellB1).toHaveClass(/error-cell/);

    // Break cycle by making B1 a plain value
    await setCellViaApi(window, 0, 1, '42');
    await expect(cellB1).not.toHaveClass(/error-cell/);
    await expect(cellB1).toHaveText('42');

    // A1 now depends on B1=42, should resolve
    const cellA1 = window.locator('#cell-0-0');
    await expect(cellA1).not.toHaveClass(/error-cell/);
    await expect(cellA1).toHaveText('42');
  });

  test('breaking a circular reference by deleting one cell clears the other', async ({
    window,
  }) => {
    // Create cycle: A1=B1, B1=A1
    await setCellViaApi(window, 0, 0, '=B1');
    await setCellViaApi(window, 0, 1, '=A1');
    const cellA1 = window.locator('#cell-0-0');
    const cellB1 = window.locator('#cell-0-1');
    await expect(cellB1).toHaveClass(/error-cell/);
    await expect(cellA1).toHaveClass(/error-cell/);

    // Delete B1 (set to empty) — A1 now references empty B1, should resolve to empty
    await setCellViaApi(window, 0, 1, '');
    await expect(cellB1).not.toHaveClass(/error-cell/);
    await expect(cellA1).not.toHaveClass(/error-cell/);
    await expect(cellA1).toHaveText('');
  });

  // Bug repro: undo of breaking a circular reference should restore the cycle errors
  test('undo of breaking a circular reference restores the cycle errors', async ({
    window,
  }) => {
    // Create cycle: A1=B1, B1=A1
    await setCellViaApi(window, 0, 0, '=B1');
    await setCellViaApi(window, 0, 1, '=A1');
    const cellA1 = window.locator('#cell-0-0');
    const cellB1 = window.locator('#cell-0-1');
    await expect(cellB1).toHaveClass(/error-cell/, { timeout: 3000 });
    await expect(cellA1).toHaveClass(/error-cell/, { timeout: 3000 });

    // Break cycle by clearing B1
    await setCellViaApi(window, 0, 1, '');
    await expect(cellB1).not.toHaveClass(/error-cell/, { timeout: 3000 });
    await expect(cellA1).not.toHaveClass(/error-cell/, { timeout: 3000 });

    // Undo the clear — cycle should be restored, both cells should show circular ref errors
    await window.keyboard.press('Meta+z');
    for (const cell of [cellA1, cellB1]) {
      await expect(cell).toHaveClass(/error-cell/, { timeout: 3000 });
      const text = await cell.textContent();
      expect(text.toLowerCase()).toContain('circular');
    }
  });

  test('undo of clearing one member of a 3-cell cycle restores circular ref on all three', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, '=B1');
    await setCellViaApi(window, 0, 1, '=C1');
    await setCellViaApi(window, 0, 2, '=A1');
    const cellA1 = window.locator('#cell-0-0');
    const cellB1 = window.locator('#cell-0-1');
    const cellC1 = window.locator('#cell-0-2');

    // Break cycle by clearing C1
    await setCellViaApi(window, 0, 2, '');
    await expect(cellC1).not.toHaveClass(/error-cell/, { timeout: 3000 });

    // Undo — all three should show circular ref errors with the path
    await window.keyboard.press('Meta+z');
    for (const cell of [cellA1, cellB1, cellC1]) {
      await expect(cell).toHaveClass(/error-cell/, { timeout: 3000 });
      const text = await cell.textContent();
      expect(text.toLowerCase()).toContain('circular');
    }
  });
});
