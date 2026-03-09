# Story 17.4: Range Address Box — Type to Select

Status: ready-for-dev

## Dependencies

- Story 17.1 (Range Selection — Shift-Click and Drag): `applySelectionRange` and `appState.selectionRange` must be in place; the address box display for multi-cell ranges (AC: 4) depends on the range state set up in 17.1.

## Story

As a user,
I want to type a range address (e.g. `A1:D7`) to instantly select that rectangle,
So that I can navigate to and select precise ranges without dragging.

## Acceptance Criteria

1. Given a range address box is visible in the toolbar area, when the user clicks it and types a valid range address (e.g. `B3:F10`) and presses Enter, then the specified range is selected and the grid scrolls to show it.

2. Given the user types a single cell address (e.g. `C5`) in the address box and presses Enter, when Enter is pressed, then the grid navigates to that cell and selects it.

3. Given the user types an invalid address (e.g. `ZZZ999:ABC` or `QQRS`) and presses Enter, when Enter is pressed, then the input is highlighted as invalid (red border) and the current selection is unchanged.

4. Given a range is selected (via click, drag, or shift-click), when the selection changes, then the address box updates to show the current range (e.g. `A1:D7` or just `B3` for a single cell).

5. Given the "Select All" menu item previously existed in Edit menu (as a placeholder in `setupEditMenuListeners`), when this story is complete, then it is replaced with a "Go to Range…" action that focuses the address box (or removed entirely).

6. Given the address box is focused, when the user presses Escape, then the box reverts to the current selection address and focus returns to the grid.

## Tasks / Subtasks

- [ ] Task 1: Make `#cell-ref` editable (AC: 1, 2, 3, 4, 6)
  - [ ] Change `<span class="cell-ref" id="cell-ref">` in `index.html` (line 137) to `<input type="text" class="cell-ref" id="cell-ref" aria-label="Cell or range reference" />`
  - [ ] Update `updateFormulaBar` in `app-grid.js` to set `cellRef.value` instead of `cellRef.textContent` (since it is now an input)
  - [ ] Ensure the Story 17.1 range address update also uses `.value`

- [ ] Task 2: Parse and validate the address box input (AC: 1, 2, 3)
  - [ ] Add helper `parseRangeAddress(text)` in a suitable module (e.g. `app-utils.js`):
    - Accepts `A1`, `B3:F10`, `a1:d7` (case-insensitive)
    - Returns `{ startRow, startCol, endRow, endCol }` or `null` on invalid input
    - Use `letterToCol` and row parsing; validate `col >= 0`, `row >= 0`
  - [ ] Add `keydown` listener on `#cell-ref` in `app.js`:
    - On Enter: call `parseRangeAddress(cellRef.value)`, if valid → `applySelectionRange(...)`, scroll anchor cell into view (`getCellElement(startRow, startCol)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })`), blur the address box, focus the grid
    - On invalid: add CSS class `cell-ref-invalid` (red border), do not change selection
    - On Escape: restore current address from `appState.selectionRange`, remove `cell-ref-invalid`, blur
  - [ ] Remove `cell-ref-invalid` class whenever the address box value changes (on `input` event)

- [ ] Task 3: CSS for address box invalid state (AC: 3)
  - [ ] In `spreadsheet.css`, add `.cell-ref-invalid { border-color: var(--color-error) !important; }` rule
  - [ ] Also update `.cell-ref` to allow editing: change from `background: var(--color-bg-surface); border-radius: 4px` display styling to an input-appropriate style (keep same visual width of `64px`, add `border: 1px solid var(--color-border)`, `cursor: text`)

- [ ] Task 4: Replace "Select All" with "Go to Range…" in Edit menu (AC: 5)
  - [ ] In `app-file-ops.js::setupEditMenuListeners`, find the `onMenuSelectAll` handler (lines 340–383). Replace the body with: focus `#cell-ref`, select all text in the input.
  - [ ] Update `electron/menu.js` label for the menu item from "Select All" to "Go to Range…" with accelerator `Cmd+G` (or keep `Cmd+A` if preferred — decide and document).

