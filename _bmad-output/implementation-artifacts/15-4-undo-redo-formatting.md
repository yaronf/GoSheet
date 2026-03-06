# Story 15.4: Undo/Redo for Formatting

Status: review

## Story

As a user,
I want to undo and redo formatting changes (styles, alignment, merge/unmerge),
so that accidental formatting changes are as recoverable as data changes.

## Acceptance Criteria

**AC1 — Undo style applied to single cell**
**Given** a user applies a named style to a cell
**When** the user presses Cmd+Z
**Then** the cell's previous style is restored (including "no style" if there was none)

**AC2 — Undo style applied to a range**
**Given** a user applies a named style to a range of cells
**When** the user presses Cmd+Z
**Then** each cell in the range is restored to its individual previous style

**AC3 — Undo alignment change on a single cell**
**Given** a user changes cell alignment (left/center/right)
**When** the user presses Cmd+Z
**Then** the previous alignment is restored

**AC4 — Undo alignment change on a range**
**Given** a user changes alignment on a range
**When** the user presses Cmd+Z
**Then** each cell in the range is restored to its individual previous alignment

**AC5 — Undo merge**
**Given** a user merges a region of cells
**When** the user presses Cmd+Z
**Then** the merge is removed and the merge region list is restored to its pre-merge state

**AC6 — Undo unmerge**
**Given** a user unmerges a previously merged region
**When** the user presses Cmd+Z
**Then** the merge region is re-added at the same anchor/span as before

**AC7 — Redo**
**Given** any of AC1–AC6 has been undone
**When** the user presses Cmd+Shift+Z
**Then** the formatting change is reapplied correctly

**AC8 — Mixed operation order preserved**
**Given** a sequence of: cell edit, apply style, insert row, change alignment
**When** the user presses Cmd+Z four times
**Then** each operation is undone in correct reverse order

**AC9 — Undo/redo state in API responses**
**Given** any formatting mutation completes
**When** the frontend receives the HTTP response
**Then** `canUndo`, `canRedo`, `undoDescription`, `redoDescription` are present in `data`

## Tasks / Subtasks

- [x] Task 1: Add formatting command types to `controller/command.go` (AC: 1–8)
  - [x] `ApplyCellStyleCommand` — snapshots previous `StyleId` for the cell; `Do()` sets new style; `Undo()` restores old style. Description: `"Apply Style to A1"`
  - [x] `ApplyRangeStyleCommand` — snapshots `[row][col] → prevStyleId` for each cell in range; `Do()` sets all to new style; `Undo()` restores per-cell. Description: `"Apply Style to A1:C3"`
  - [x] `SetCellAlignmentCommand` — snapshots previous `Alignment` string; `Do()` sets new alignment; `Undo()` restores. Description: `"Set Alignment A1"`
  - [x] `SetRangeAlignmentCommand` — snapshots `[row][col] → prevAlignment` for range; `Do()/Undo()` restore per-cell. Description: `"Set Alignment A1:C3"`
  - [x] `SetMergeCommand` — snapshots no per-cell data (merge adds to `Sheet.Merges` slice); `Do()` calls `ctrl.Sheet.Merges = append(...)` and validates; `Undo()` removes the appended merge by matching anchor. Description: `"Merge A1:B2"`
  - [x] `UnmergeCommand` — snapshots the removed `MergeRegion`; `Do()` removes it; `Undo()` re-appends it. Description: `"Unmerge A1"`
  - [x] Unit tests in `controller/command_test.go` for all 6 new commands (Do, Undo, Description)

- [x] Task 2: Refactor controller formatting methods to push commands (AC: 1–9)
  - [x] `ApplyStyleToCell(row, col, styleId)` → capture prevStyleId, push `ApplyCellStyleCommand`
  - [x] `ApplyStyleToRange(startRow, startCol, endRow, endCol, styleId)` → snapshot range, push `ApplyRangeStyleCommand`
  - [x] `SetCellAlignment(row, col, alignment)` → capture prevAlignment, push `SetCellAlignmentCommand`
  - [x] `SetRangeAlignment(startRow, startCol, endRow, endCol, alignment)` → snapshot range, push `SetRangeAlignmentCommand`
  - [x] `SetMerge(startRow, startCol, rowSpan, colSpan)` → move validation inline into `SetMergeCommand.Do()`; push command
  - [x] `Unmerge(startRow, startCol)` → push `UnmergeCommand` (snapshot inside `Do()`)
  - [x] All methods must return `error` (no signature changes — they already return `error`)

