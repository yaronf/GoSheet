# Story 23.7: Typed Cell Error Enum

Status: done



## Story

As a developer,
I want cell errors to be represented by a typed `ErrorKind` enum instead of string matching on `Computed`,
so that error handling is type-safe, maintainable, and does not leak display concerns into logic.

## Acceptance Criteria

1. **Given** a `Cell` struct
  **When** the cell has an error
   **Then** it has an `ErrorKind` field (e.g. `ErrNone`, `ErrEval`, `ErrRef`, `ErrCircular`, `ErrParse`) and `Computed` remains the display string
2. **Given** callers that need to branch on error type (e.g. formula evaluation, style application)
  **When** they check the cell's error
   **Then** they use the `ErrorKind` enum instead of string matching on `Computed`
3. **Given** the frontend displays cell values
  **When** a cell has an error
   **Then** it continues to display `Computed` as-is (no frontend changes required for display)
4. **Given** a spreadsheet is saved to a `.sheet` file
  **When** the cell has an error
   **Then** `ErrorKind` is persisted in the MessagePack payload and the file format version is bumped
5. **Given** a `.sheet` file in format 2.1
  **When** a cell has an error
   **Then** `error_kind` is present in the payload; no backward compatibility with format 2.0
6. **Given** `ApplyStyleToCell` or `ApplyStyleToRange`
  **When** the target cell(s) have errors
   **Then** rejection uses `ErrorKind != ErrNone`

## Tasks / Subtasks

- [x] Task 1: Add ErrorKind enum and Cell field (AC: 1, 2)
  - In `model/cell.go`: define `type ErrorKind int` with constants `ErrNone`, `ErrEval`, `ErrRef`, `ErrCircular`, `ErrParse`
  - Add `ErrorKind ErrorKind` to `Cell` struct; derive `IsError = (ErrorKind != ErrNone)` (remove `IsError` as separate field)
  - Update `SetError`, `SetRefError`, `SetFromValue`, and parse-error path in `SetValue` to set both `ErrorKind` and `Computed`
  - Update `SetComputed` to set `ErrorKind = ErrNone`
- [x] Task 2: Replace string matching with ErrorKind checks (AC: 2)
  - In `model/formula_eval.go`: replace `computed == "#REF!"` with `cell.ErrorKind == ErrRef` (or equivalent) in `evaluateCellRef` and related propagation logic
  - In `model/spreadsheet.go`: `ApplyStyleToCell` / `ApplyStyleToRange` — use `ErrorKind != ErrNone`
  - In `controller/app.go` and `controller/command.go`: any branching on error type should use `ErrorKind`
  - Search codebase for `"#REF!"`, `"#ERROR"`, `strings.HasPrefix(cell.Computed,` and update to use `ErrorKind` where logic depends on error type
- [x] Task 3: Persist ErrorKind (AC: 4, 5)
  - In `model/file.go`: add `ErrorKind` to `cellPersist` with `msgpack:"error_kind"`; use int for MessagePack (ErrorKind is int)
  - Update `cellsToPersist` and `cellsFromPersist` to include `ErrorKind`
  - Bump `FileFormatVersion` (e.g. `2.0` → `2.1`) in `model/file.go`; no backward compatibility — format 2.1 required
  - Update `docs/FILE_FORMAT.md` to document `error_kind` and new version
- [x] Task 4: Unit tests (AC: 1–6)
  - Add tests in `model/cell_test.go` for `SetError`, `SetRefError`, `SetFromValue` setting correct `ErrorKind`
  - Add tests in `model/file_test.go` for round-trip of cells with each `ErrorKind`
  - Add tests in `model/formula_eval_test.go` for propagation using `ErrorKind` (if not covered by existing #REF! tests)
  - Add test for `ApplyStyleToCell` / `ApplyStyleToRange` rejecting error cells (may already exist; verify)
- [x] Task 5: Update API types if needed (AC: 3)
  - Check if `GetAllCells` or agent read responses expose `IsError`; add `error_kind` if useful for API consumers, or keep `IsError` only for backward compat
  - Frontend: no changes required for display; `Computed` is still the source of truth for what to show

## Dev Notes

### Key Files

- **`model/cell.go`** — `Cell` struct, `SetError`, `SetRefError`, `SetFromValue`, `SetValue` (parse-error branch)
- `**model/file.go**` — `cellPersist`, `cellsToPersist`, `cellsFromPersist`, `FileFormatVersion`
- `**model/formula_eval.go**` — `evaluateCellRef` (line ~378: `computed == "#REF!"`), `evaluateRange`, `evaluateFuncCall` (#REF! propagation)
- `**model/spreadsheet.go**` — `ApplyStyleToCell`, `ApplyStyleToRange` (reject error cells)
- `**controller/app.go**` — `formatFormulaError`, `EvaluateFormula` call sites
- `**controller/command.go**` — formula evaluation and error handling
- `**docs/FILE_FORMAT.md**` — document `error_kind` and version 2.1

### Current Behavior

- `Cell.Computed` encodes error type as strings: `"#ERROR division by zero"`, `"#REF!"`, `"#ERROR circular reference: ..."`
- `IsError bool` only indicates *something* went wrong
- `formula_eval.go` uses `computed == "#REF!"` to distinguish #REF! from other errors (propagates as `RefErrorValue` vs `ErrorValue`)
- `cellPersist` stores `Value`, `IsFormula`, `IsQuotePrefix`, `IsError`, `StyleId`, `InvalidRefs`; `Computed` is not persisted (recomputed on load via `RecalculateAll`)

### Architecture Compliance

- Model-only change for core enum; controller and API may need minor updates for consistency
- File format: MessagePack v2.x; bump version for schema change (see Epic 22)
- No frontend changes for display; `Computed` remains the display string

### Backward Compatibility

None. Format 2.1 required. Old 2.0 files will fail to load (version check in `decodeSpreadsheet`).

### References

- [Source: backlog.md] Typed cell error enum — full description
- [Source: epics.md] Epic 23, story 23-7
- [Source: model/cell.go] Cell struct, SetError, SetRefError, SetFromValue
- [Source: model/formula_eval.go] evaluateCellRef, #REF! propagation
- [Source: model/file.go] cellPersist, MessagePack encoding
- [Source: docs/FILE_FORMAT.md] Cell object, version 2.0

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added `ErrorKind` enum (ErrNone, ErrEval, ErrRef, ErrCircular, ErrParse) to `model/cell.go`
- Replaced `IsError bool` with `ErrorKind`; added `IsError()` method
- Added `setParseError`, `SetCircularError`; updated `SetError`, `SetRefError`, `SetComputed`
- Updated `model/formula_eval.go` to use `cell.ErrorKind == ErrRef` instead of string match
- Updated `model/spreadsheet.go` ApplyStyleToCell/Range to use `ErrorKind != ErrNone`
- Updated `model/file.go`: cellPersist uses `error_kind`; FileFormatVersion 2.1; no backward compat
- Updated `api/handlers.go` to use `cell.IsError()`
- Added tests: cell_test.go (ErrorKind setters), file_test.go (round-trip, 2.0 rejection)
- docs/FILE_FORMAT.md already updated (previous session)

### File List

- model/cell.go
- model/file.go
- model/formula_eval.go
- model/spreadsheet.go
- model/cell_test.go
- model/file_test.go
- model/formula_test.go
- model/spreadsheet_test.go
- api/handlers.go
- controller/command_test.go
- controller/controller_test.go

