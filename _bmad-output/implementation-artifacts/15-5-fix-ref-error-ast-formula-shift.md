# Story 15.5: Formula Engine — AST as Canonical Runtime Representation

Status: done

## Story

As a developer and user,
I want the formula engine to use a parsed AST as the canonical runtime representation of formulas,
so that structural operations (insert/delete row/col) produce correct results, `#REF!` displays properly, and formulas never need to be re-parsed unnecessarily.

## Background / Bug Being Fixed

`formula_shift.go` currently rewrites formula strings by regex, substituting `#REF!` as literal text when a referenced cell is deleted:
```
cell.Value = "A1+#REF!"
```
The lexer has no token for `#REF!`, so re-parsing fails with:
```
#ERROR parse error: 1:5: lexer: invalid input text "#REF!"
```
The cell shows a parse error string instead of `#REF!`.

Root cause: the formula string (`Cell.Value`) is being used simultaneously as storage format, display format, and mutable intermediate state. Corrupting it with `#REF!` breaks all three uses, including the dependency graph (which also parses the string to extract refs — and silently drops the `#REF!` edge).

The fix is to make the parsed AST the canonical runtime representation. The string becomes a derived artifact, regenerated from the AST when needed.

## Acceptance Criteria

**AC1 — #REF! displays correctly after row/column delete**
**Given** a formula references a cell (e.g. `=A2+1`) and that row is deleted
**When** the formula is evaluated
**Then** the cell displays `#REF!` (not a parse error string)
**And** `IsError = true` on the cell

**AC2 — #REF! propagates through arithmetic**
**Given** `=A1+B2` where B2's row was deleted
**When** evaluated
**Then** result is `#REF!` (same propagation behavior as `ErrorValue`)

**AC3 — Range: collapsed to zero → #REF!**
**Given** `=SUM(A1:A1)` and row 0 is deleted (the only row in range)
**When** evaluated
**Then** cell displays `#REF!`

**AC4 — Range: interior deletion shrinks range**
**Given** `=SUM(A1:A3)` and row 1 (inside the range, not a boundary that collapses it) is deleted
**When** evaluated
**Then** formula evaluates as `=SUM(A1:A2)` — no `#REF!`, range shrank correctly

**AC5 — Insert still shifts correctly**
**Given** any formula with cell refs and a row/column is inserted before them
**When** evaluated
**Then** all refs reflect their new positions (existing behavior preserved)

**AC6 — Undo restores formula fully**
**Given** a formula contains a `#REF!` reference (from a delete)
**When** Cmd+Z undoes the deletion
**Then** formula evaluates correctly with original valid references

**AC7 — Formula string stays valid and parseable at all times**
**Given** any sequence of insert/delete operations on a sheet with formulas
**When** `Cell.Value` is inspected at any point
**Then** it is always a valid, parseable formula expression — never contains `#REF!` as literal text

**AC8 — Persistence round-trip is correct**
**Given** a sheet with formulas including some with `#REF!` refs saved to a `.sheet` file
**When** the file is loaded
**Then** formulas are re-parsed from `Cell.Value` strings, AST is rebuilt, and `#REF!` cells display correctly

**AC9 — No performance regression on formula evaluation**
**Given** formulas are now evaluated from stored AST (not re-parsed each time)
**When** the sheet recalculates
**Then** evaluation is at least as fast as before (parsing is eliminated per call)

## Tasks / Subtasks

