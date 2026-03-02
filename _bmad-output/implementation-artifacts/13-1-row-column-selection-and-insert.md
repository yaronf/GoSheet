# Story 13.1: Row/Column Selection and Insert

**Epic:** 13 - Spreadsheet UX & Polish  
**Story:** 13.1  
**Estimated Effort:** 4–6 hours  
**Status:** done  
**Created:** 2026-03-01  
**Last Updated:** 2026-03-02

---

## Story

As a user,
I want to select a row or column and insert an empty row/column before it,
So that I can add data without manually shifting cells.

---

## Context

**Prerequisites:** Epic 12 complete (Named Styles). No prior Epic 13 stories.

**Source:** `planning-artifacts/todo-2026-03-01.md`

**Current State:**

- Selection is cell-based (single cell or range via Shift+click)
- No row/column-level selection
- No insert row/column operations
- Model: `s.Cells` is `map[int]map[int]*Cell` (row → col → cell)
- Merges: `s.Merges` has `MergeRegion{StartRow, StartCol, RowSpan, ColSpan}`
- Formulas reference cells by ref (e.g. A1, B2:C5); formula engine uses `RefToCoords` / `CoordsToRef`

**Desired State:**

- User can select entire row (click row header) or column (click column header)
- "Insert row above" / "Insert column before" shifts data and updates references
- Selection moves to the new row/column

---

## Acceptance Criteria

1. **Row/column selection**
  - User can select a row by clicking the row header (row number)
  - User can select a column by clicking the column header (column letter)
  - Selection state reflects row or column selection (for menu/toolbar enablement)
2. **Insert row**
  - When a row is selected, user can trigger "Insert row above"
  - An empty row is inserted at the selected row index
  - All cells at row >= insertRow shift down by 1
  - Merge regions that start at or after insertRow have StartRow incremented
  - Merge regions that span insertRow have RowSpan incremented if anchor is above
  - Formula references (e.g. A5) in affected rows update (A5 → A6 when row 4 inserted)
  - Selection moves to the new row
3. **Insert column**
  - When a column is selected, user can trigger "Insert column before"
  - An empty column is inserted at the selected column index
  - All cells at col >= insertCol shift right by 1
  - Merge regions updated analogously to insert row
  - Formula references update (B2 → C2 when col 1 inserted)
  - Selection moves to the new column

---

## Tasks / Subtasks

- [x] Task 1: Model — InsertRow, InsertColumn (AC: 2, 3)
  - [x] Implement `Spreadsheet.InsertRow(row int)` — shift cells, merges, update formula refs
  - [x] Implement `Spreadsheet.InsertColumn(col int)` — same for columns
  - [x] Unit tests: TestInsertRow, TestInsertRow_FormulaRefs, TestInsertColumn
- [x] Task 2: Controller & API (AC: 2, 3)
  - [x] Controller: InsertRow, InsertColumn with dependency rebuild
  - [x] API: POST /api/row/insert, POST /api/column/insert
  - [x] API tests: TestHandleInsertRow, TestHandleInsertColumn
- [x] Task 3: Row/column selection UI (AC: 1)
  - [x] Row/col headers with data-row, data-col; click selects row/column
  - [x] Track selection mode (cell vs row vs column)
- [x] Task 4: Menu & handlers (AC: 2, 3)
  - [x] Insert menu: Insert Row Above, Insert Column Before
  - [x] Enable only when row (or column) is selected
- [x] Task 5: Playwright UI tests
  - [x] `playwright_tests/test_insert_row_column.spec.js` — row/col header selection, Insert menu enablement, insert row/column E2E

---

## Dev Notes

- **Model shift logic:** Iterate `s.Cells` in reverse order (high row/col first) when shifting to avoid overwriting. For InsertRow(row): for r from maxRow down to row, move row r to r+1. Clear row `row`. Update `s.Merges`: any merge with StartRow >= row → StartRow++; merges spanning row need careful handling (if anchor < row, RowSpan++; if anchor >= row, StartRow++).
- **Formula updates:** Formulas store refs as strings. After shifting, refs like A5 (row 4) must become A6 if we inserted at row 4. Options: (a) scan all cells, parse formulas, rewrite refs; (b) use `model.ExtractCellReferences` and `model.CoordsToRef` / `RefToCoords` to update. Row insert: refs with row >= insertRow → row++. Col insert: refs with col >= insertCol → col++.
- **Dependencies:** `DependencyGraph` uses cell refs; after formula refs change, dependency graph may need rebuild. Consider `rebuildDependencyGraph()` after insert.
- **File format:** Save/load uses `s.Cells` and `s.Merges`; no schema change needed if we only shift in-memory structures.
- **GetAllCells:** Currently iterates 0..99 rows, 0..25 cols. Insert doesn't change that; it just shifts data within. Ensure bounds expand if needed (e.g. ROWS/COLS constants).
- **Merge edge cases:** A merge from (2,0) to (4,0) spans rows 2,3,4. Insert at row 3: anchor stays (2,0), RowSpan becomes 4 (now rows 2,3,4,5). Insert at row 2: anchor moves to (3,0), RowSpan stays 3.
- **Architecture:** Go backend (model, controller, api), Electron frontend. Follow existing patterns: `ApplyStyleToRange`, `SetMerge`, etc.

### Project Structure Notes

- `model/spreadsheet.go` — add InsertRow, InsertColumn
- `model/formula.go` — may need helpers to rewrite refs in formula string
- `controller/app.go` — InsertRow, InsertColumn
- `api/handlers.go` — HandleInsertRow, HandleInsertColumn
- `server/main.go` — register routes
- `frontend/app.js` — row/col headers, selection, menu handlers
- `electron/menu.js` — Insert menu items
- `electron/preload.js` — IPC for insert if needed (or use HTTP API like other ops)

### References

- [Source: todo-2026-03-01.md] Row/column select and insert
- [Source: epics.md] Story 13.1
- [Source: architecture.md] Electron + Go server, single-mode
- [Source: model/spreadsheet.go] Cells map, Merges, ResolveToAnchor
- [Source: model/formula.go] ExtractCellReferences, formula parsing

---

## Dev Agent Record

### Agent Model Used

Cursor Composer

### File List

- model/formula_shift.go — shiftFormulaRefsForInsertRow, shiftFormulaRefsForInsertColumn
- model/spreadsheet.go — InsertRow, InsertColumn
- model/spreadsheet_test.go — TestInsertRow, TestInsertRow_FormulaRefs, TestInsertColumn
- controller/app.go — InsertRow, InsertColumn
- api/handlers.go — HandleInsertRow, HandleInsertColumn, InsertRowRequest, InsertColumnRequest
- api/handlers_test.go — TestHandleInsertRow, TestHandleInsertColumn
- server/main.go — /api/row/insert, /api/column/insert
- frontend/api-client.js — InsertRow, InsertColumn
- frontend/app.js — selectionMode, applySelectionRange, row/col header click, Insert menu handlers
- electron/menu.js — Insert menu, canInsertRow, canInsertColumn
- electron/preload.js — onMenuInsertRow, onMenuInsertColumn
- playwright_tests/test_insert_row_column.spec.js — Story 13.1 Playwright tests

### Change Log

- 2026-03-01 DS: Implemented row/column selection and insert. Model: InsertRow, InsertColumn with formula ref shifting. API: POST /api/row/insert, POST /api/column/insert. Insert menu with Insert Row Above, Insert Column Before. Row/col header click selects row/column.
- 2026-03-02 DS: Added Playwright tests (test_insert_row_column.spec.js) for row/column header selection, Insert menu enablement, and insert row/column E2E.

