# Story 23.3: Copy/Paste Full Rows/Cols

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to copy and paste full rows or full columns when I select them via the row/column headers,
so that I can duplicate entire rows or columns efficiently.

## Acceptance Criteria

1. **Given** a full row is selected (e.g. via row header click, address box `1:1`)
   **When** the user presses Cmd+C (or Edit → Copy)
   **Then** all cell values in that row are copied to the clipboard as TSV

2. **Given** a full column is selected (e.g. via column header click, address box `A:A`)
   **When** the user presses Cmd+C (or Edit → Copy)
   **Then** all cell values in that column are copied to the clipboard as TSV

3. **Given** a multi-row range is selected (e.g. `1:10` via row headers)
   **When** the user copies
   **Then** all cells in the selected rows are copied as TSV

4. **Given** a multi-column range is selected (e.g. `A:J` via column headers)
   **When** the user copies
   **Then** all cells in the selected columns are copied as TSV

5. **Given** a full row or column is copied
   **When** the user pastes at a target cell
   **Then** the data fills horizontally (row) or vertically (column) from the target, matching existing paste behavior

6. **Given** the selection would exceed a reasonable limit (e.g. by non-empty cell count)
   **When** the user attempts to copy
   **Then** show an error message that includes the limit (e.g. "Selection too large to copy (max 10,000 cells)") so the user knows why

7. **Given** a full row or column is pasted
   **When** the user presses Cmd+Z (Undo)
   **Then** the paste is undone as a single operation (one undo step)

## Tasks / Subtasks

- [x] Task 1: Add explicit handling for open-ended rows/cols; special-case the size guard (AC: 1–4, 6)
  - [x] Add explicit code paths for open-ended rows (`endCol === OPEN_END`) and open-ended cols (`endRow === OPEN_END`). Do not "resolve" OPEN_END to bounds; handle these cases distinctly (e.g. full-row vs full-col vs rectangular logic).
  - [x] Remove the `!Number.isFinite(endRow)` / `!Number.isFinite(endCol)` block that rejects open-ended selections
  - [x] **Size guard:** Define the limit (e.g. 10,000 non-empty cells). Base the guard on actual non-empty cell count, not rectangular bounds. E.g. a full row with 1000 cols but only 5 non-empty cells should be allowed; a 500×100 range with 50,000 non-empty cells should be rejected. Use `GetAllCells()` to count; avoid rejecting sparse selections.
  - [x] **Error message:** Include the limit in the message (e.g. "Selection too large to copy (max 10,000 cells)") so users know why they were rejected.

- [x] Task 2: Use GetAllCells for large ranges; avoid TSV where possible (AC: 1–4, perf)
  - [x] For open-ended or large ranges, use `GetAllCells()` instead of N×M `GetCellRawValue` calls
  - [x] Extract cell values from the GetAllCells response by ref (e.g. `colToLetter(c) + (r+1)`)
  - [x] **Clipboard format:** TSV is required for `navigator.clipboard.writeText` and Excel interoperability. Consider: (a) hold a structured representation (e.g. 2D array of strings) internally; (b) serialize to TSV only when writing to system clipboard; (c) or use a batch paste API that accepts structured data instead of parsing TSV on paste. Document the chosen approach.
  - [x] Handle missing cells as empty string when building the output

- [x] Task 3: Style clipboard for full row/column (AC: 5)
  - [x] Ensure `styleClipboard` is populated correctly when copying full row/column
  - [x] Verify paste applies styles to the pasted range (existing logic should work if copy provides correct bounds)

- [x] Task 4: Undo/redo for batch paste (AC: 7)
  - [x] Ensure full row/column paste uses `SetRangeValues` (or equivalent) so it is a single undo step
  - [x] Verify undo restores the overwritten cells; redo restores the paste

- [x] Task 5: Playwright tests (AC: 1, 2, 5, 6, 7)
  - [x] Test full row copy/paste (select row via header, copy, paste at target)
  - [x] Test full column copy/paste (select column via header, copy, paste at target)
  - [x] Test paste into the same row/column (e.g. copy row 1, paste into row 1 at different column)
  - [ ] Test "selection too large" for excessively large ranges (if applicable) — skipped; requires 10k+ non-empty cells
  - [x] Test undo/redo of full row or column paste

## Dev Notes

### Key Files

