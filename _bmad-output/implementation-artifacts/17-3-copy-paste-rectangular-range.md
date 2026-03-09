# Story 17.3: Copy/Paste Rectangular Range

Status: done

## Dependencies

- Story 17.1 (Range Selection — Shift-Click and Drag): `applySelectionRange` and `appState.selectionRange` must be in place so the copy helper can read the full selection bounds.

## Story

As a user,
I want to copy a selected range and paste it to another location,
So that I can duplicate blocks of data efficiently.

## Acceptance Criteria

1. Given a rectangular range is selected, when the user presses Cmd+C (or Edit → Copy), then all cell values in the range are copied to the clipboard as tab-separated values (TSV) with newlines between rows.

2. Given the clipboard contains a copied range (TSV), when the user selects a target cell and presses Cmd+V (or Edit → Paste), then the range is pasted starting at the target cell, filling rightward and downward to match the copied dimensions.

3. Given a single row is selected and copied, when pasted at a target cell, then the row data fills horizontally from the target cell.

4. Given a single column is selected and copied, when pasted at a target cell, then the column data fills vertically from the target cell.

5. Given the pasted range would extend beyond the current grid dimensions, when the paste occurs, then the grid expands to accommodate the pasted data (calls `expandGridIfNeeded`).

6. Given a single cell is selected, when Cmd+C is pressed, then the single-cell raw value is copied (existing behaviour preserved — backward compatible).

7. Given the user presses Cmd+X (Cut), when cutting a single cell, the existing single-cell cut behaviour is preserved. Multi-cell cut is out of scope for this story (leave a clear TODO comment).

## Tasks / Subtasks

- [x] Task 1: Implement range copy to TSV in `app-file-ops.js` (AC: 1, 3, 4, 6)
  - [x] Extract a new helper `copySelectionToClipboard()` called by `onMenuCopy`
  - [x] When `selectionRange` covers more than one cell: fetch raw values via parallel `GetCellRawValue`, build TSV string, write to clipboard
  - [x] When single cell: existing `GetCellRawValue` + `navigator.clipboard.writeText` (preserve backward compat)
  - [x] Use `Promise.all` for parallel fetches
  - [x] TSV format: `row1col1\trow1col2\nrow2col1\trow2col2`

- [x] Task 2: Implement TSV paste logic in `app-file-ops.js` (AC: 2, 3, 4, 5)
  - [x] Extract a new helper `pasteFromClipboard()` called by `onMenuPaste`
  - [x] Read clipboard text, split by `\n` to get rows, split each row by `\t` to get cells
  - [x] Starting from `appState.selectedCell`, call `SetCellValue` for each cell in the parsed grid
  - [x] Determine final row/col bounds and call `expandGridIfNeeded` before pasting
  - [x] After all `SetCellValue` calls complete: call `refreshAllCells()`, `updateFileStatus()`, `applyUndoRedoState`
  - [x] For single-cell clipboard content: fall through to single-cell paste (backward compat)

- [x] Task 3: Wire Cmd+C / Cmd+V keyboard shortcuts (AC: 1, 2)
  - [x] Cmd+C/V handled exclusively via Electron menu accelerators to avoid double-trigger (no DOM keydown handler added)
  - [x] Electron menu `onMenuCopy` / `onMenuPaste` call the new helpers

- [x] Task 4: Context menu copy/paste (AC: 1, 2)
  - [x] `handleContextMenuCopy()` and `handleContextMenuPaste()` in `app-ui.js` delegate to the new helpers
  - [x] Helpers exported from `app-file-ops.js`; imported in `app-ui.js`

- [x] Task 5: Playwright tests (AC: 1, 2, 5, 6)
  - [x] 2×2 range copy/paste verified (D1:E2)
  - [x] Single cell backward compat verified
  - [x] Grid expansion on paste verified (row 101 created)

## Dev Notes

### Current State

**Copy**: The `onMenuCopy` handler in `app-file-ops.js` (line 311) copies only `appState.selectedCell` (the anchor), not the full selection range:
```js
const { row, col } = appState.selectedCell;
const value = await GetCellRawValue(row, col);
await navigator.clipboard.writeText(value);
```
This ignores `appState.selectionRange` entirely.

**Paste**: `onMenuPaste` (line 324) pastes only to `appState.selectedCell`:
```js
const { row, col } = appState.selectedCell;
const text = await navigator.clipboard.readText();
await SetCellValue(row, col, text);
```
No TSV parsing; single value only.

**Context menu**: `handleContextMenuCopy` (app-ui.js line 313) and `handleContextMenuPaste` (app-ui.js line 322) have the same single-cell limitation.

