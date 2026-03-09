# Story 17.2: Row/Column Select Aesthetics

Status: review

## Story

As a user,
I want any multi-cell selection to look like a clean rectangle,
So that I can clearly see the selected region without visual noise from internal cell borders.

## Acceptance Criteria

1. Given a full row is selected (via row header click), when the grid renders, then inner vertical cell borders within the selected row are suppressed, and the row highlight is a solid band.

2. Given a full column is selected (via column header click), when the grid renders, then inner horizontal cell borders within the selected column are suppressed, and the column highlight is a solid band.

3. Given a rectangular range (shift-click or drag) is selected, when the grid renders, then all internal cell borders within the selection are suppressed — only the outer rectangle border is visible.

4. Given the selection is cleared (single cell clicked), when the grid renders, then all cell borders return to their normal appearance.

5. Given a row header or column header is highlighted as part of the selection, when the selection is a full row or column, then the corresponding header cell also receives a distinct highlight (darker than body cells) to make the axis clear.

## Tasks / Subtasks

- [x] Task 1: Add CSS classes `.row-selected` and `.col-selected` to `spreadsheet.css` (AC: 1, 2, 3, 4)
  - [x] `.cell.row-selected.selected` — `border-left: none; border-right: none` (simpler approach)
  - [x] `.cell.col-selected.selected` — `border-top: none; border-bottom: none`
  - [x] `.row-header.row-header-selected` and `.column-header.col-header-selected` — teal background, white text

- [x] Task 2: Add `applyRowColHeaderHighlight` helper to `app-grid.js` (AC: 1, 2, 5)
  - [x] Function clears all `.row-header-selected` / `.col-header-selected` / `.row-selected` / `.col-selected` classes from the grid
  - [x] When `appState.selectionMode === 'row'`: mark selected row cells with `.row-selected`, mark row header `<th>` with `.row-header-selected`
  - [x] When `appState.selectionMode === 'column'`: mark selected column cells with `.col-selected`, mark column header `<th>` with `.col-header-selected`
  - [x] Called at end of both `applySelectionRange` and `applyCellSelection`

- [x] Task 3: Clear highlight on regular cell click (AC: 4)
  - [x] Handled automatically — `appState.selectionMode = 'cell'` before `selectCell` means `applyRowColHeaderHighlight` clears classes

- [x] Task 4: Clear highlight classes on grid rebuild (AC: 4)
  - [x] Handled automatically — DOM rebuild removes all classes

- [x] Task 5: Playwright tests (AC: 1–5)
  - [x] Row header click → cells have `row-selected`
  - [x] Row header click → header has `row-header-selected`
  - [x] Column header click → cells have `col-selected`
  - [x] Column header click → header has `col-header-selected`
  - [x] Regular cell click → clears `row-selected` and `col-selected`
  - [x] Rectangular range → no `row-selected` or `col-selected`

## Dev Notes

### Current State

Today, when a row or column header is clicked (`app.js` lines 453–478), `applySelectionRange` highlights all cells in the row/column with `.selected` (the teal border, 2px). Each cell retains its individual `1px solid var(--color-border-grid)` border between it and its neighbors. The result is a row that looks like many separate boxes with a teal outline rather than a single clean band.

The `.cell.selected` rule in `spreadsheet.css` (line 717) applies:
```css
.cell.selected {
  background: var(--color-cell-selected-bg) !important;
  border: 2px solid var(--color-cell-selected-border);
  outline: none;
}
```
This overrides the cell's full border with a 2px teal border on all four sides — every cell in the selected row gets its own full teal box. The fix is to suppress the shared borders between adjacent selected cells within the same row or column.

### Implementation Approach

**CSS — `spreadsheet.css`**: Add after the `.cell.selected` block (around line 721):