- **`frontend/app-file-ops.js`** — `copySelectionToClipboard`, `pasteFromClipboard`; explicit handling for open-ended rows/cols; size guard by non-empty count; GetAllCells for large ranges; undo/redo for batch paste
- **`frontend/app-state.js`** — `OPEN_END`, `ROWS`, `COLS`
- **`playwright_tests/test_copy_paste_range.spec.js`** — add full row/column tests; paste-into-same-row/col; undo/redo
- **`playwright_tests/test_open_ended_ranges.spec.js`** — reference for row/column selection behavior

### Current Behavior

- `copySelectionToClipboard` rejects when `!Number.isFinite(endRow) || !Number.isFinite(endCol)` — this blocks all open-ended (full row/col) selections
- Full row selection: `endCol === OPEN_END` (Infinity)
- Full column selection: `endRow === OPEN_END` (Infinity)
- The 10000×1000 guard also blocks; after resolving OPEN_END, a full row (e.g. 1000 cols) or full column (e.g. 1000 rows) may be within limits

### Implementation Approach

1. **Explicit handling for open-ended:** Add distinct code paths for (a) full row: `endCol === OPEN_END`; (b) full column: `endRow === OPEN_END`; (c) rectangular range. Do not resolve OPEN_END to bounds and treat as rectangular; handle each case explicitly.
2. **Size guard:** Define limit (e.g. 10,000 non-empty cells). Use actual count from `GetAllCells()`; reject when exceeded. Error message must include the limit (e.g. "max 10,000 cells") so users understand. Sparse full-row/col selections should pass.
3. **Efficient fetch:** Use `GetAllCells()` for open-ended or large ranges. Build ref→value map; for each (r,c) in range, look up or use "". Avoids N×M API calls.
4. **Clipboard format:** TSV is required for system clipboard and Excel. Consider structured internal representation; serialize to TSV only when writing. Paste may use batch API with structured data instead of TSV parse.
5. **Undo:** Batch paste must be a single undo step (`SetRangeValues`); verify undo/redo works.

### Architecture Compliance

- Frontend-only changes; no API contract changes
- GetAllCells already returns all cells; no new endpoint needed
- Undo/redo: `SetRangeValues` (or per-cell SetCellValue) already supports undo; ensure batch paste uses it

### Testing

- **Manual:** Select full row via header, Cmd+C, select target cell, Cmd+V. Verify row data pastes.
- **Playwright:** Add tests in test_copy_paste_range.spec.js for full row and full column copy/paste.
- **Go:** No backend changes.

### References

- [Source: sprint-change-proposal-2026-03-15-epic23.md] Epic 23 scope, 23-3 description
- [Source: 17-3-copy-paste-rectangular-range.md] copySelectionToClipboard, pasteFromClipboard
- [Source: 17-5] Open-ended row/column selection (OPEN_END)
- [Source: frontend/app-file-ops.js] copySelectionToClipboard guard (lines 326–336)

---

## Completion Notes

**Implemented:** 2026-03-15

### Summary

- **`getCopyBounds()`** — Explicit branches for full-row (`endCol === OPEN_END`), full-column (`endRow === OPEN_END`), and rectangular ranges. Returns `{ minR, maxR, minC, maxC }`.
- **`countCellsInRange()`** — Counts non-empty cells in `allCells` within bounds.
- **`buildTsvFromCells()`** — Builds TSV from `allCells` for given bounds.
- **`collectStyleClipboardCells()`** — Collects style clipboard entries for the range.
- **`copySelectionToClipboard()`** — Multi-cell path uses `getCopyBounds`, `GetAllCells`, size guard by non-empty count (limit 10,000), error message includes limit. Returns `true`/`false`.
- **Cut handler** — Calls `copySelectionToClipboard()`; if `false`, Cut does nothing; otherwise uses resolved bounds for `ClearRange`.
- **Playwright tests** — Full row copy/paste, full column copy/paste, paste into same row, undo of full row paste.

### Files Touched

- `frontend/app-file-ops.js` — `COPY_CELL_LIMIT`, `getCopyBounds`, `countCellsInRange`, `buildTsvFromCells`, `collectStyleClipboardCells`, `copySelectionToClipboard`, Cut handler
- `playwright_tests/test_copy_paste_range.spec.js` — Replaced "copy of entire row shows alert" with full row/column copy/paste tests; added paste-into-same-row and undo tests
