# Story 19.6: Warn Before Pasting into Non-Empty Range

Status: done

## Story

As a user,
I want a confirmation dialog when pasting would overwrite existing cell content,
So that I don't accidentally lose data by pasting into the wrong location.

## Acceptance Criteria

1. **Given** the user copies a value and pastes it into a cell that already contains content, **when** Paste is triggered (Cmd+V or menu), **then** a confirmation dialog appears asking "Paste will overwrite existing content. Continue?" before the paste executes.

2. **Given** the user copies a multi-cell range and pastes it into a target where at least one destination cell is non-empty, **when** Paste is triggered, **then** a confirmation dialog appears before the paste executes.

3. **Given** the confirmation dialog appears and the user clicks Cancel (or presses Escape), **when** the dialog closes, **then** no paste operation occurs and the cells are unchanged.

4. **Given** the confirmation dialog appears and the user clicks OK, **when** the dialog closes, **then** the paste executes normally.

5. **Given** the paste target cells are all empty, **when** Paste is triggered, **then** no confirmation dialog appears — paste executes immediately (no unnecessary friction).

6. **Given** a single-cell paste into an empty cell OR a multi-cell paste where all target cells are empty, **when** Paste is triggered, **then** paste executes immediately without a dialog.

## Tasks / Subtasks

- [x] Task 1: Add `targetRangeHasContent(targetRow, targetCol, rows, cols)` helper in `frontend/app-file-ops.js` (AC: 5, 6)
  - [x] Use `GetAllCells()` (already imported) to get all cell data
  - [x] For each cell in the target rect, check if `raw !== ''`
  - [x] Return `true` if any target cell is non-empty, `false` otherwise

- [x] Task 2: Add overwrite check before single-cell paste in `pasteFromClipboard` (AC: 1, 3, 4, 5)
  - [x] Before `SetCellValue`, call `targetRangeHasContent(targetRow, targetCol, 1, 1)`
  - [x] If true, call `showConfirmDialog('Paste will overwrite existing content. Continue?')`
  - [x] If user cancels, return early

- [x] Task 3: Add overwrite check before multi-cell paste in `pasteFromClipboard` (AC: 2, 3, 4, 6)
  - [x] Before `SetRangeValues`, call `targetRangeHasContent(targetRow, targetCol, parsedRows.length, maxCols)`
  - [x] If true, show confirm dialog; return early if cancelled

- [x] Task 4: Write Playwright tests in `playwright_tests/test_paste_overwrite_warning.spec.js` (AC: 1–6)
  - [x] Test: paste into non-empty cell shows dialog
  - [x] Test: cancel dialog → no overwrite
  - [x] Test: confirm dialog → paste executes
  - [x] Test: paste into empty cell → no dialog, paste executes

- [x] Task 5: Run targeted tests
  - [x] `npm test -- --grep "paste overwrite|copy paste"` — all pass

## Dev Notes

### `GetAllCells` Return Format

From `api-client.js`: returns `{ ref: { display, raw, isError, styleId, alignment } }` where ref is `"row,col"` key.

```js
async function targetRangeHasContent(targetRow, targetCol, rows, cols) {
  const allCells = await GetAllCells();
  for (let r = targetRow; r < targetRow + rows; r++) {
    for (let c = targetCol; c < targetCol + cols; c++) {
      const key = `${r},${c}`;
      if (allCells[key]?.raw) return true;
    }
  }
  return false;
}
```

### `showConfirmDialog` API

From `app-utils.js`: `showConfirmDialog(message)` → `Promise<boolean>`. True = OK, false = Cancel. Already imported in `app-file-ops.js` via `import { showConfirmDialog, showAlert } from './app-utils.js'`.

Wait — check: `showConfirmDialog` is imported in `app-utils.js` but need to verify it's imported in `app-file-ops.js`. If not, add it.

### `maxCols` for multi-cell paste

```js
const maxCols = Math.max(...parsedRows.map((r) => r.split('\t').length));
```
This is already computed as part of `expandGridIfNeeded` call — reuse it.

### Project Structure Notes

- Only `frontend/app-file-ops.js` needs source changes
- New test file: `playwright_tests/test_paste_overwrite_warning.spec.js`

### References

- [Source: frontend/app-file-ops.js#399–464] — `pasteFromClipboard` function
- [Source: frontend/app-file-ops.js#328] — `GetAllCells` usage in copy
- [Source: frontend/app-utils.js#34–78] — `showConfirmDialog`
- [Source: frontend/api-client.js] — `GetAllCells` return format

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `frontend/app-file-ops.js` — added `showConfirmDialog` import; added `targetRangeHasContent` helper; added overwrite check before single-cell and multi-cell paste
- `playwright_tests/test_paste_overwrite_warning.spec.js` — new test file (5 tests)
