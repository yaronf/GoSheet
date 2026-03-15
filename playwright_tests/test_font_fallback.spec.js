// Story 23.1: Generic font fallback
// Verifies that a cell with an imaginary (non-installed) font name renders
// with a fallback stack (fontName, sans-serif) so text is legible.

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  setStyleViaApi,
} = require('./helpers');

/** Add a style with custom font via POST /api/styles. Returns the new style ID. */
async function addStyleWithFont(window, name, fontName) {
  return window.evaluate(
    async ({ name, fontName }) => {
      const res = await fetch('/api/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          format: {
            font: {
              name: fontName,
              size: 12,
              bold: false,
              italic: false,
              color: '#000000',
            },
            fill: { pattern: 'none', fgColor: '#000', bgColor: '#000' },
            border: {
              left: { style: 'none', color: '#000' },
              right: { style: 'none', color: '#000' },
              top: { style: 'none', color: '#000' },
              bottom: { style: 'none', color: '#000' },
            },
            alignment: { horizontal: '' },
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'AddStyle failed');
      return json.data?.id;
    },
    { name, fontName }
  );
}

test.describe('Font fallback (Story 23.1)', () => {
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });

  test('cell with imaginary font renders with fallback stack', async ({
    window,
  }) => {
    const imaginaryFont = 'ZzyxxFont999';
    const styleId = await addStyleWithFont(
      window,
      'ImaginaryFont',
      imaginaryFont
    );
    expect(styleId).toBeGreaterThan(0);

    await setCellViaApi(window, 0, 0, 'Hello');
    await setStyleViaApi(window, 0, 0, 0, 0, styleId);

    const cell = window.locator('#cell-0-0');
    await expect(cell).toHaveText('Hello');

    const fontFamily = await cell.evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toContain(imaginaryFont);
    expect(fontFamily).toContain('sans-serif');
  });
});