- [x] Task 3: Fix handler responses to include undo/redo state (AC: 9)
  - [x] `HandleApplyCellStyle` — add `canUndo`, `canRedo`, `undoDescription`, `redoDescription` to response `data`
  - [x] `HandleApplyRangeStyle` — same
  - [x] `HandleSetCellAlignment` — same
  - [x] `HandleSetRangeAlignment` — same
  - [x] `HandleSetMerge` — same
  - [x] `HandleUnmerge` — same
  - [x] Use the existing `s.Ctrl.UndoRedoState()` pattern (same as Story 15.3 handlers)
  - [x] Handler tests in `api/handlers_test.go`

- [x] Task 4: Frontend — call `applyUndoRedoState(result)` after formatting ops (AC: 9)
  - [x] `frontend/api-client.js`: update `ApplyStyleToCell`, `ApplyStyleToRange`, `SetCellAlignment`, `SetRangeAlignment`, `SetMerge`, `Unmerge` to return the full response (including undo state fields)
  - [x] `frontend/app.js`: after each formatting operation call, call `applyUndoRedoState(result)` so toolbar/menu state updates
  - [x] No new IPC or menu items needed — formatting is triggered via existing handlers, not via Electron menu

- [x] Task 5: Playwright E2E tests in `playwright_tests/test_undo_redo_formatting.spec.js` (AC: 1–9)
  - [x] Apply style to cell → Cmd+Z → style reverted
  - [x] Change alignment → Cmd+Z → alignment reverted
  - [x] Merge cells → Cmd+Z → merge removed
  - [x] Unmerge cells → Cmd+Z → merge restored
  - [x] Redo (Cmd+Shift+Z) for at least one of the above
  - [x] API response includes `canUndo` / `undoDescription` after a formatting op

## Dev Notes

### Command Pattern — How to Snapshot Formatting State

All 6 commands follow the same lightweight snapshot approach established in Stories 15.1–15.3. Snapshot only what is needed to undo — no full-cell copies unless necessary.

**Style commands** — only `StyleId int` needs to be captured per cell:
```go
type ApplyCellStyleCommand struct {
    ctrl         *AppController
    row, col     int
    newStyleId   int
    prevStyleId  int // captured in Do()
}

func (cmd *ApplyCellStyleCommand) Do() error {
    cell := cmd.ctrl.Sheet.GetCell(cmd.row, cmd.col)
    if cell != nil {
        cmd.prevStyleId = cell.StyleId
    }
    return cmd.ctrl.Sheet.ApplyStyleToCell(cmd.row, cmd.col, cmd.newStyleId)
}

func (cmd *ApplyCellStyleCommand) Undo() error {
    // Restore prev style. StyleId=0 means "no style" — need to handle:
    // ApplyStyleToCell rejects styleId=0, so set directly:
    if cmd.prevStyleId == 0 {
        cell := cmd.ctrl.Sheet.GetCell(cmd.row, cmd.col)
        if cell != nil {
            cell.StyleId = 0
            cmd.ctrl.Sheet.Modified = true
        }
        return nil
    }
    return cmd.ctrl.Sheet.ApplyStyleToCell(cmd.row, cmd.col, cmd.prevStyleId)
}
```

**Range style** — snapshot `map[int]map[int]int` (row → col → prevStyleId). Only cells that actually exist in the range need snapshotting (nil cells have StyleId=0 by definition).

**Alignment commands** — same shape but with `prevAlignment string`.

**Merge/Unmerge commands** — snapshot `MergeRegion` struct (just 4 ints: StartRow, StartCol, RowSpan, ColSpan). No cell data needed.