- [ ] Task 1: Add coordinate fields to AST nodes and `RefErrorValue` type (AC: 1–4, 7)
  - [ ] In `model/formula_ast.go`: add `Row, Col int` and `Invalid bool` to `CellRef` struct (no parser tags — populated post-parse, ignored by participle)
  - [ ] In `model/formula_ast.go`: add `StartRow, StartCol, EndRow, EndCol int` and `Invalid bool` to `Range` struct (same)
  - [ ] Add `func (c *CellRef) ResolveCoords()` that populates `Row, Col` from `Ref` string via `ToCoords()` — called once after parsing
  - [ ] Add `func (r *Range) ResolveCoords()` that populates all four coord fields from `Start`/`End` strings
  - [ ] Add `func resolveAllCoords(ast *Formula)` that walks the full AST and calls `ResolveCoords` on every `CellRef` and `Range` node
  - [ ] Add `func applyInvalidRefs(ast *Formula, invalidRefs []string)` that walks the AST and sets `node.Invalid = true` on any `CellRef` whose `Ref` is in the set, or any `Range` whose `Start+":"+End` is in the set — used during load path to reconstruct `Invalid` flags from persisted `cell.InvalidRefs`. Matching is against AST nodes only (never raw string scan) so quoted string literals are never mismatched
  - [ ] In `model/formula.go`: add `type RefErrorValue struct{}` with `func (RefErrorValue) value() {}`
  - [ ] Add `case RefErrorValue: return "#REF!"` to `valueToString`
  - [ ] Add `case RefErrorValue: return 0, fmt.Errorf("#REF!")` to `toNumber`
  - [ ] Add `isErrorLike(v Value) bool` helper that returns true for both `ErrorValue` and `RefErrorValue`
  - [ ] Replace all inline `_, isErr := v.(ErrorValue)` propagation checks in `evaluateComparison`, `evaluateAddition`, `evaluateMultiplication`, `evaluateUnary`, and all builtin functions with `isErrorLike(v)`

- [ ] Task 2: Add `ParsedFormula` and `InvalidRefs` to `Cell` and wire parse-on-set (AC: 7, 8, 9)
  - [ ] In `model/cell.go`: add `ParsedFormula *Formula` field — runtime only, not persisted
  - [ ] In `model/cell.go`: add `InvalidRefs []string` field — persisted; list of ref/range strings marked invalid (e.g. `"B2"`, `"A1:A1"`)
  - [ ] In `cell.SetValue`: after successful `NormalizeFormula`, parse and store AST: `c.ParsedFormula, _ = ParseFormula("=" + c.Value)` then call `resolveAllCoords(c.ParsedFormula)`; clear `c.InvalidRefs`
  - [ ] On parse failure path in `SetValue`: `c.ParsedFormula = nil`
  - [ ] Implement `GobEncode`/`GobDecode` on `Cell` to exclude `ParsedFormula` but include `InvalidRefs`:
    ```go
    type cellPersist struct {
        Value, Computed   string
        IsFormula         bool
        IsQuotePrefix     bool
        IsError           bool
        StyleId           int
        Alignment         string
        InvalidRefs       []string  // persisted — needed to restore Invalid flags after load
    }
    ```
    `ParsedFormula *Formula` is intentionally excluded — participle AST has unexported fields gob cannot handle; it is rebuilt from `Value` on load
  - [ ] Unit test: `Cell.GobEncode`/`GobDecode` round-trips all fields including `InvalidRefs`; `ParsedFormula` is nil after decode

- [ ] Task 3: Rewrite `formula_shift.go` to mutate AST coordinates (AC: 1–5, 7)
  - [ ] Rewrite `unshiftFormulaRefs` (delete path): walk AST `CellRef` nodes:
    - If `node.Row == deletedRow` (or `node.Col == deletedCol`) → set `node.Invalid = true`; leave `node.Ref` unchanged (preserves display string)
    - Else if `node.Row > deletedRow` → `node.Row--`; update `node.Ref = CoordsToRef(node.Row, node.Col)`
    - For `Range` nodes: check each endpoint independently:
      - If start is deleted → `node.Invalid = true` (whole range is `#REF!`)
      - If end is deleted → `node.Invalid = true` (whole range is `#REF!`)
      - If neither endpoint is deleted but a row/col within the range is deleted: shift end coord (`node.EndRow--`); if after shift `node.EndRow < node.StartRow` (collapsed) → `node.Invalid = true`; else update `node.End = CoordsToRef(node.EndRow, node.EndCol)`
      - If neither endpoint is deleted and deletion is outside the range → no change needed
  - [ ] After walking AST: re-derive `cell.Value = serializeComparison(ast.Expr.Comparison)` — invalid nodes serialize using their unchanged `Ref`/`Start`/`End` strings (still valid ref strings, so the formula string stays parseable); update `cell.InvalidRefs` from all nodes where `node.Invalid == true` (collect `node.Ref` for `CellRef`, `node.Start+":"+node.End` for `Range`)
  - [ ] Rewrite `shiftFormulaRefs` (insert path): walk AST; for each `CellRef`: if `node.Row >= insertRow` → `node.Row++`; update `node.Ref`. For `Range`: update each endpoint independently. Re-serialize `cell.Value`. Clear `cell.InvalidRefs` entries that are no longer invalid (insert undo path — though undo snapshot handles this; see Task 7)
  - [ ] New function signatures take `*Cell`, operate on `cell.ParsedFormula`, update `cell.Value` and `cell.InvalidRefs` after
  - [ ] Update callers in `model/spreadsheet.go` (`DeleteRow`, `DeleteColumn`, `InsertRow`, `InsertColumn`) to pass `*Cell`
  - [ ] Rewrite `formula_shift_test.go`: remove all `#REF!` string assertions; test that `node.Invalid` is set correctly and `cell.InvalidRefs` is populated; test re-serialized string is parseable and valid