- [ ] Task 5: Playwright tests (AC: 1–6)
  - [ ] Type `C5` in address box, press Enter, verify `#cell-5-4` (row 4, col 2, 0-indexed) has `.selected`
  - [ ] Type `A1:B2` in address box, press Enter, verify 4 cells selected and `#cell-ref` value is `A1:B2`
  - [ ] Type `ZZQQ`, press Enter, verify `#cell-ref` has class `cell-ref-invalid` and selection unchanged
  - [ ] Select A1:C3 via shift-click, verify `#cell-ref` value becomes `A1:C3`
  - [ ] Focus address box, press Escape, verify `#cell-ref` reverts to previous address

## Dev Notes

### Current State

`#cell-ref` is currently a `<span>` (index.html, line 137):
```html
<span class="cell-ref" id="cell-ref" title="Current cell reference" aria-label="Selected cell">A1</span>
```
It is read-only — `updateFormulaBar` sets `.textContent`. In Story 17.1, the range display also sets `.textContent`. Both must change to `.value` after this story converts it to an `<input>`.

The global keydown handler in `app.js` (line 505) skips if `e.target.tagName === 'INPUT'`, which means the address box Enter/Escape handling must be on the `#cell-ref` element itself, not the global handler.

`letterToCol` and `colToLetter` are already in `app-utils.js` and imported across modules.

The CSS for `.cell-ref` (spreadsheet.css line 571) sets `width: 72px` for the default and `width: 64px` for the compact toolbar. Converting to `<input>` keeps these dimensions; just add the border and make it look like a text field.

### Implementation Approach

**HTML change** — in `index.html` (around line 137), change:
```html
<span class="cell-ref" id="cell-ref" ...>A1</span>
```
to:
```html
<input type="text" class="cell-ref" id="cell-ref"
  title="Type cell or range address and press Enter"
  aria-label="Cell or range reference" value="A1" />
```

**`parseRangeAddress` helper** — add to `app-utils.js`:
```js
export function parseRangeAddress(text) {
  if (!text) return null;
  const upper = text.trim().toUpperCase();
  // Single cell: e.g. A1, Z99, AA100
  const singleMatch = upper.match(/^([A-Z]+)(\d+)$/);
  if (singleMatch) {
    const col = letterToCol(singleMatch[1]);
    const row = parseInt(singleMatch[2]) - 1;
    if (col < 0 || row < 0) return null;
    return { startRow: row, startCol: col, endRow: row, endCol: col };
  }
  // Range: e.g. A1:D7, B3:F10
  const rangeMatch = upper.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (rangeMatch) {
    const startCol = letterToCol(rangeMatch[1]);
    const startRow = parseInt(rangeMatch[2]) - 1;
    const endCol   = letterToCol(rangeMatch[3]);
    const endRow   = parseInt(rangeMatch[4]) - 1;
    if (startCol < 0 || startRow < 0 || endCol < 0 || endRow < 0) return null;
    return {
      startRow: Math.min(startRow, endRow),
      startCol: Math.min(startCol, endCol),
      endRow:   Math.max(startRow, endRow),
      endCol:   Math.max(startCol, endCol),
    };
  }
  return null;
}
```

Note: `letterToCol` already handles multi-letter column names (AA, AB, etc.) — check `app-utils.js` to confirm; if not, it only handles single letters. The regex `^([A-Z]+)(\d+)$` handles multi-letter columns; `letterToCol` must handle them too. Verify and fix `letterToCol` if needed.

**Address box keydown handler** — add in `app.js` after the formula bar handlers:
```js
const cellRefInput = document.getElementById('cell-ref');
if (cellRefInput) {
  cellRefInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const range = parseRangeAddress(cellRefInput.value);
      if (!range) {
        cellRefInput.classList.add('cell-ref-invalid');
        return;
      }
      cellRefInput.classList.remove('cell-ref-invalid');
      appState.selectionMode = 'cell';
      applySelectionRange(range.startRow, range.startCol, range.endRow, range.endCol);
      // Scroll to anchor
      const anchorCell = getCellElement(range.startRow, range.startCol);
      anchorCell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      // Return focus to grid
      anchorCell?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Restore current address
      const { startRow, startCol, endRow, endCol } = appState.selectionRange;
      const isRange = startRow !== endRow || startCol !== endCol;
      cellRefInput.value = isRange
        ? `${colToLetter(startCol)}${startRow + 1}:${colToLetter(endCol)}${endRow + 1}`
        : `${colToLetter(startCol)}${startRow + 1}`;
      cellRefInput.classList.remove('cell-ref-invalid');
      // Return focus to grid
      const anchorCell = getCellElement(startRow, startCol);
      anchorCell?.focus();
    }
  });
  cellRefInput.addEventListener('input', () => {
    cellRefInput.classList.remove('cell-ref-invalid');
  });
  cellRefInput.addEventListener('focus', () => {
    cellRefInput.select(); // Select all text on focus for easy replacement
  });
}
```

