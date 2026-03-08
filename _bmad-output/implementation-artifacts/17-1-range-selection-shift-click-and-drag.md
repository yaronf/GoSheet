# Story 17.1: Range Selection — Shift-Click and Drag

Status: review

## Story

As a user,
I want to select a rectangular range of cells by shift-clicking or dragging,
So that I can work with multiple cells at once without clicking each one individually.

## Acceptance Criteria

1. Given a user clicks a cell then shift-clicks another cell, when the shift-click is registered, then the rectangular range between the two cells is selected and visually highlighted, and the range address is shown in the address box (e.g. `A1:D7`).

2. Given a user clicks and drags across cells, when the drag completes, then the rectangle swept by the drag is selected, and the selection updates live as the drag proceeds (mousemove updates highlight in real-time).

3. Given a range is selected, when the user presses an arrow key (without Shift), then the selection collapses to a single cell in the arrow direction from the anchor cell.

4. Given a row or column header is clicked, when the click is registered, then the entire row or column is selected, and shift-clicking a second header extends the selection to cover both rows/columns.

5. Given any multi-cell range is selected, when the selection changes, then the address box (`#cell-ref`) updates to show the range (e.g. `A1:D7` or just `B3` for single cell).

## Tasks / Subtasks

- [x] Task 1: Implement drag selection on the grid table (AC: 2)
  - [x] Add `mousedown` handler on `#spreadsheet` that records drag-start cell
  - [x] Add `mousemove` handler (on `document` to handle fast movement) during drag that calls `applyCellSelection` with live range
  - [x] Add `mouseup` handler on `document` that finalises drag and removes listeners
  - [x] Guard: skip drag when clicking `.cell-editor` or when `appState.isEditing`
  - [x] Guard: skip drag when clicking row/column headers (those have their own handling)
  - [x] Store drag state in a module-level variable: `let dragState = null` with `{ startRow, startCol, active: true }`

- [x] Task 2: Update `updateFormulaBar` to show range address for multi-cell selections (AC: 1, 5)
  - [x] In `app-grid.js::updateFormulaBar`, when `startRow !== endRow || startCol !== endCol`, set `cellRef.textContent` to `A1:D7` style string using `colToLetter` instead of calling `GetCellRef`
  - [x] For single cell, keep existing `GetCellRef` call behaviour

- [x] Task 3: Shift+arrow key range extension in `handleKeydownCellNavigation` (AC: 3)
  - [x] In `app-cell-editor.js::handleKeydownCellNavigation`, detect `e.shiftKey` on arrow keys
  - [x] When Shift+Arrow: move only the _end_ of the selection (not the anchor), calling `applySelectionRange` with updated end corner
  - [x] When plain Arrow (no Shift): collapse to single cell at anchor, then move one step (confirmed via test)

- [x] Task 4: Shift-click on row/column headers extends header selection (AC: 4)
  - [x] In `app.js` table click handler: if `e.shiftKey` and `selectionMode === 'row'`, extend row range with `applySelectionRange`
  - [x] Similarly for `selectionMode === 'column'`

- [x] Task 5: Playwright tests (AC: 1–5)
  - [x] Shift-click test: click A1, shift-click C3, verify 9 cells have `.selected` class
  - [x] Drag test: mouse.down A1, mouse.move to B2, mouse.up, verify 4 cells selected
  - [x] Arrow key collapse test: select range A1:C3, press ArrowRight, verify only B1 selected
  - [x] Shift+Arrow extend test: select A1, shift+ArrowRight twice, verify A1:C1 selected (3 cells)
  - [x] Address box test: shift-click to select A1:B2, verify `#cell-ref` text is `A1:B2`

## Dev Notes

### Current State

`app-grid.js` already has `computeSelectionRange` (line 372) and `applyCellSelection` (line 409) which handle rectangular range highlighting. `selectCell` (line 512) accepts an `extendSelection` boolean and is already called with `e.shiftKey` on regular cell click (app.js line 484).

The existing shift-click path already works for single-step shifts. What is missing:
- **Click-drag**: no `mousedown`/`mousemove`/`mouseup` drag handlers exist at all
- **Range address box**: `updateFormulaBar` (app-grid.js line 524) always calls `GetCellRef` which returns a single-cell reference; it must be updated to render `A1:D7` for ranges
- **Shift+Arrow**: `handleKeydownCellNavigation` in `app-cell-editor.js` does not handle `e.shiftKey` on arrow keys
- **Shift-click on headers**: the row/column header click handler in `app.js` (lines 453–478) ignores `e.shiftKey`