- [ ] Task 4: Update `evaluateCellRef` and `evaluateRange` to use AST coords (AC: 1–4, 9)
  - [ ] `evaluateCellRef`: check `ref.Invalid` first — if true, return `RefErrorValue{}` immediately; else use `ref.Row, ref.Col` directly (already resolved, no string parse)
  - [ ] `evaluateRange`: check `rng.Invalid` first — if true, return `RefErrorValue{}`; else use `rng.StartRow/StartCol/EndRow/EndCol` directly
  - [ ] `evaluateCellRef` no longer needs `ref.ToCoords()` at eval time — keep `ToCoords()` for other callers (tests, `dependencies.go`)

- [ ] Task 5: Update `EvaluateFormula` to use stored AST (AC: 9)
  - [ ] Change `EvaluateFormula(formula string, sheet *Spreadsheet)` to also accept `ast *Formula` (optional — nil means parse from string): `EvaluateFormula(formula string, ast *Formula, sheet *Spreadsheet)`
  - [ ] If `ast != nil`: use it directly, skip parsing
  - [ ] If `ast == nil`: parse from string (backward-compatible path for tests and any caller without stored AST)
  - [ ] Update all callers in `controller/app.go` to pass `cell.ParsedFormula` — eliminates re-parse on every evaluation
  - [ ] After load: Task 6 rebuilds `cell.ParsedFormula` before `recalculateAllFormulas` runs, so all cells already have a stored AST by the time evaluation begins — the nil-path in `EvaluateFormula` is a safety fallback only

- [ ] Task 6: Update persistence load path to rebuild AST (AC: 8)
  - [ ] In `controller/app.go:recalculateAllFormulas` (or a new `rebuildAllASTs` pass): after gob decode, for each formula cell:
    1. Parse `"=" + cell.Value` → store in `cell.ParsedFormula`
    2. Call `resolveAllCoords(cell.ParsedFormula)` to populate coord fields
    3. Call `applyInvalidRefs(cell.ParsedFormula, cell.InvalidRefs)` to restore `Invalid` flags from persisted list — safe because matching is against AST `CellRef`/`Range` nodes, never raw string text, so quoted string literals cannot be mismatched
  - [ ] This ensures that after load, all formula cells have fully initialized AST with `Invalid` flags correctly set
  - [ ] No changes to `model/file.go` encode/decode format — `GobEncode`/`GobDecode` on `Cell` handles exclusion of `ParsedFormula` transparently