```go
type SetMergeCommand struct {
    ctrl     *AppController
    startRow, startCol int
    rowSpan, colSpan   int
}

func (cmd *SetMergeCommand) Do() error {
    // Move validation from controller.SetMerge here:
    if cmd.startRow < 0 || ... { return error }
    newMerge := model.MergeRegion{...}
    for _, m := range cmd.ctrl.Sheet.Merges {
        if rectanglesOverlap(newMerge, m) { return error }
    }
    // ... nonEmpty check ...
    cmd.ctrl.Sheet.Merges = append(cmd.ctrl.Sheet.Merges, newMerge)
    cmd.ctrl.Sheet.Modified = true
    return nil
}

func (cmd *SetMergeCommand) Undo() error {
    for i, m := range cmd.ctrl.Sheet.Merges {
        if m.StartRow == cmd.startRow && m.StartCol == cmd.startCol &&
           m.RowSpan == cmd.rowSpan && m.ColSpan == cmd.colSpan {
            cmd.ctrl.Sheet.Merges = append(cmd.ctrl.Sheet.Merges[:i], cmd.ctrl.Sheet.Merges[i+1:]...)
            cmd.ctrl.Sheet.Modified = true
            return nil
        }
    }
    return fmt.Errorf("merge region not found for undo")
}
```

```go
type UnmergeCommand struct {
    ctrl     *AppController
    startRow, startCol int
    snapshot model.MergeRegion // captured in Do()
}

func (cmd *UnmergeCommand) Do() error {
    for i, m := range cmd.ctrl.Sheet.Merges {
        if m.StartRow == cmd.startRow && m.StartCol == cmd.startCol {
            cmd.snapshot = m
            cmd.ctrl.Sheet.Merges = append(cmd.ctrl.Sheet.Merges[:i], cmd.ctrl.Sheet.Merges[i+1:]...)
            cmd.ctrl.Sheet.Modified = true
            return nil
        }
    }
    return fmt.Errorf("no merge region with anchor at (%d,%d)", cmd.startRow, cmd.startCol)
}

func (cmd *UnmergeCommand) Undo() error {
    cmd.ctrl.Sheet.Merges = append(cmd.ctrl.Sheet.Merges, cmd.snapshot)
    cmd.ctrl.Sheet.Modified = true
    return nil
}
```

### Locking Model

All `controller/app.go` methods already hold `c.mu.Lock()` before calling `c.History.Push(cmd)`. The command's `Do()` and `Undo()` run inside that lock — **do NOT re-lock inside commands**. This is identical to `SetCellCommand`, `ClearRangeCommand`, and the structural commands.

### Handling styleId=0 in ApplyCellStyleCommand

`Sheet.ApplyStyleToCell` returns immediately (no-op) when `styleId == 0`. So restoring a `prevStyleId=0` must be done by directly setting `cell.StyleId = 0` — not by calling `ApplyStyleToCell`. See the code sketch above.

Similarly for `ApplyRangeStyleCommand`: cells that had no style (StyleId=0) must be restored by direct assignment, not via `ApplyStyleToCell`.

### UndoRedoState Pattern

Use `s.Ctrl.UndoRedoState()` in handlers (introduced in Story 15.2, used in 15.3). Returns a locked snapshot of `{CanUndo, CanRedo, UndoDescription, RedoDescription}`. The handler pattern is:

```go
urState := s.Ctrl.UndoRedoState()
_ = json.NewEncoder(w).Encode(map[string]any{
    "success": true,
    "data": map[string]any{
        "hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
        "canUndo":           urState.CanUndo,
        "canRedo":           urState.CanRedo,
        "undoDescription":   urState.UndoDescription,
        "redoDescription":   urState.RedoDescription,
    },
})
```

### What `rectanglesOverlap` is and where it lives

`rectanglesOverlap` is a package-private helper in `controller/app.go`. The `SetMergeCommand.Do()` needs it — since it's in the same package (`controller`), it's directly callable.

### No Formula Recalculation Needed

Formatting changes (style, alignment, merge/unmerge) don't affect formula evaluation — no need to call `rebuildDependencyGraph()` or `recalculateAllFormulas()` in these commands. This keeps them lightweight.

### Frontend: Where Formatting Is Triggered

Formatting operations are triggered via direct API calls from the frontend (not Electron menu IPC):
- `frontend/api-client.js` functions: `ApplyStyleToCell`, `ApplyStyleToRange`, `SetCellAlignment`, `SetRangeAlignment`, `SetMerge`, `Unmerge`
- Called from `frontend/app.js` handlers

The undo state returned by the API response needs to reach `applyUndoRedoState()` — check each call site in `app.js` and ensure it does this.

### Testing Approach