### Implementation Approach

**Drag selection** — add to `app.js` after the existing `table.addEventListener('click', ...)` block:

```js
// Drag-to-select state
let dragState = null;

table.addEventListener('mousedown', (e) => {
  if (appState.isEditing) return;
  const cell = e.target.closest('.cell');
  if (!cell) return; // row/col headers handled separately
  const row = parseInt(cell.dataset.row, 10);
  const col = parseInt(cell.dataset.col, 10);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return;
  dragState = { startRow: row, startCol: col };
  // selectCell sets the anchor
  selectCell(row, col, false);
  e.preventDefault(); // prevent text-selection cursor
});

document.addEventListener('mousemove', (e) => {
  if (!dragState) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return;
  const cell = el.closest('.cell');
  if (!cell) return;
  const row = parseInt(cell.dataset.row, 10);
  const col = parseInt(cell.dataset.col, 10);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return;
  // Extend selection from drag origin to current position
  const startRow = Math.min(dragState.startRow, row);
  const endRow   = Math.max(dragState.startRow, row);
  const startCol = Math.min(dragState.startCol, col);
  const endCol   = Math.max(dragState.startCol, col);
  applySelectionRange(startRow, startCol, endRow, endCol);
});

document.addEventListener('mouseup', () => {
  dragState = null;
});
```

**Range address box** — change `updateFormulaBar` in `app-grid.js` (line 524):

```js
export async function updateFormulaBar(row, col) {
  const cellRef = document.getElementById('cell-ref');
  const formulaBar = document.getElementById('formula-bar');
  if (!cellRef || !formulaBar) return;

  const { startRow, startCol, endRow, endCol } = appState.selectionRange;
  const isRange = startRow !== endRow || startCol !== endCol;
  if (isRange) {
    cellRef.textContent =
      `${colToLetter(startCol)}${startRow + 1}:${colToLetter(endCol)}${endRow + 1}`;
  } else {
    const ref = await GetCellRef(row, col);
    cellRef.textContent = ref;
  }

  const rawValue = await GetCellRawValue(row, col);
  formulaBar.value = rawValue || '';
}
```

**Shift+Arrow** — in `app-cell-editor.js::handleKeydownCellNavigation`, add before existing arrow handling:

```js
if (e.shiftKey && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
  e.preventDefault();
  const { startRow, startCol, endRow, endCol } = appState.selectionRange;
  // Move the "end" corner of the selection
  let newEndRow = endRow, newEndCol = endCol;
  if (e.key === 'ArrowDown' && endRow < appState.ROWS - 1) newEndRow++;
  if (e.key === 'ArrowUp'   && endRow > startRow)           newEndRow--;
  if (e.key === 'ArrowRight'&& endCol < appState.COLS - 1) newEndCol++;
  if (e.key === 'ArrowLeft' && endCol > startCol)           newEndCol--;
  applySelectionRange(startRow, startCol, newEndRow, newEndCol);
  return true;
}
```

Note: the anchor of the range stays fixed; only the trailing corner moves. This matches Excel/Google Sheets behaviour.

### Key Files to Modify

- `/Users/ysheffer/misc/spreadsheet/frontend/app.js` — add `mousedown`/`mousemove`/`mouseup` drag handlers (after line 499); update shift-click header extension (lines 453–478)
- `/Users/ysheffer/misc/spreadsheet/frontend/app-grid.js` — update `updateFormulaBar` (lines 524–532) to emit range address for multi-cell selections
- `/Users/ysheffer/misc/spreadsheet/frontend/app-cell-editor.js` — add Shift+Arrow handling in `handleKeydownCellNavigation`

### Data Model / State

No new backend state. Frontend-only changes.

New module-level variable in `app.js`:
```js
let dragState = null; // { startRow: number, startCol: number } | null
```

`appState.selectionRange` (already present in `app-state.js`) stores `{ startRow, startCol, endRow, endCol }`.

`appState.selectionMode` (already `'cell' | 'row' | 'column'`) needs no extension.