- [ ] Task 7: Unit and integration tests (AC: 1–9)
  - [ ] `model/formula_shift_test.go`: rewrite `#REF!` assertions; new tests for:
    - Single ref at deleted row → AST node has `Invalid = true`; re-serialized string is valid; evaluated → `#REF!`
    - Range: boundary deletion → `#REF!`; interior deletion → range shrinks
    - Insert: coords shift correctly in AST and re-serialized string
  - [ ] `model/formula_test.go`: add `TestRefErrorValue_Propagation`; `TestEvaluateFormula_WithStoredAST` (pass pre-parsed AST)
  - [ ] `model/cell_test.go`: `TestCell_GobRoundTrip` — encode/decode preserves all fields, `ParsedFormula` is nil post-decode
  - [ ] `controller/command_test.go` or `model/spreadsheet_test.go`: undo of delete restores formula to valid state, re-evaluates correctly (AC6)

## Dev Notes

### Key Design Decision: `Invalid bool` on AST Nodes, `InvalidRefs []string` on Cell

Invalid state is explicit in the type system — no sentinel integers, no magic coordinates.

**At runtime:**
- `CellRef.Invalid = true` → `evaluateCellRef` returns `RefErrorValue{}` immediately
- `Range.Invalid = true` → `evaluateRange` returns `RefErrorValue{}` immediately
- `CellRef.Ref` and `Range.Start`/`End` are left unchanged when a ref becomes invalid — they still hold the last-valid ref string (e.g. `"B2"`), so the formula string re-serialized from the AST remains a valid, parseable expression

**At persistence (save):**
- `Cell.InvalidRefs []string` is populated by the shift function from all `node.Invalid == true` nodes: `node.Ref` for `CellRef`, `node.Start+":"+node.End` for `Range`
- `Cell.Value` (re-serialized from AST) still contains the original ref strings — it's parseable, but the `Invalid` semantic is carried by `InvalidRefs`
- Both `Cell.Value` and `Cell.InvalidRefs` are included in `GobEncode`/`GobDecode`

**At load:**
1. Parse `Cell.Value` → AST; call `resolveAllCoords` to populate coord fields
2. Call `applyInvalidRefs(ast, cell.InvalidRefs)`: walk AST nodes; for each `CellRef`, if `node.Ref` is in the `InvalidRefs` set → `node.Invalid = true`; for each `Range`, if `node.Start+":"+node.End` is in the set → `node.Invalid = true`
3. Matching is exclusively against AST node type — `CellRef` and `Range` nodes only. Quoted string literals in the formula (e.g. `="B2"`) are `String` AST nodes, never `CellRef` nodes. The parser already disambiguated them. There is no raw string scanning, no risk of false matches.

### Participle AST and Extra Fields

Participle uses struct tags (`parser:"..."`) to determine parse behavior. Extra fields without `parser` tags are ignored by the parser — they can be added freely to `CellRef` and `Range` without affecting parsing. Confirmed: `Row, Col int` fields with no tag will be zero-valued after parsing, then populated by `resolveAllCoords`.

### `GobEncode`/`GobDecode` on Cell

Gob encodes all exported fields by default. `*Formula` contains participle-internal unexported state that gob cannot handle. The `GobEncode`/`GobDecode` approach is the standard Go way to control gob serialization. Use a private shadow struct with only the fields to persist:

```go
type cellPersist struct {
    Value         string
    Computed      string
    IsFormula     bool
    IsQuotePrefix bool
    IsError       bool
    StyleId       int
    Alignment     string
    InvalidRefs   []string // persisted — used to rebuild Invalid flags on load
}
// ParsedFormula is intentionally excluded — rebuilt from Value on load
```

Import `bytes` and `encoding/gob` in `model/cell.go`.

### `EvaluateFormula` signature change

Current callers in `controller/app.go` all do:
```go
result, isErr, err := model.EvaluateFormula("="+cell.Value, c.Sheet)
```
New signature: `EvaluateFormula(formula string, ast *Formula, sheet *Spreadsheet)`. Callers pass `cell.ParsedFormula` (may be nil on first load). The `"=" +` prepend stays for the string path — the AST path ignores the string.

Alternatively, since `Cell.ParsedFormula` is available, the controller could call:
```go
result, isErr, err := model.EvaluateFormula(cell, c.Sheet)
```
passing the whole cell. This is cleaner but requires a larger signature change. Stick with the `ast *Formula` optional param for minimal surface change.

### Undo Correctness (AC6)

