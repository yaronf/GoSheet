# Story 15.3: Undo/Redo for Structural Operations

**Status:** review
**Epic:** 15 — Undo / Redo

---

## Story

As a user,
I want to undo and redo row/column insertions and deletions,
So that structural mistakes are as easy to recover from as cell edits.

---

## Acceptance Criteria

**AC1 — Undo insert row**
**Given** a user inserts a row
**When** the user presses Cmd+Z
**Then** the inserted row is removed and all cells return to their pre-insert positions
**And** formula references are restored to their pre-insert values

**AC2 — Undo delete row**
**Given** a user deletes a row
**When** the user presses Cmd+Z
**Then** the deleted row is restored with all its original cell values at the correct row index
**And** formula references are restored

**AC3 — Undo insert column**
**Given** a user inserts a column
**When** the user presses Cmd+Z
**Then** the inserted column is removed and all cells return to their pre-insert positions
**And** formula references are restored

**AC4 — Undo delete column**
**Given** a user deletes a column
**When** the user presses Cmd+Z
**Then** the deleted column is restored with all its original cell values
**And** formula references are restored

**AC5 — Redo**
**Given** any structural undo has been performed
**When** the user presses Cmd+Shift+Z
**Then** the operation is reapplied correctly

**AC6 — Formula correctness after undo/redo**
**Given** formula cells reference rows/columns affected by the operation
**When** the operation is undone or redone
**Then** formula results update correctly to reflect the restored state

**AC7 — Undo/redo state updated**
**Given** any structural operation completes
**When** the frontend receives the response
**Then** the undo button is enabled and the menu label shows the operation description

---

## Scope Note

**Paste is already undoable**: the existing paste (single-cell, via `SetCellValue`) is already wrapped in `SetCellCommand` from Story 15.2. Multi-cell paste is not in this story.

**Delete row/column is not yet implemented** in the model, controller, or frontend. This story adds it alongside the undo support.

---

## Tasks / Subtasks

- [ ] Task 1: Add inverse formula-shift helpers to `model/formula_shift.go` (AC: 1–6)
  - [ ] Add `unshiftFormulaRefsForDeleteRow(formula string, deletedRow int) string` — refs with row > deletedRow get row--
  - [ ] Add `unshiftFormulaRefsForDeleteColumn(formula string, deletedCol int) string`
  - [ ] Reuse the existing `shiftFormulaRefs` pattern; pass delta -1 instead of +1
  - [ ] Unit tests in `model/formula_shift_test.go`
- [ ] Task 2: Add `DeleteRow` / `DeleteColumn` to the model (AC: 2, 4)
  - [ ] `Spreadsheet.DeleteRow(row int) error` in `model/spreadsheet.go`
    - Snapshot the row's cells before deletion (return them for command use)
    - Shift cells at row > deletedRow up by 1
    - Update merge regions (mirror of InsertRow but in reverse)
    - Rewrite formula refs using `unshiftFormulaRefsForDeleteRow`
  - [ ] `Spreadsheet.DeleteColumn(col int) error` — same pattern
  - [ ] Unit tests in `model/spreadsheet_test.go`
- [ ] Task 3: Add `InsertRowCommand`, `DeleteRowCommand`, `InsertColumnCommand`, `DeleteColumnCommand` to `controller/command.go` (AC: 1–6)
  - [ ] Each command snapshots the affected row/column cells (not full sheet)
  - [ ] `InsertRowCommand`: `Do()` calls `Sheet.InsertRow`, `Undo()` calls `Sheet.DeleteRow` then restores the empty row that was there (nil — nothing to restore, just delete)
  - [ ] `DeleteRowCommand`: snapshot entire row cells before deletion; `Do()` calls `Sheet.DeleteRow`; `Undo()` re-inserts the row and restores snapshotted cells
  - [ ] Same pattern for column commands
  - [ ] After Do/Undo: call `rebuildDependencyGraph()` + `recalculateAllFormulas()` (same as current `InsertRow`/`InsertColumn` in `controller/app.go`)
  - [ ] `Description()`: "Insert Row 3", "Delete Row 3", "Insert Column B", "Delete Column B"
  - [ ] Unit tests in `controller/command_test.go`