### Testing

All Playwright, no sleeps — use `waitForFunction` or `waitForSelector`.

```js
// Shift-click: A1 → shift-click C3
await page.click('[data-row="0"][data-col="0"]');
await page.click('[data-row="2"][data-col="2"]', { modifiers: ['Shift'] });
const selected = await page.locator('.cell.selected').count();
expect(selected).toBe(9);
const addrBox = await page.locator('#cell-ref').textContent();
expect(addrBox).toBe('A1:C3');

// Drag: simulate mousedown on A1, mousemove to B2, mouseup
await page.dispatchEvent('[data-row="0"][data-col="0"]', 'mousedown');
await page.dispatchEvent('[data-row="1"][data-col="1"]', 'mousemove');
await page.dispatchEvent('document', 'mouseup');
expect(await page.locator('.cell.selected').count()).toBe(4);

// Shift+ArrowRight twice from A1
await page.click('[data-row="0"][data-col="0"]');
await page.keyboard.press('Shift+ArrowRight');
await page.keyboard.press('Shift+ArrowRight');
expect(await page.locator('.cell.selected').count()).toBe(3); // A1:C1
```

Use `page.waitForFunction(() => document.querySelectorAll('.cell.selected').length === N)` if the DOM update is async.

### Edge Cases

- **Drag outside table**: `mousemove` handler uses `document.elementFromPoint`; if the pointer leaves the table area, `cell` will be null — just return without changing selection.
- **Drag with Shift key held**: treat as normal drag (drag anchor wins over shift-click anchor).
- **Drag to covered merge cell**: the `resolveToAnchor` call within `getCellElement` handles this; drag boundaries should resolve to anchor cells.
- **Shift+Arrow at grid boundary**: cap at `appState.ROWS-1` / `appState.COLS-1`; do not trigger grid expansion during Shift+Arrow (expansion only on navigation into new territory via `selectCell`).
- **RTL mode**: column direction visually reverses but `data-col` indices remain LTR; no special handling needed for drag/shift-click logic.
- **Shift-click while editing**: `selectCell` already guards `appState.isEditing` — saves current edit first.
- **Performance**: `mousemove` fires very frequently. `applySelectionRange` queries DOM for every cell in range. For large ranges (e.g. 100×26 = 2600 cells), this is acceptable; if not, debounce to `requestAnimationFrame`.

### Project Structure Notes

All changes are purely frontend. No backend changes required. The existing `applySelectionRange` function in `app-grid.js` (line 384) already handles clearing old `.selected` classes and applying new ones — use it directly from drag handlers.

Exports needed: `applySelectionRange` is already exported from `app-grid.js` and imported in `app.js` (line 27).

### References

- `app-grid.js` lines 372–441: `computeSelectionRange`, `applySelectionRange`, `applyCellSelection`
- `app-grid.js` lines 524–532: `updateFormulaBar` (to modify)
- `app.js` lines 446–499: existing click + dblclick + contextmenu handlers on `#spreadsheet`
- `app.js` lines 453–478: row/column header click handling (to extend with shift support)
- `app-state.js` lines 17–20: `selectionRange`, `selectionMode`
- `app-cell-editor.js`: `handleKeydownCellNavigation` (to extend with Shift+Arrow)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Drag selection implemented with `mousedown`/`mousemove`/`mouseup` in `app.js`; `e.preventDefault()` on mousedown prevents text-selection cursor.
- `updateFormulaBar` in `app-grid.js` updated: checks `appState.selectionRange` to emit `A1:D7`-style range address for multi-cell selections.
- Shift+Arrow added in `app-cell-editor.js::handleKeydownCellNavigation`; extends the end corner of the selection while the anchor stays fixed.
- Shift-click on row/column headers extends existing header selection; non-shift click replaces it.
- All 5 Playwright tests pass; drag test uses `page.mouse` for real pointer events.
- Full test suite: 271 passed, 1 pre-existing flaky unrelated test.

### File List

- `frontend/app.js`
- `frontend/app-grid.js`
- `frontend/app-cell-editor.js`
- `playwright_tests/test_range_selection.spec.js`

## Change Log

- 2026-03-09: Implemented Story 17.1 — drag selection, range address box, Shift+Arrow, shift-click header extension, 5 Playwright tests.