`DeleteRowCommand.Do()` snapshots cells with `cp := *cell` (struct copy in `spreadsheet.go:DeleteRow`). After this story, `Cell.ParsedFormula` is a pointer — struct copy gives a shallow copy sharing the same AST. The undo restore would have the *post-delete* AST on the restored cell.

Fix: before snapshotting, nil out `ParsedFormula` on the copy (the undo restore will re-parse from `cell.Value` on next evaluation, which is the pre-delete string). Or deep-copy the AST. Nil-out is simpler:
```go
cp := *cell
cp.ParsedFormula = nil  // will be rebuilt from cp.Value on next eval
snapshot[col] = &cp
```
The pre-delete `cell.Value` string is correctly captured by the struct copy (it's a string — immutable). After undo restore, first evaluation parses `cell.Value` → correct original AST.

### Dependency Graph (no change needed)

`ExtractCellReferences` in `dependencies.go` already uses AST parsing (`ParseFormula` + AST walk) with regex fallback. After this story, it still receives `"=" + cell.Value` as a string. Since `Cell.Value` is always a valid parseable string (AC7), the regex fallback is never needed. No changes required to `dependencies.go` — it already does the right thing.

### What is NOT in scope

- Circular reference detection changes
- `RecalculateAll()` stub fix (that's Story 16.2)
- Performance benchmarking (AC9 is a correctness guard, not a perf story)
- File format version bump: loading old files (without `InvalidRefs`) is safe — gob decodes a nil slice, meaning no invalid refs, which is correct for files saved before any delete operations. New files with `InvalidRefs` are not readable by older app versions, but since the app is not yet distributed this is not a concern. If it becomes one, bump the version string to `"1.3"` and skip `InvalidRefs` decoding on `"1.2"` files.

### Key Files

| File | Change |
|---|---|
| `model/formula_ast.go` | Add `Row,Col` to `CellRef`; `StartRow,StartCol,EndRow,EndCol` to `Range`; `resolveAllCoords` walker |
| `model/formula.go` | Add `RefErrorValue`; `isErrorLike`; update all propagation; `EvaluateFormula` accepts optional AST |
| `model/formula_shift.go` | Rewrite both shift functions to mutate AST coords; re-serialize string from AST |
| `model/cell.go` | Add `ParsedFormula *Formula` (runtime); `InvalidRefs []string` (persisted); `GobEncode`/`GobDecode` |
| `model/spreadsheet.go` | Pass `*Cell` to shift functions; nil snapshot fix for undo |
| `controller/app.go` | Pass `cell.ParsedFormula` to `EvaluateFormula`; rebuild ASTs on load |
| `model/formula_shift_test.go` | Rewrite all tests; add range collapse/shrink cases |
| `model/formula_test.go` | Add `RefErrorValue` propagation tests; stored-AST eval test |
| `model/cell_test.go` | Add `GobRoundTrip` test |

### References

- `model/formula_ast.go:50–89` — `CellRef`, `Range` (add coord fields here)
- `model/formula.go:208–234` — Value types (add `RefErrorValue` here)
- `model/formula.go:498–526` — `evaluateCellRef` (use stored coords, check `ref.Invalid`)
- `model/formula_shift.go:46–104` — both shift functions (full rewrite)
- `model/cell.go:4–12` — `Cell` struct (add `ParsedFormula`)
- `model/spreadsheet.go:434–496` — `DeleteRow` (snapshot nil fix + shift call update)
- `model/spreadsheet.go:333–379` — `InsertRow` (shift call update)
- `controller/app.go:186–201` — `EvaluateFormula` call site in `SetCellValue`
- `controller/app.go:258–295` — `recalculateAllFormulas` (add AST rebuild pass)
- `model/dependencies.go:140–152` — `ExtractCellReferences` (already AST-based, no change)
- Existing broken tests: `model/formula_shift_test.go:32–55` (assert `#REF!` string — must be rewritten)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 7 tasks implemented. Core design: `Invalid bool` on AST nodes, `InvalidRefs []string` on Cell, `GobEncode`/`GobDecode` excluding `ParsedFormula`, `RefErrorValue` type, `isErrorLike` helper.
- `formula_shift.go` fully rewritten — AST mutation replaces regex string substitution. Formula string stays parseable at all times (AC7).
- One design addition not in story spec: `SetError` updated to not prepend `"#ERROR "` when message already starts with `#` — ensures `#REF!` displays as `#REF!` not `#ERROR #REF!`.
- `evaluateFuncCall` propagates `RefErrorValue` args before dispatching to builtin functions — required for `SUM`, `AVG`, etc. to return `#REF!` correctly.
- Two existing controller tests updated: `TestDeleteRowCommand_RefBecomesError` now asserts `Computed="#REF!"` and parseable formula (old behavior was literal `#REF!` in formula string); `TestDeleteColumnCommand_FormulaRefRestored` was already passing.
- `restoreFormulas` updated to nil out `ParsedFormula`/`InvalidRefs` so undo re-parse is clean.
- All 3 Go packages (`model`, `controller`, `api`) build and test cleanly — zero failures.
- **Code review fixes (2026-03-07):** Three additional bugs found and fixed during adversarial code review:
  - M1: `evaluateComparison`/`evaluateAddition`/`evaluateMultiplication` evaluated right operand before short-circuiting on left `RefErrorValue` — a Go-level error from the right operand could mask the `#REF!`. Fixed by moving the `isErrorLike(left)` check before right-operand evaluation.
  - M4: `evaluateUnary` applied `toNumber()` on `RefErrorValue{}`, converting it to a generic `ErrorValue` (losing the type). Fixed by adding `isErrorLike` guard before `toNumber`.
  - M5: `evaluateCellRef` returned `ErrorValue{"referenced cell has error"}` even when the referenced cell's `Computed` was `"#REF!"` — `#REF!` did not chain through indirect references. Fixed by checking `computed == "#REF!"` and returning `RefErrorValue{}` in that case.
  - 4 new tests added: `TestRefErrorValue_LeftOperandNotMaskedByRightError`, `TestRefErrorValue_UnaryMinus`, `TestRefErrorValue_PropagatesThroughCellRef`, `TestRefErrorValue_ChainedCellRef`.

### File List

- `model/formula_ast.go` — `Row,Col,Invalid` on `CellRef`; `StartRow,StartCol,EndRow,EndCol,Invalid` on `Range`; `resolveAllCoords`, `applyInvalidRefs` walkers; exported `ResolveAllCoords`, `ApplyInvalidRefs`
- `model/formula.go` — `RefErrorValue`, `isErrorLike`; updated propagation in comparison/addition/multiplication; `EvaluateFormula` accepts optional stored AST; `evaluateCellRef`/`evaluateRange` use stored coords + `Invalid`; `evaluateFuncCall` propagates `RefErrorValue`
- `model/formula_shift.go` — full rewrite: AST mutation, re-serialization, `InvalidRefs` collection
- `model/formula_shift_test.go` — full rewrite: Cell-based API, range tests, evaluation tests, persistence round-trip
- `model/formula_test.go` — added `TestRefErrorValue_*`, `TestIsErrorLike`; all callers updated to new `EvaluateFormula` signature
- `model/cell.go` — `ParsedFormula *Formula` (runtime), `InvalidRefs []string` (persisted), `GobEncode`/`GobDecode`, `SetValue` parses+caches AST, `SetError` skip-prefix fix
- `model/cell_test.go` — `TestInvalidRefsRoundTrip` in `formula_shift_test.go` covers gob round-trip
- `model/spreadsheet.go` — shift callers pass `*Cell`; snapshot nil-fix for undo
- `controller/app.go` — all `EvaluateFormula` calls pass `cell.ParsedFormula`; `recalculateAllFormulas` has AST rebuild pass for load path
- `controller/command.go` — undo calls pass `nil` AST; `restoreFormulas` clears `ParsedFormula`/`InvalidRefs`
- `controller/command_test.go` — updated `TestDeleteRowCommand_RefBecomesError`; added `gosheet/model` import