**`updateFormulaBar` change** — in `app-grid.js` line 528 change:
```js
cellRef.textContent = ref;
```
to:
```js
cellRef.value = ref;
```
(and likewise for the range case added in Story 17.1).

**CSS changes** — in `spreadsheet.css`:

Change `.cell-ref` (line 571) to support input:
```css
.cell-ref {
  /* Re-apply styles after Pico.css reset (cell-ref is now an <input>) */
  all: unset;
  box-sizing: border-box;
  font-weight: bold;
  width: 72px;
  flex-shrink: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  line-height: normal;
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  text-align: center;
  cursor: text;
}

.cell-ref:focus {
  outline: 2px solid var(--color-primary);
  border-color: var(--color-primary);
}

.cell-ref-invalid {
  border-color: var(--color-error) !important;
  outline: 2px solid var(--color-error) !important;
}
```

The existing `input` reset at the top of `spreadsheet.css` (lines 16–23) applies `all: unset` only to `.formula-bar, .cell-editor, input[type='text'].formula-bar` — the `#cell-ref` input is NOT in that list, so Pico.css will style it. We need to add `#cell-ref` or `.cell-ref[type='text']` to that reset block or use `all: unset` in the `.cell-ref` rule itself.

The compact toolbar override (line 586) must also be updated:
```css
.toolbar-compact .cell-ref {
  width: 64px;
  padding: 4px var(--spacing-sm);
  font-size: 12px;
}
```

**"Select All" → "Go to Range…"** — in `app-file-ops.js` `setupEditMenuListeners` (around line 340):
```js
window.electronAPI.onMenuSelectAll(async () => {
  if (window.__DEBUG__) console.log('[App] Menu Go to Range triggered');
  const cellRefInput = document.getElementById('cell-ref');
  if (cellRefInput) {
    cellRefInput.focus();
    cellRefInput.select();
  }
});
```

In `electron/menu.js`, change the label for the Select All menu item to `'Go to Range…'` and update the accelerator to `CmdOrCtrl+G` (or leave `CmdOrCtrl+A` — both work; `Cmd+G` is more intuitive for "Go To"). Check the existing menu item label in `electron/menu.js`.

### Key Files to Modify

- `/Users/ysheffer/misc/spreadsheet/frontend/index.html` — change `#cell-ref` from `<span>` to `<input type="text">` (line 137)
- `/Users/ysheffer/misc/spreadsheet/frontend/app.js` — add `#cell-ref` keydown/input/focus handlers; import `parseRangeAddress` from `app-utils.js`; import `colToLetter` from `app-utils.js` (may already be imported)
- `/Users/ysheffer/misc/spreadsheet/frontend/app-grid.js` — change `.textContent` to `.value` in `updateFormulaBar` (line 529) and in the range-display path added by Story 17.1
- `/Users/ysheffer/misc/spreadsheet/frontend/app-utils.js` — add `parseRangeAddress(text)` helper; verify `letterToCol` handles multi-letter columns
- `/Users/ysheffer/misc/spreadsheet/frontend/spreadsheet.css` — restyle `.cell-ref` for `<input>` element; add `.cell-ref-invalid` rule; add `#cell-ref` to the Pico.css reset block (lines 16–23)
- `/Users/ysheffer/misc/spreadsheet/frontend/app-file-ops.js` — replace `onMenuSelectAll` body (lines 340–383) with address-box focus logic
- `/Users/ysheffer/misc/spreadsheet/electron/menu.js` — update "Select All" label to "Go to Range…" and change accelerator if desired

### Data Model / State

No backend changes.

`appState.selectionRange` is already the source of truth for the current selection — `updateFormulaBar` reads from it for the range display.

`parseRangeAddress` is a pure function with no side effects.

### Testing