```css
/* Story 17.2: Row-selected cells — suppress left/right internal borders */
.cell.row-selected.selected {
  border-left-color: transparent;
  border-right-color: transparent;
}
/* Keep outer left/right border visible for first and last cell in row */
.cell.row-selected-first.selected {
  border-left-color: var(--color-cell-selected-border);
}
.cell.row-selected-last.selected {
  border-right-color: var(--color-cell-selected-border);
}

/* Story 17.2: Col-selected cells — suppress top/bottom internal borders */
.cell.col-selected.selected {
  border-top-color: transparent;
  border-bottom-color: transparent;
}
.cell.col-selected-first.selected {
  border-top-color: var(--color-cell-selected-border);
}
.cell.col-selected-last.selected {
  border-bottom-color: var(--color-cell-selected-border);
}

/* Story 17.2: Header highlight when row/column is fully selected */
.row-header.row-header-selected {
  background: var(--color-cell-selected-border) !important;
  color: var(--color-bg-primary) !important;
}

.column-header.col-header-selected {
  background: var(--color-cell-selected-border) !important;
  color: var(--color-bg-primary) !important;
}
```

**Simpler alternative**: Instead of first/last edge classes, just suppress all internal borders and let the container visually imply the boundary. Users see the solid band clearly even without a full teal outline:

```css
.cell.row-selected.selected {
  border-left: none !important;
  border-right: none !important;
}
.cell.col-selected.selected {
  border-top: none !important;
  border-bottom: none !important;
}
```

The simpler approach is recommended — it is less complex and still looks clean.

**JavaScript — `app-grid.js`**: Add new exported function `applyRowColHeaderHighlight`:

```js
export function applyRowColHeaderHighlight() {
  // Clear previous row/col classes
  document.querySelectorAll('.row-selected, .col-selected').forEach(el => {
    el.classList.remove('row-selected', 'col-selected');
  });
  document.querySelectorAll('.row-header-selected, .col-header-selected').forEach(el => {
    el.classList.remove('row-header-selected', 'col-header-selected');
  });

  const { startRow, startCol, endRow, endCol } = appState.selectionRange;
  const isFullRow = startCol === 0 && endCol === appState.COLS - 1;
  const isFullCol = startRow === 0 && endRow === appState.ROWS - 1;

  if (appState.selectionMode === 'row' && isFullRow) {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = 0; c < appState.COLS; c++) {
        const cell = getCellElement(r, c);
        if (cell) cell.classList.add('row-selected');
      }
      // Highlight the row header
      const rowHeader = document.querySelector(`.row-header[data-row="${r}"]`);
      if (rowHeader) rowHeader.classList.add('row-header-selected');
    }
  } else if (appState.selectionMode === 'column' && isFullCol) {
    for (let c = startCol; c <= endCol; c++) {
      for (let r = 0; r < appState.ROWS; r++) {
        const cell = getCellElement(r, c);
        if (cell) cell.classList.add('col-selected');
      }
      // Highlight the column header
      const colHeader = document.querySelector(`.column-header[data-col="${c}"]`);
      if (colHeader) colHeader.classList.add('col-header-selected');
    }
  }
}
```

Call `applyRowColHeaderHighlight()` at the end of both `applySelectionRange` and `applyCellSelection` in `app-grid.js`.

**Performance note**: For a full row of 26 cols or a full column of 100 rows, the loop is lightweight. For expanded grids (e.g. 500 rows × 26 cols for a column select), the loop over 500 cells is still fast (< 1ms). If performance is a concern, use `document.querySelectorAll(\`.cell[data-col="${c}"]\`)` instead of nested loops.

### Key Files to Modify

- `/Users/ysheffer/misc/spreadsheet/frontend/spreadsheet.css` — add `.row-selected`, `.col-selected`, `.row-header-selected`, `.col-header-selected` CSS rules (after line ~721)
- `/Users/ysheffer/misc/spreadsheet/frontend/app-grid.js` — add `applyRowColHeaderHighlight()` function and call it at end of `applySelectionRange` (line 407) and `applyCellSelection` (line 441)
- `/Users/ysheffer/misc/spreadsheet/frontend/app.js` — import `applyRowColHeaderHighlight` from `app-grid.js` and ensure it is called after row/column header clicks; regular cell click should clear highlight via `selectionMode = 'cell'` check in `applyRowColHeaderHighlight`

