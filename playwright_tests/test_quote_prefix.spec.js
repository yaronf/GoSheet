// Story 13.7: Quote Prefix for Text
// Tests for Excel-style "'" prefix that forces text format

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  selectCellViaApp,
  startEditingViaApp,
} = require('./helpers');

test.describe('Quote Prefix: display and text-mode (Story 13.7 AC1/AC2)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test.afterEach(async ({ window }) => {
    await setCellViaApi(window, 0, 0, '');
  });

  test("'001 displays as 001 (no leading quote)", async ({ window }) => {
    await setCellViaApi(window, 0, 0, "'001");
    const cell = window.locator('#cell-0-0');
    await expect(cell).toBeVisible();
    const text = await cell.textContent();
    expect(text).toBe('001');
  });

  test("'001 does not get number-cell class", async ({ window }) => {
    await setCellViaApi(window, 0, 0, "'001");
    const cell = window.locator('#cell-0-0');
    await expect(cell).toBeVisible();
    // Wait for cell to be rendered with value
    await expect(cell).toHaveText('001');
    const classes = await cell.getAttribute('class');
    expect(classes).not.toMatch(/number-cell/);
  });

  test("'3.14 displays as 3.14 without number alignment", async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, "'3.14");
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('3.14');
    const classes = await cell.getAttribute('class');
    expect(classes).not.toMatch(/number-cell/);
  });

  test('plain 001 without quote gets number-cell class', async ({ window }) => {
    // Sanity check: plain numeric-looking value DOES get number-cell
    await setCellViaApi(window, 0, 0, '42');
    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('42');
    const classes = await cell.getAttribute('class');
    expect(classes).toMatch(/number-cell/);
  });
});

test.describe('Quote Prefix: formula bar shows raw value (Story 13.7 AC3)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test.afterEach(async ({ window }) => {
    await setCellViaApi(window, 0, 0, '');
  });

  test("formula bar shows '001 (with leading quote) when cell selected", async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, "'001");
    await selectCellViaApp(window, 0, 0);
    const formulaBar = window.locator('#formula-bar');
    await expect(formulaBar).toHaveValue("'001");
  });

  test("inline editor pre-fills with '001 (with leading quote) when re-editing", async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, "'001");
    await startEditingViaApp(window, 0, 0);
    const editor = window.locator('.cell-editor');
    await expect(editor).toBeVisible();
    const editorValue = await editor.inputValue();
    expect(editorValue).toBe("'001");
    // Cancel edit to avoid side effects
    await window.keyboard.press('Escape');
  });
});
