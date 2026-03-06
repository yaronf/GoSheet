# Story 15.1: Command Pattern Infrastructure

**Status:** done
**Epic:** 15 — Undo / Redo

---

## Story

As a developer,
I want a command pattern with Do/Undo support and a bounded history stack,
So that all mutating operations can be reversed reliably.

---

## Acceptance Criteria

**AC1 — Command interface**
**Given** the command pattern is implemented
**When** any mutating operation is executed
**Then** it is wrapped in a `Command` with `Do()` and `Undo()` methods and pushed onto the history stack

**AC2 — Bounded stack**
**Given** the history stack has reached its cap (100 operations)
**When** a new command is pushed
**Then** the oldest command is dropped from the stack

**AC3 — Redo stack cleared on new command**
**Given** a command is undone
**When** another command is executed (not redo)
**Then** the redo stack is cleared (standard undo/redo branching behavior)

**AC4 — History cleared on file lifecycle**
**Given** the history stack
**When** the spreadsheet file is closed or a new file is opened
**Then** the history stack is cleared

**AC5 — Unit tests**
**Given** Go unit tests for the command infrastructure
**When** the tests run
**Then** push, undo, redo, cap enforcement, and redo-stack-clear behaviors all pass

---

## Tasks / Subtasks

- [x] Task 1: Define `Command` interface in Go (AC: 1)
  - [x] Created `controller/command.go`
  - [x] `Command` interface: `Do() error`, `Undo() error`, `Description() string`

- [x] Task 2: Implement `History` stack (AC: 2, 3, 4)
  - [x] `History` struct with `undoStack []Command` and `redoStack []Command`
  - [x] `Push`, `Undo`, `Redo`, `Clear`, `CanUndo`, `CanRedo`, `UndoDescription`, `RedoDescription`
  - [x] Cap enforced at 100; redo stack cleared on Push

- [x] Task 3: Integrate `History` into `AppController` (AC: 1, 4)
  - [x] `History *History` field added; initialized in `NewAppController()`
  - [x] `History.Clear()` called in `NewFile()` and `loadSheet()`

- [x] Task 4: Implement `SetCellCommand` as first concrete command (AC: 1, 5)
  - [x] Snapshots full `model.Cell` struct before mutation
  - [x] `Do()` calls `setCellValueInternal`; `Undo()` restores struct copy directly
  - [x] `SetCellValue` refactored to snapshot + push command
  - [x] `setCellValueInternal` extracted as lock-free raw mutator

- [x] Task 5: Write Go unit tests (AC: 5)
  - [x] 14 tests in `controller/command_test.go` — all pass
  - [x] Covers: Push, Undo, Redo, cap enforcement, redo-stack-clear, Clear, round-trip, formula, load/new file lifecycle, description

---

## Dev Notes

### Undo/Redo scope across Epic 15

**In scope (covered across stories 15.1–15.4):**
- Cell value edits — `SetCellValue` (this story, 15.1 pilot)
- Cell deletion / range clear — `ClearRange` (15.2)
- Insert row / insert column — `InsertRow`, `InsertColumn` (15.3)
- Paste (single cell and range) (15.3)
- Style changes — `ApplyStyleToCell`, `ApplyStyleToRange` (15.4)
- Alignment changes — `SetCellAlignment`, `SetRangeAlignment` (15.4)
- Merge / unmerge — `SetMerge`, `Unmerge` (15.4)

**Out of scope (not undoable):**
- File operations (New, Open, Save, Save As) — history is cleared on New/Open; Save has no state to undo
- CSV import — treated as a file load; clears history
- Style registry changes (add/edit/delete named styles) — style definitions are metadata, not cell data; undo here would be confusing and is not in the PRD
- Column/row resize — not implemented in the app yet
- Formula recalculation — recalc is a derived result, not a user operation

**History lifetime:**
- Created fresh with each `AppController` (in-memory only, never persisted)
- Cleared on `NewFile()` and `LoadFile()` / `LoadFromBytes()`
- NOT cleared on Save (saving doesn't change what's undoable)

### Where to put the command pattern

**Decision: `controller/` package** (not `model/`).

Rationale:
- `AppController` already owns the coordination between HTTP handlers and `model.Spreadsheet`
- `AppController.SetCellValue` (and other mutating methods) already handle locking, dependency recalculation, formula parsing — the pre/post state capture naturally lives here
- The `model` package should remain pure data (no history concern)
- History is session-specific state (not persisted), fits with controller's app-level state

**New files:**
- `controller/command.go` — `Command` interface + `History` struct
- `controller/command_test.go` — unit tests

### Key constraint: separate internal vs external mutators

To enable undo without re-entering history, you must split `SetCellValue` into:
1. `SetCellValue(row, col, value)` — the public method, creates a `SetCellCommand`, pushes to history
2. `setCellValueInternal(row, col, value)` — the raw mutator (already effectively exists as the body of current `SetCellValue`), called by commands' `Do()` and `Undo()`

This pattern prevents infinite history loops when `Do()`/`Undo()` call back into the controller.