- [ ] Task 4: Refactor `InsertRow` / `InsertColumn` in `controller/app.go` to push commands; add `DeleteRow` / `DeleteColumn` (AC: 1–7)
  - [ ] `InsertRow(row int) error` → snapshot (nothing to snapshot — inserting empty row), push `InsertRowCommand`
  - [ ] `InsertColumn(col int) error` → push `InsertColumnCommand`
  - [ ] `DeleteRow(row int) error` → snapshot row cells, push `DeleteRowCommand`
  - [ ] `DeleteColumn(col int) error` → snapshot col cells, push `DeleteColumnCommand`
  - [ ] All return `error` and call `c.History.Push(cmd)` under `c.mu.Lock()`
- [ ] Task 5: Add HTTP handlers and routes (AC: 2, 4, 7)
  - [ ] `HandleDeleteRow` / `HandleDeleteColumn` in `api/handlers.go` — POST /api/row/delete, POST /api/column/delete
  - [ ] Response includes `canUndo`, `canRedo`, `undoDescription`, `redoDescription`, `hasUnsavedChanges`
  - [ ] Update `HandleInsertRow` / `HandleInsertColumn` responses to include undo/redo state (currently missing — AC7)
  - [ ] Register new routes in `server/main.go`
  - [ ] Handler tests in `api/handlers_test.go`
- [ ] Task 6: Frontend — wire delete row/column + undo state sync (AC: 2, 4, 7)
  - [ ] Add `DeleteRow` / `DeleteColumn` functions to `frontend/api-client.js`
  - [ ] Add "Delete Row" / "Delete Column" to Edit/Insert menu in `electron/menu.js` (enabled only when row/column is selected — same gate as insert)
  - [ ] Add IPC handlers in `electron/main.js` + preload in `electron/preload.js`
  - [ ] Wire handlers in `frontend/app.js` (`onMenuDeleteRow`, `onMenuDeleteColumn`)
  - [ ] After insert/delete: call `applyUndoRedoState(result)` + `buildSpreadsheet()` + `refreshAllCells()` (the existing insert handlers are missing `applyUndoRedoState` — fix those too)
- [ ] Task 7: Playwright E2E tests in `playwright_tests/test_undo_redo_structural.spec.js`
  - [ ] Insert row → Cmd+Z → row removed, cells back in place
  - [ ] Delete row → Cmd+Z → row restored with original values
  - [ ] Insert column → Cmd+Z → column removed
  - [ ] Delete column → Cmd+Z → column restored
  - [ ] Redo after undo (Cmd+Shift+Z) for each operation
  - [ ] Formula cell referencing shifted row → undo → formula result correct

---

## Dev Notes

### Architecture

Follows the `ClearRangeCommand` pattern from Story 15.2 exactly. Each command:
1. Snapshots what it needs in the controller (before calling model)
2. Delegates to the model for the actual mutation
3. Rebuilds dependency graph and recalculates formulas

### Inverse formula shifting

`shiftFormulaRefs` in `model/formula_shift.go` already handles the general case. The inverse (unshift for delete) is straightforward:

```go
// unshiftFormulaRefsForDeleteRow rewrites refs when a row is deleted.
// Refs with row > deletedRow get row--, refs at exactly deletedRow become #REF! (or are left — TBD).
func unshiftFormulaRefsForDeleteRow(formula string, deletedRow int) string {
    return unshiftFormulaRefs(formula, deletedRow, -1)
}

func unshiftFormulaRefs(formula string, deletedRow, deletedCol int) string {
    // Same regex as shiftFormulaRefs; refs with row > deletedRow get row--
    // refs exactly at deletedRow: leave as-is (cell is gone; formula engine will return error)
}
```

Use `deletedRow >= 0` / `deletedCol >= 0` to skip a dimension, mirroring the existing `shiftFormulaRefs` pattern.

