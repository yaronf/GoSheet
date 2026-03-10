# Story 17.5: Open-Ended Row/Column Range Selection

Status: done

## Story

As a user,
I want row and column selections to use open-ended ranges (like Excel's `1:3` or `A:C`),
So that the selection always spans the full row/column regardless of how large the grid grows.

## Acceptance Criteria

1. Given a user clicks a row header, when the selection is applied, then `appState.selectionRange` stores an open-ended row range represented by `endCol: Infinity` (all columns), and the address box shows `1:1` (row number only, no column letters).

2. Given a user clicks a column header, when the selection is applied, then `appState.selectionRange` stores an open-ended column range represented by `endRow: Infinity` (all rows), and the address box shows `A:A` (column letter only, no row numbers).

3. Given an open-ended row range `1:3` is active, when the grid expands (new rows/columns added via scroll), then the row highlight automatically covers all columns in the new grid without any re-application logic.

4. Given an open-ended column range `A:C` is active, when the grid expands, then the column highlight automatically covers all rows in the new grid without any re-application logic.

5. Given a row or column range is active, when the address box is updated, then it shows Excel-style notation: `1:1` for a single row, `2:5` for rows 2–5, `A:A` for a single column, `B:D` for columns B–D.

## Tasks / Subtasks

- [x] Task 1: Introduce open-ended range sentinel and update `applySelectionRange` (AC: 3, 4)
  - [x] Export a sentinel constant `OPEN_END = Infinity` from `app-state.js`
  - [x] Update `applySelectionRange` in `app-grid.js`: when `endCol === OPEN_END`, iterate `c` from `startCol` to `appState.COLS - 1`; when `endRow === OPEN_END`, iterate `r` from `startRow` to `appState.ROWS - 1`
  - [x] Remove `reapplyHeaderSelection()` function and its two call sites (scroll expansion and `expandGridIfNeeded`) — no longer needed since open-ended ranges self-resolve at render time

- [x] Task 2: Update row header click to use open-ended range (AC: 1, 3)
  - [x] In `app.js` row header click handler: change `applySelectionRange(row, 0, row, appState.COLS - 1)` to `applySelectionRange(row, 0, row, OPEN_END)`
  - [x] Same for shift-click row extension: use `OPEN_END` for `endCol`

- [x] Task 3: Update column header click to use open-ended range (AC: 2, 4)
  - [x] In `app.js` column header click handler: change `applySelectionRange(0, col, appState.ROWS - 1, col)` to `applySelectionRange(0, col, OPEN_END, col)`
  - [x] Same for shift-click column extension: use `OPEN_END` for `endRow`

- [x] Task 4: Update `updateFormulaBar` to show Excel-style notation (AC: 5)
  - [x] In `app-grid.js::updateFormulaBar`, detect open-ended ranges:
    - If `selectionMode === 'row'`: show `${startRow + 1}:${endRow + 1}` (or `${startRow + 1}:${endRow + 1}` where endRow is resolved from actual range, not Infinity)
    - If `selectionMode === 'column'`: show `${colToLetter(startCol)}:${colToLetter(endCol)}`
    - Otherwise: existing cell/range logic unchanged

- [x] Task 5: Guard downstream code that uses `endRow`/`endCol` directly (AC: 3, 4)
  - [x] In `selectionOverlapsMerge`: resolve `OPEN_END` to `appState.ROWS - 1` / `appState.COLS - 1` before comparison
  - [x] In `updateMergeMenuState`: resolve `OPEN_END` before computing `cellCount`
  - [x] In `buildSelectionAnnouncement`: resolve `OPEN_END` before building string (via resolved values passed from `applySelectionRange`)
  - [x] In `Shift+Arrow` handler (`app-cell-editor.js`): skip Shift+Arrow extension when `selectionMode` is `'row'` or `'column'` (open-ended ranges don't extend via keyboard)
  - [x] Search for any other direct use of `selectionRange.endRow` / `selectionRange.endCol` and guard accordingly (fixed `applyAlignmentToSelection`, merge handler, `applyStyleToSelection`)

- [x] Task 6: Playwright tests (AC: 1–5)
  - [x] Row header click: verify `#cell-ref` shows `1:1`
  - [x] Column header click: verify `#cell-ref` shows `A:A`
  - [x] Multi-row shift-click: click row 1 header, shift-click row 3 header, verify `#cell-ref` shows `1:3`
  - [x] Multi-col shift-click: click col A header, shift-click col C header, verify `#cell-ref` shows `A:C`
  - [x] Verify all cells in the selected row/column have `.selected` class (not just up to old COLS/ROWS boundary)

## Dev Notes

### Current State

Row/column selections currently store bounded ranges: `applySelectionRange(row, 0, row, appState.COLS - 1)`. When the grid expands, `appState.COLS` changes but the stored `endCol` is the old value — so the selection becomes stale. Story 17.1 added `reapplyHeaderSelection()` as a workaround, but it fires async after grid rebuild and can cause a flash.

The correct fix is to store `endCol: Infinity` for row selections and `endRow: Infinity` for column selections, and resolve them at render time in `applySelectionRange`.

### Implementation Approach

**Sentinel constant** — add to `app-state.js`:
```js
export const OPEN_END = Infinity;
```

**`applySelectionRange` update** — resolve open ends before iterating:
```js
export function applySelectionRange(startRow, startCol, endRow, endCol) {
  appState.selectionRange = { startRow, startCol, endRow, endCol };
  appState.selectedCell = { row: startRow, col: startCol };
  const resolvedEndRow = endRow === Infinity ? appState.ROWS - 1 : endRow;
  const resolvedEndCol = endCol === Infinity ? appState.COLS - 1 : endCol;
  document.querySelectorAll('.cell.selected').forEach((el) => { ... });
  for (let r = startRow; r <= resolvedEndRow; r++) {
    for (let c = startCol; c <= resolvedEndCol; c++) { ... }
  }
  updateFormulaBar(startRow, startCol);
  ...
}
```

**`updateFormulaBar` address box**:
```js
if (appState.selectionMode === 'row') {
  const r1 = startRow + 1;
  const r2 = (endRow === Infinity ? appState.selectionRange.endRow : endRow); // endRow is already resolved
  // Actually use the stored endRow from appState:
  const storedEnd = appState.selectionRange.endRow;
  const r2Display = storedEnd === Infinity ? startRow + 1 : storedEnd + 1; // single row if same
  cellRef.textContent = startRow === (storedEnd === Infinity ? startRow : storedEnd)
    ? `${startRow + 1}:${startRow + 1}`
    : `${startRow + 1}:${storedEnd + 1}`;
} else if (appState.selectionMode === 'column') {
  const storedEndCol = appState.selectionRange.endCol;
  cellRef.textContent = startCol === (storedEndCol === Infinity ? startCol : storedEndCol)
    ? `${colToLetter(startCol)}:${colToLetter(startCol)}`
    : `${colToLetter(startCol)}:${colToLetter(storedEndCol)}`;
}
```

Simpler: just use `appState.selectionRange` directly since we set it at the top:
```js
const { startRow, startCol, endRow, endCol } = appState.selectionRange;
if (appState.selectionMode === 'row') {
  const r2 = endRow === Infinity ? startRow : endRow;
  cellRef.textContent = `${startRow + 1}:${r2 + 1}`;
  // formula bar: leave empty for full-row selection (no single anchor cell raw value)
  formulaBar.value = '';
  return;
} else if (appState.selectionMode === 'column') {
  const c2 = endCol === Infinity ? startCol : endCol;
  cellRef.textContent = `${colToLetter(startCol)}:${colToLetter(c2)}`;
  formulaBar.value = '';
  return;
}
```

### Key Files to Modify

- `frontend/app-state.js` — add `export const OPEN_END = Infinity`
- `frontend/app-grid.js` — update `applySelectionRange`, `updateFormulaBar`, `selectionOverlapsMerge`, `updateMergeMenuState`, `buildSelectionAnnouncement`; remove `reapplyHeaderSelection`
- `frontend/app.js` — update row/column header click handlers to use `OPEN_END`
- `frontend/app-cell-editor.js` — guard Shift+Arrow for row/column mode

### Data Model / State

`appState.selectionRange` will now store `Infinity` for open ends:
- Row selection: `{ startRow: r, startCol: 0, endRow: r, endCol: Infinity }`
- Multi-row: `{ startRow: r1, startCol: 0, endRow: r2, endCol: Infinity }`
- Column selection: `{ startRow: 0, startCol: c, endRow: Infinity, endCol: c }`
- Multi-col: `{ startRow: 0, startCol: c1, endRow: Infinity, endCol: c2 }`
- Cell/range: unchanged (finite values)

### Dependencies

- Depends on Story 17.1 (completed) for the row/column header click infrastructure

### References

- `app-state.js` lines 5–32: appState, EXPAND_THRESHOLD, EXPAND_ROWS, EXPAND_COLS
- `app-grid.js` lines 355–370: `reapplyHeaderSelection`, `expandGridIfNeeded` (to remove reapply call)
- `app-grid.js` lines 384–407: `applySelectionRange` (to update)
- `app-grid.js` lines 463–477: `selectionOverlapsMerge` (to guard)
- `app-grid.js` lines 480–509: `updateMergeMenuState` (to guard)
- `app-grid.js` lines 524–540: `updateFormulaBar` (to update)
- `app.js` lines 453–500: row/column header click handlers (to update)
- `app-cell-editor.js`: Shift+Arrow handler (to guard)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Introduced `OPEN_END = Infinity` sentinel in `app-state.js`; `applySelectionRange` resolves it at render time against current `ROWS/COLS`
- Removed `reapplyHeaderSelection()` and both call sites — open-ended ranges are self-healing after grid expansion
- Row/column header clicks now store `OPEN_END` instead of a snapshot of `COLS-1`/`ROWS-1`
- `updateFormulaBar` shows Excel-style `1:1` / `A:A` / `1:3` / `A:C` for row/column modes
- Guarded all downstream consumers: `selectionOverlapsMerge`, `updateMergeMenuState`, `applyAlignmentToSelection`, `applyStyleToSelection`, merge handler, `handleShiftArrow`; `JSON.stringify(Infinity) === null` risk eliminated
- `Shift+Arrow` no-ops when `selectionMode` is `'row'` or `'column'`
- 6 new Playwright tests in `test_open_ended_ranges.spec.js` — all pass; full suite: 292 passed

### File List

- frontend/app-state.js
- frontend/app-grid.js
- frontend/app.js
- frontend/app-cell-editor.js
- frontend/app-file-ops.js
- frontend/app-ui.js
- playwright_tests/test_open_ended_ranges.spec.js
- playwright_tests/test_copy_paste_range.spec.js
- _bmad-output/implementation-artifacts/17-5-open-ended-row-column-ranges.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