**GetCellRawValue** is already in `api-client.js` and used throughout. For a range of N×M cells, N×M parallel IPC/HTTP calls are needed; this is acceptable for typical spreadsheet ranges.

### Implementation Approach

Add two new exported functions to `app-file-ops.js`:

```js
export async function copySelectionToClipboard() {
  const { startRow, startCol, endRow, endCol } = appState.selectionRange;
  if (startRow === endRow && startCol === endCol) {
    // Single cell — existing fast path
    const value = await GetCellRawValue(startRow, startCol);
    await navigator.clipboard.writeText(value);
    return;
  }
  // Build parallel fetch matrix
  const rowPromises = [];
  for (let r = startRow; r <= endRow; r++) {
    const colPromises = [];
    for (let c = startCol; c <= endCol; c++) {
      colPromises.push(GetCellRawValue(r, c));
    }
    rowPromises.push(Promise.all(colPromises));
  }
  const rows = await Promise.all(rowPromises);
  const tsv = rows.map(row => row.join('\t')).join('\n');
  await navigator.clipboard.writeText(tsv);
}

export async function pasteFromClipboard() {
  if (!appState.selectedCell) return;
  const text = await navigator.clipboard.readText();
  if (!text) return;

  const { row: targetRow, col: targetCol } = appState.selectedCell;
  const parsedRows = text.split('\n').filter(r => r !== '');

  if (parsedRows.length === 1 && !parsedRows[0].includes('\t')) {
    // Single cell paste — existing behaviour
    const result = await SetCellValue(targetRow, targetCol, parsedRows[0]);
    window.applyUndoRedoState?.(result);
    await window.refreshAllCells?.();
    window.updateFileStatus?.();
    return;
  }

  // Multi-cell TSV paste
  const maxPasteRow = targetRow + parsedRows.length - 1;
  const maxPasteCol = targetCol + Math.max(...parsedRows.map(r => r.split('\t').length)) - 1;
  expandGridIfNeeded(maxPasteRow, maxPasteCol);

  const setCellCalls = [];
  let lastResult = null;
  for (let ri = 0; ri < parsedRows.length; ri++) {
    const cells = parsedRows[ri].split('\t');
    for (let ci = 0; ci < cells.length; ci++) {
      const r = targetRow + ri;
      const c = targetCol + ci;
      setCellCalls.push(
        SetCellValue(r, c, cells[ci]).then(result => { lastResult = result; })
      );
    }
  }
  await Promise.all(setCellCalls);
  if (lastResult) window.applyUndoRedoState?.(lastResult);
  await window.refreshAllCells?.();
  window.updateFileStatus?.();
}
```

**Note on parallel SetCellValue calls**: `SetCellValue` calls are sent in parallel via `Promise.all`. The Go backend uses `sync.RWMutex` — each call acquires the write lock sequentially. This is safe but may result in non-deterministic undo history order for large pastes. For this story, the tradeoff is acceptable; a future improvement could be a `POST /api/range/set` batch endpoint.

**Import `expandGridIfNeeded`** in `app-file-ops.js`:
```js
import { ..., expandGridIfNeeded } from './app-grid.js';
```

Update `onMenuCopy`, `onMenuPaste` in `setupEditMenuListeners` to call the new helpers instead of inline logic.

Update `handleContextMenuCopy` and `handleContextMenuPaste` in `app-ui.js` to import and call the new helpers.

Update the global keydown handler in `app.js` to call these helpers for Cmd+C/V when not editing.

### Key Files to Modify

- `/Users/ysheffer/misc/spreadsheet/frontend/app-file-ops.js` — add `copySelectionToClipboard()` and `pasteFromClipboard()` exports; update `onMenuCopy`/`onMenuPaste` to use them; add `expandGridIfNeeded` to imports from `app-grid.js` (line 30)
- `/Users/ysheffer/misc/spreadsheet/frontend/app-ui.js` — update `handleContextMenuCopy` (line 313) and `handleContextMenuPaste` (line 322) to use the new helpers
- `/Users/ysheffer/misc/spreadsheet/frontend/app.js` — add Cmd+C / Cmd+V to the global keydown handler (lines 503–516); import `copySelectionToClipboard` and `pasteFromClipboard` from `app-file-ops.js`

### Data Model / State

No backend schema changes. All logic is in the frontend.

The clipboard format is plain-text TSV:
- Rows separated by `\n`
- Columns separated by `\t`
- Trailing newlines stripped before parsing

This format is compatible with Excel and Google Sheets clipboard — a user can paste from those apps into GoSheet and vice versa.

### Testing