**Important:** `setCellValueInternal` must NOT acquire `c.mu` — the caller (`History.Push`, `History.Undo`) should hold the lock, OR history operations themselves should be lock-aware. Given `AppController` already uses `sync.RWMutex`, the cleanest approach:
- `History.Push/Undo/Redo` are called from within a lock-holding context (the public methods)
- Internal mutators skip locking

### History struct design

```go
const HistoryCap = 100

type History struct {
    undoStack []Command
    redoStack []Command
}

func (h *History) Push(cmd Command) error {
    if err := cmd.Do(); err != nil {
        return err
    }
    h.undoStack = append(h.undoStack, cmd)
    h.redoStack = nil // clear redo
    if len(h.undoStack) > HistoryCap {
        h.undoStack = h.undoStack[1:] // drop oldest
    }
    return nil
}
```

### SetCellCommand snapshot pattern

`model.Cell` is more than a string — it holds `Value`, `Computed`, `IsFormula`, `IsQuotePrefix`, `IsError`, `StyleId`, `Alignment`. Simply re-calling `setCellValueInternal(prevRawValue)` on undo would re-evaluate formulas and lose computed state.

Instead, snapshot the **entire previous `Cell` struct** (or `nil` if the cell didn't exist), and restore it directly on undo:

```go
type SetCellCommand struct {
    ctrl     *AppController
    row, col int
    newValue string       // raw user input for Do()
    prevCell *model.Cell  // deep copy of cell before Do(), nil if cell was absent
}
```

`Do()`: call `setCellValueInternal(row, col, newValue)` — this runs full SetValue + formula evaluation.

`Undo()`: if `prevCell == nil`, delete the cell; otherwise restore the struct copy directly to `c.Sheet.Cells[row][col]` — bypassing SetValue entirely, preserving exact pre-edit state including computed values and error state.

Snapshot must be captured **before** `Push` calls `Do()`. Capture in the public `SetCellValue` method:
```go
prev := c.Sheet.GetCell(row, col)
var prevCopy *model.Cell
if prev != nil {
    cp := *prev // struct copy
    prevCopy = &cp
}
cmd := &SetCellCommand{ctrl: c, row: row, col: col, newValue: value, prevCell: prevCopy}
return c.History.Push(cmd)
```

### AppController changes

Add to struct:
```go
type AppController struct {
    mu      sync.RWMutex
    Sheet   *model.Spreadsheet
    History *History  // NEW
}
```

`NewFile()` at `controller/app.go:258` and `loadSheet()` at `:297` should both call `c.History.Clear()`.

### Existing mutating operations (Stories 15.2–15.4 will wrap these)

This story only wraps `SetCellValue` as the pilot. Future stories wrap:
- `ClearRange` (story 15.2)
- `InsertRow`, `InsertColumn` (story 15.3)
- `SetMerge`, `Unmerge` (story 15.4)
- `ApplyStyleToCell`, `ApplyStyleToRange`, `SetCellAlignment`, `SetRangeAlignment` (story 15.4)

### No IPC/HTTP changes in this story

This story is **infrastructure only** — `Command` interface, `History` stack, and `SetCellCommand` as the first concrete command. Correctness is verified by Go unit tests only.

IPC handlers (`/api/undo`, `/api/redo`), keyboard shortcuts (Cmd+Z / Cmd+Shift+Z), and Edit menu wiring come in Story 15.2. Until then, undo/redo is not user-accessible.

### Key files to read before implementing

- `controller/app.go` — full `AppController` including `SetCellValue` (lines 28–138), `NewFile` (258), `loadSheet` (297)
- `model/spreadsheet.go` — `SetCell`, `DeleteCell`, `InsertRow`, `InsertColumn` signatures
- `controller/controller_test.go` — existing test patterns

---

## References

- `_bmad-output/planning-artifacts/epics.md` — Epic 15 stories and ACs
- `controller/app.go` — AppController, all mutating methods
- `model/spreadsheet.go` — model-level mutators
- `controller/controller_test.go` — test patterns

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

1. `Command` interface + `History` stack implemented in `controller/command.go`
2. `SetCellValue` refactored: public method snapshots previous `model.Cell` (full struct) and pushes `SetCellCommand`; raw work moved to `setCellValueInternal` (no locking — caller holds lock)
3. `Undo()` restores the exact pre-edit cell struct directly, bypassing `SetValue` re-evaluation — preserves computed values, formula flags, error state
4. History cleared on `NewFile()` and `loadSheet()` (covers both `LoadFile` and `LoadFromBytes`)
5. 14 unit tests pass; existing controller tests unaffected

### File List

- `controller/command.go` — `Command` interface, `History` struct, `SetCellCommand`
- `controller/command_test.go` — 14 unit tests
- `controller/app.go` — added `History` field, `setCellValueInternal`, refactored `SetCellValue`, `NewFile`, `loadSheet`

### Change Log

- 2026-03-06: Implemented command pattern infrastructure — all ACs satisfied, 14 tests pass
- 2026-03-06: Fixed code review findings — H1 (formula re-evaluation on undo), H2 (Modified flag), M1 (new dependency-changed test), M2 (Undo/Redo locking wrappers on AppController), M3 (weak assertion), L1 (HistoryCap doc), L2 (variable shadowing); 15 tests pass