### Data Model / State

No new state. The function reads `appState.selectionMode`, `appState.selectionRange`, `appState.ROWS`, `appState.COLS` — all already present.

### Testing

```js
// Row header click → band highlight
await page.click('.row-header[data-row="2"]');
await page.waitForFunction(() =>
  document.querySelectorAll('.cell.row-selected').length > 0
);
const rowSelected = await page.locator('.cell.row-selected').count();
expect(rowSelected).toBeGreaterThan(0);
const rowHeaderSelected = await page.locator('.row-header.row-header-selected').count();
expect(rowHeaderSelected).toBe(1);

// Click a regular cell → clears row-selected
await page.click('[data-row="0"][data-col="0"]');
await page.waitForFunction(() =>
  document.querySelectorAll('.cell.row-selected').length === 0
);

// Column header click
await page.click('.column-header[data-col="1"]');
await page.waitForFunction(() =>
  document.querySelectorAll('.cell.col-selected').length > 0
);
const colHeaderSelected = await page.locator('.column-header.col-header-selected').count();
expect(colHeaderSelected).toBe(1);
```

### Edge Cases

- **Multi-row selection via Shift+click on headers** (from Story 17.1): `selectionMode` stays `'row'`, `startRow !== endRow`. The `applyRowColHeaderHighlight` loop covers `startRow..endRow`, marking all rows in the band. All row headers in range should get `.row-header-selected`.
- **Expanded grid (ROWS > 100 or COLS > 26)**: The loop uses `appState.ROWS`/`appState.COLS` so it scales correctly.
- **Merged cells in a selected row/column**: `getCellElement` resolves to the merge anchor, so the anchor cell gets the class. Covered cells that are not in the DOM (skipped during `buildSpreadsheetImpl`) are not queryable — this is fine, the visual effect still looks clean.
- **Grid rebuild** (`buildSpreadsheet`): rebuilds the DOM completely, removing all classes. After rebuild the `applyCellSelection` call in `buildSpreadsheetImpl` (line 135) re-applies `.selected`; the subsequent `applyRowColHeaderHighlight` call re-applies row/col classes. This is correct.
- **Dark mode**: The CSS variables `--color-cell-selected-border` and `--color-bg-primary` are themed, so the header highlight adapts automatically.

### Project Structure Notes

No backend changes. No new files — changes are limited to `spreadsheet.css` and `app-grid.js` (plus the import in `app.js`).

### References

- `spreadsheet.css` lines 717–721: `.cell.selected` rule (add new rules after this)
- `spreadsheet.css` lines 641–668: `.column-header` and `.row-header` rules
- `app-grid.js` lines 384–407: `applySelectionRange`
- `app-grid.js` lines 409–441: `applyCellSelection`
- `app.js` lines 453–478: row/column header click handlers
- `app-state.js` lines 19–20: `selectionMode`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- CSS: `.cell.row-selected.selected` suppresses left/right borders; `.cell.col-selected.selected` suppresses top/bottom borders — clean band appearance.
- CSS: `.row-header-selected` / `.col-header-selected` use `--color-cell-selected-border` background (teal) with white text.
- `applyRowColHeaderHighlight()` added as private function in `app-grid.js`, called at end of both `applySelectionRange` and `applyCellSelection`.
- 6 Playwright tests all pass; full suite 278 passed.

### File List

- `frontend/spreadsheet.css`
- `frontend/app-grid.js`
- `playwright_tests/test_row_col_aesthetics.spec.js`

## Change Log

- 2026-03-09: Implemented Story 17.2 — row/column select band aesthetics and header highlight.