### DeleteRow snapshot strategy

Before calling `Sheet.DeleteRow(row)`, snapshot the entire row:

```go
// In controller/app.go DeleteRow:
snapshot := make(map[int]*model.Cell)
if rowMap, ok := c.Sheet.Cells[row]; ok {
    for col, cell := range rowMap {
        if cell != nil {
            cp := *cell
            snapshot[col] = &cp
        }
    }
}
```

`InsertRowCommand.Undo()` just calls `Sheet.DeleteRow(row)` — no cell data to restore (the inserted row was empty).
`DeleteRowCommand.Undo()` calls `Sheet.InsertRow(row)` to shift cells back up, then writes the snapshotted cells back into row `row`, then `rebuildDependencyGraph()` + `recalculateAllFormulas()`.

### Merge region handling

`InsertRow`/`InsertColumn` already handle merge updates in the model. `DeleteRow`/`DeleteColumn` must mirror this:
- For `DeleteRow(row)`: merges with `StartRow == row` are deleted (the anchor is gone); merges with `StartRow > row` get `StartRow--`; merges spanning row (anchor above, `StartRow + RowSpan - 1 >= row`) get `RowSpan--` (and if RowSpan becomes 0, delete the merge).
- Snapshot merges as part of `DeleteRowCommand` so they can be restored on undo.

### Existing InsertRow/InsertColumn response gap (AC7)

Current `HandleInsertRow` and `HandleInsertColumn` in `api/handlers.go` return only `hasUnsavedChanges`. They need `canUndo`, `canRedo`, `undoDescription`, `redoDescription` added (use `s.Ctrl.UndoRedoState()` — the locked accessor from Story 15.2 review fixes).

Current frontend handlers in `app.js` (lines ~3312–3348) call `result.hasUnsavedChanges` but never `applyUndoRedoState(result)`. Fix both insert handlers when adding the delete handlers.

### Key files

- `model/formula_shift.go` — add unshift helpers
- `model/formula_shift_test.go` — tests for unshift
- `model/spreadsheet.go` — add DeleteRow, DeleteColumn
- `model/spreadsheet_test.go` — tests for DeleteRow, DeleteColumn
- `controller/command.go` — 4 new command types
- `controller/command_test.go` — unit tests for all 4 commands
- `controller/app.go` — refactor InsertRow/InsertColumn, add DeleteRow/DeleteColumn
- `api/handlers.go` — HandleDeleteRow, HandleDeleteColumn; fix insert handler responses
- `api/handlers_test.go` — handler tests
- `server/main.go` — register /api/row/delete, /api/column/delete
- `frontend/api-client.js` — DeleteRow, DeleteColumn
- `frontend/app.js` — delete handlers, fix insert handlers to call applyUndoRedoState
- `electron/menu.js` — Delete Row, Delete Column menu items
- `electron/main.js` — IPC for delete row/column
- `electron/preload.js` — onMenuDeleteRow, onMenuDeleteColumn
- `playwright_tests/test_undo_redo_structural.spec.js` — E2E tests

### What is NOT in scope

- Multi-cell paste undo — Story 15.4 or later
- Undo/redo for formatting (alignment, styles, merge) — Story 15.4
- Undo/redo for InsertRow/Column via context menu (right-click) — same code path, automatically covered

### Testing approach

Go unit tests for model (`DeleteRow`, `DeleteColumn`, formula unshift) and command round-trips. E2E tests use row/column header selection + Insert/Delete menu (same pattern as `test_insert_row_column.spec.js`). Use `waitForFunction` / `toHaveText` for condition-based assertions — no sleeps.

---

## References