```js
// Type single cell address
const cellRef = page.locator('#cell-ref');
await cellRef.click();
await cellRef.fill('C5');
await cellRef.press('Enter');
await page.waitForFunction(() => {
  const el = document.getElementById('cell-4-2');
  return el && el.classList.contains('selected');
});
expect(await page.locator('#cell-ref').inputValue()).toBe('C5');

// Type range address
await cellRef.click();
await cellRef.fill('A1:B2');
await cellRef.press('Enter');
await page.waitForFunction(() =>
  document.querySelectorAll('.cell.selected').length === 4
);
expect(await page.locator('#cell-ref').inputValue()).toBe('A1:B2');

// Invalid address
await cellRef.click();
await cellRef.fill('ZZQQ99:');
await cellRef.press('Enter');
expect(await page.locator('#cell-ref').evaluate(el => el.classList.contains('cell-ref-invalid'))).toBe(true);
// Selection unchanged — still A1:B2
expect(await page.locator('.cell.selected').count()).toBe(4);

// Escape reverts
await cellRef.fill('D10');
await cellRef.press('Escape');
expect(await page.locator('#cell-ref').inputValue()).toBe('A1:B2'); // reverts

// Selection → address box update
await page.click('[data-row="0"][data-col="0"]');
await page.click('[data-row="2"][data-col="2"]', { modifiers: ['Shift'] });
await page.waitForFunction(() => {
  const el = document.getElementById('cell-ref');
  return el && el.value === 'A1:C3';
});
```

### Edge Cases

- **`letterToCol` multi-letter support**: The function must handle `AA` (=26), `AB` (=27), etc. Verify `app-utils.js`. If it only handles single letters (A–Z), fix it: `letterToCol('AB') = 26 * 1 + 1 = 27`. Algorithm: `result = 0; for each char: result = result * 26 + (charCode - 64)`.
- **Row 0 vs row 1**: Internally rows are 0-indexed; display is 1-indexed. `parseRangeAddress('A1')` returns `row = 0`. Verify consistently.
- **Case insensitive**: `parseRangeAddress` converts to uppercase before matching, so `a1:b2` works.
- **Reversed range**: `B5:A1` should normalise to `A1:B5` (min/max logic in `parseRangeAddress` handles this).
- **Pico.css interference**: The new `<input>` will be styled by Pico.css unless we reset it. Add `input.cell-ref` or `#cell-ref` to the reset block in `spreadsheet.css` (lines 16–23). The `all: unset` approach is cleanest.
- **`scrollIntoView` and sticky headers**: Column headers are `position: sticky; top: 0` and row headers are `position: sticky; left: 0`. `scrollIntoView({ block: 'nearest', inline: 'nearest' })` respects this in Chromium/Electron. Test that the sticky header is not obscured.
- **Focus management**: After pressing Enter in the address box, focus must return to the grid so arrow key navigation and keyboard shortcuts work. `getCellElement(row, col)?.focus()` achieves this.
- **Very large column addresses**: `parseRangeAddress('ZZ1')` — `letterToCol('ZZ') = 26*26 + 26 = 702`. The grid will never have 702 columns normally, but it should not crash. The call to `expandGridIfNeeded` inside `selectCell` / `applySelectionRange` will expand if needed. Consider a max limit of 1000 to prevent accidental 1000-column grid expansion; add a guard: `if (endCol > 999 || endRow > 9999) return null;`.

### Project Structure Notes

No new files. No backend changes.

`app-utils.js` already exports `colToLetter` and `letterToCol` — `parseRangeAddress` fits naturally there.

The `electron/menu.js` change is purely a label/accelerator update — no structural change to the IPC event name (`menu-select-all` stays the same since we reuse the existing listener).

### References

- `index.html` line 137: `<span class="cell-ref" id="cell-ref">A1</span>` (to change to `<input>`)
- `app-grid.js` lines 524–532: `updateFormulaBar` (change `.textContent` to `.value`)
- `app-utils.js`: `letterToCol`, `colToLetter` (add `parseRangeAddress`)
- `spreadsheet.css` lines 571–583: `.cell-ref` (restyle for `<input>`)
- `spreadsheet.css` lines 16–23: Pico.css reset block (add `.cell-ref`)
- `app-file-ops.js` lines 340–383: `onMenuSelectAll` handler (replace)
- `electron/menu.js`: Edit menu "Select All" item (label change)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