```js
// Multi-cell copy/paste
// Set cell values via the Go HTTP API (window.electronAPI.setCellValue does not exist;
// use fetch against the backend port stored in window.__GOSHEET_PORT__)
await page.evaluate(async () => {
  const port = window.__GOSHEET_PORT__;
  const set = (row, col, val) =>
    fetch(`http://localhost:${port}/api/cell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row, col, value: val }),
    });
  await Promise.all([
    set(0, 0, 'hello'),
    set(0, 1, 'world'),
    set(1, 0, 'foo'),
    set(1, 1, 'bar'),
  ]);
});
await page.evaluate(() => window.refreshAllCells?.());
// Select A1:B2
await page.click('[data-row="0"][data-col="0"]');
await page.click('[data-row="1"][data-col="1"]', { modifiers: ['Shift'] });
// Copy
await page.keyboard.press('Meta+C');
// Select D1 as paste target
await page.click('[data-row="0"][data-col="3"]');
// Paste
await page.keyboard.press('Meta+V');
await page.waitForFunction(() => {
  const d1 = document.getElementById('cell-0-3');
  return d1 && d1.textContent.trim() !== '';
});
// Verify D1:E2
const d1 = await page.locator('#cell-0-3').textContent();
expect(d1.trim()).toBe('hello');
const e1 = await page.locator('#cell-0-4').textContent();
expect(e1.trim()).toBe('world');

// Single-cell backward compat
await page.click('[data-row="0"][data-col="0"]');
await page.keyboard.press('Meta+C');
await page.click('[data-row="5"][data-col="5"]');
await page.keyboard.press('Meta+V');
await page.waitForFunction(() =>
  document.getElementById('cell-5-5')?.textContent?.trim() !== ''
);
```

### Edge Cases

- **Cells with tabs or newlines in values**: Raw values from the formula engine should not contain literal `\t` or `\n`. If they do, TSV will be malformed. For now, treat this as acceptable — a future improvement can add RFC 4180 CSV quoting.
- **Read-only mode**: Guard `pasteFromClipboard` with `if (appState.isReadOnly) return;`.
- **Formula cells**: `GetCellRawValue` returns the raw formula string (e.g. `=SUM(A1:A3)`). When pasted to a new location, formulas paste as-is (absolute references may be wrong). Story 17.3 does not handle formula reference adjustment on paste — add a comment `// TODO: Adjust relative formula references on paste (Epic 18 scope)`.
- **Merged cells in source range**: `getCellElement` resolves to anchor; but `GetCellRawValue(r, c)` where (r, c) is a covered cell will return the anchor's value (Go backend calls `ResolveToAnchor`). This is the correct behaviour.
- **Empty clipboard**: Guard with `if (!text) return;`.
- **Clipboard permission denied**: Wrap in try/catch and show a `showAlert` with the error.
- **Very large paste** (e.g. paste 1000-row TSV from Excel): The parallel `SetCellValue` calls will hammer the Go HTTP server. A future `POST /api/range/set` batch endpoint would fix this. Leave a `// TODO` comment.

### Project Structure Notes

No new files. No backend changes. The Go backend already handles `SetCellValue` per cell; no new endpoints needed for this story.

The `expandGridIfNeeded` function in `app-grid.js` (line 357) currently calls `buildSpreadsheet().then(() => refreshAllCells())` asynchronously inside itself if expansion is needed, but returns synchronously. The paste function should call it before issuing `SetCellValue` calls — if expansion happens, the grid DOM rebuilds, which is fine since `SetCellValue` only writes to the model.

### References

- `app-file-ops.js` lines 282–338: `setupEditMenuListeners` — `onMenuCopy`, `onMenuPaste` (to replace)
- `app-ui.js` lines 313–332: `handleContextMenuCopy`, `handleContextMenuPaste` (to replace)
- `app.js` lines 503–516: global keydown handler (to add Cmd+C/V)
- `app-grid.js` lines 357–370: `expandGridIfNeeded`
- `api-client.js`: `GetCellRawValue`, `SetCellValue` (already imported)
- `controller/app.go` line 29: `SetCellValue` — uses write mutex, serial execution

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `frontend/app-file-ops.js` — added `copySelectionToClipboard()`, `pasteFromClipboard()`; updated `onMenuCopy`, `onMenuPaste`, `onMenuCut` (TODO comment); added `expandGridIfNeeded` import; post-review: Infinity guard (L1), M2/M3 TODOs, `applyUndoRedoState` direct calls (L3)
- `frontend/app-ui.js` — inlined `handleContextMenuCopy/Paste` wrappers into `dispatchContextMenuAction` (L2); removed unused imports
- `frontend/app.js` — Cmd+C/V/X removed from DOM keydown handler (H2 fix; handled exclusively via Electron menu)
- `playwright_tests/test_copy_paste_range.spec.js` — 6 tests: range paste, single cell compat, address box, single row (AC3), single column (AC4), grid expansion