- `model/formula_shift.go` — `shiftFormulaRefs`, `shiftFormulaRefsForInsertRow`
- `model/spreadsheet.go` — `InsertRow`, `InsertColumn`, `Merges`, `MergeRegion`
- `controller/command.go` — `ClearRangeCommand`, `SetCellCommand` patterns
- `controller/app.go` — `InsertRow`, `InsertColumn`, `ClearRange`
- `api/handlers.go` — `HandleInsertRow`, `HandleInsertColumn`, `UndoRedoState()`
- `_bmad-output/implementation-artifacts/13-1-row-column-selection-and-insert.md` — original insert implementation
- `_bmad-output/implementation-artifacts/15-2-undo-redo-cell-edits-and-deletion.md` — command pattern, locking, response shape

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

1. Added `unshiftFormulaRefsForDeleteRow`/`unshiftFormulaRefsForDeleteColumn` to `model/formula_shift.go`. Refs at exactly the deleted row/column become `#REF!` (Excel-compatible). Refs beyond shift down by 1.
2. Added `DeleteRow(row int) (map[int]*Cell, error)` and `DeleteColumn(col int) (map[int]*Cell, error)` to `model/spreadsheet.go`. Both return a snapshot of the deleted row/col for undo use, handle merge region cleanup (anchors in deleted row/col removed; spanning merges shrunk), and rewrite formula refs.
3. Added `InsertRowCommand`, `DeleteRowCommand`, `InsertColumnCommand`, `DeleteColumnCommand` to `controller/command.go`. `Delete*Command` snapshots formula texts (not full cells) before deletion to avoid double-shift when InsertRow/InsertColumn re-shifts refs during Undo. `snapshotFormulas`/`restoreFormulas` helpers capture/restore only formula `.Value` fields.
4. Refactored `InsertRow`/`InsertColumn` in `controller/app.go` to push commands; added `DeleteRow`/`DeleteColumn`.
5. Fixed `HandleInsertRow`/`HandleInsertColumn` responses to include `canUndo`/`canRedo`/`undoDescription`/`redoDescription` (AC7 gap). Added `HandleDeleteRow`/`HandleDeleteColumn` with same response shape.
6. Registered `/api/row/delete` and `/api/column/delete` in `server/main.go`.
7. Added `DeleteRow`/`DeleteColumn` to `frontend/api-client.js`; fixed `InsertRow`/`InsertColumn` to return full undo state.
8. Added delete handlers (`onMenuDeleteRow`, `onMenuDeleteColumn`) and fixed insert handlers to call `applyUndoRedoState` in `frontend/app.js`.
9. Added Delete Row / Delete Column to Insert menu in `electron/menu.js`; `updateMenuState` uses same `canInsertRow`/`canInsertColumn` gate. Added `onMenuDeleteRow`/`onMenuDeleteColumn` listeners in `electron/preload.js`.
10. 10 Playwright E2E tests in `test_undo_redo_structural.spec.js` — all passing.

### File List

- `model/formula_shift.go` — added unshift helpers, `#REF!` for deleted refs
- `model/formula_shift_test.go` — new tests for shift/unshift (new file)
- `model/spreadsheet.go` — added `DeleteRow`, `DeleteColumn`
- `model/spreadsheet_test.go` — tests for `DeleteRow`, `DeleteColumn`, merge handling
- `controller/command.go` — 4 new command types, `snapshotFormulas`, `restoreFormulas`
- `controller/command_test.go` — 5 new structural command tests
- `controller/app.go` — refactored `InsertRow`/`InsertColumn`, added `DeleteRow`/`DeleteColumn`
- `api/handlers.go` — `HandleDeleteRow`, `HandleDeleteColumn`; fixed insert handler responses
- `api/handlers_test.go` — 3 new handler tests
- `server/main.go` — registered `/api/row/delete`, `/api/column/delete`
- `frontend/api-client.js` — `DeleteRow`, `DeleteColumn`; fixed `InsertRow`/`InsertColumn` undo state
- `frontend/app.js` — delete handlers, fixed insert handlers to call `applyUndoRedoState`
- `electron/menu.js` — Delete Row / Delete Column menu items; `updateMenuState` extended
- `electron/preload.js` — `onMenuDeleteRow`, `onMenuDeleteColumn`
- `playwright_tests/test_undo_redo_structural.spec.js` — 10 E2E tests (new file)