- **Go unit tests**: `controller/command_test.go` — verify `Do()` mutates, `Undo()` restores, `Description()` returns expected string. Use `newTestController()` helper (established in 15.1). Test the `styleId=0` edge case explicitly.
- **E2E tests**: Use `setCellViaApi` for setup, then trigger formatting via API calls (same pattern as `apiStructural` in `test_undo_redo_structural.spec.js`), then press `Meta+z` and assert DOM state.
- No sleeps — use `toHaveText`, `toHaveClass`, `waitFor` with timeouts.

### Key Files

| File | Change |
|---|---|
| `controller/command.go` | 6 new command types |
| `controller/command_test.go` | Tests for all 6 |
| `controller/app.go` | Refactor 6 methods to push commands |
| `api/handlers.go` | Add undo state to 6 handler responses |
| `api/handlers_test.go` | Tests for undo state in responses |
| `frontend/api-client.js` | Return full response from formatting calls |
| `frontend/app.js` | Call `applyUndoRedoState` after formatting ops |
| `playwright_tests/test_undo_redo_formatting.spec.js` | E2E tests (new file) |

### What is NOT in scope

- Style registry CRUD (add/edit/delete styles) — Story 13.3 already implemented; undo for those is deferred
- `CleanupFormat` undo — not in scope (infrequent, low-impact)
- Format-paste undo — not in scope

### Project Structure Notes

- Commands live in `controller/command.go` (same package as controller methods — can call `rectanglesOverlap` and other package-private helpers)
- Model functions (`Sheet.ApplyStyleToCell`, `Sheet.SetCellAlignment`, `Sheet.Merges`) are called directly from command `Do()`/`Undo()` — no new model changes needed
- All routes already registered in `server/main.go` — no new routes

### References

- `controller/command.go` — existing command pattern (`SetCellCommand`, `ClearRangeCommand`, `DeleteRowCommand`)
- `controller/app.go:431–516` — `SetMerge`, `Unmerge`, `ApplyStyleToCell`, `ApplyStyleToRange`, `SetCellAlignment`, `SetRangeAlignment`, `CleanupFormat`
- `model/spreadsheet.go:205–226` — `ApplyStyleToCell` (note: rejects styleId=0)
- `model/spreadsheet.go:233–251` — `SetCellAlignment`
- `model/cell.go:4–11` — `Cell` struct (StyleId, Alignment fields)
- `api/handlers.go:473–509` — `HandleSetMerge`, `HandleUnmerge` (current response shape — missing undo state)
- `api/handlers.go:518–571` — `HandleApplyCellStyle`, `HandleApplyRangeStyle`
- `api/handlers.go:876–941` — `HandleSetCellAlignment`, `HandleUndo`, `HandleRedo` (reference for UndoRedoState pattern)
- `_bmad-output/implementation-artifacts/15-3-undo-redo-structural-operations.md` — established patterns for undo state in responses

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 6 formatting command types implemented in `controller/command.go`
- `styleId=0` edge case: `ApplyStyleToCell` rejects styleId=0, so Undo bypasses it and sets `cell.StyleId = 0` directly
- `SetMerge` validation moved from `controller.SetMerge` into `SetMergeCommand.Do()` (same package, so `rectanglesOverlap` accessible)
- `UnmergeCommand` snapshots the `MergeRegion` inside `Do()` for Undo restoration
- Frontend `applyUndoRedoState` replaces `displayFileStatus` calls after formatting ops
- E2E: `getCellStyleId`/`getCellAlignment` helpers use `/api/cells/all` (not `/api/cell/ref` which returns a string ref, not cell data)
- `helpers.js` `ensureSpreadsheetView` fixed: uses `Promise.race` between `#cell-0-0` and `#modal-overlay.active` to handle unsaved-changes dialog that may appear after `#welcome-btn-new` click
- All 10 E2E tests pass, all Go unit tests pass

### File List

- `controller/command.go` — 6 new formatting command types
- `controller/command_test.go` — 7 new unit tests for formatting commands
- `controller/app.go` — refactored 6 methods to push commands; removed unused `fmt` import
- `api/handlers.go` — undo state added to 6 handler responses
- `api/handlers_test.go` — 5 new handler tests for undo state
- `frontend/api-client.js` — 5 functions updated to return full `json.data`
- `frontend/app.js` — 4 call sites updated to `applyUndoRedoState(result)`
- `playwright_tests/test_undo_redo_formatting.spec.js` — new file, 10 E2E tests
- `playwright_tests/helpers.js` — `ensureSpreadsheetView` handles unsaved-changes modal via `Promise.race`
