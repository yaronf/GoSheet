# Story 19.2: Absolute Cell References (`$` Anchoring)

Status: done

## Story

As a user,
I want to write formulas with absolute references like `$A$1`, `$A1`, or `A$1`,
So that certain references don't shift when I copy/paste the formula to a new location.

## Acceptance Criteria

1. **Given** cell B1 contains `=$A$1+C1`, **when** the user copies B1 and pastes into B2, **then** B2 contains `=$A$1+C2` (absolute row+col stays fixed; relative col shifts).

2. **Given** cell B1 contains `=$A1`, **when** the user copies B1 and pastes into C3, **then** C3 contains `=$A3` (col is anchored; row shifts by +2).

3. **Given** cell B1 contains `=A$1`, **when** the user copies B1 and pastes into C3, **then** C3 contains `=B$1` (row is anchored; col shifts by +1).

4. **Given** a formula with `$`-anchored references is saved and reloaded from a `.sheet` file, **when** the file is opened, **then** the formula displays and evaluates correctly with anchors preserved.

5. **Given** the user types `=$A$1` in the formula bar or cell editor, **when** the formula is committed, **then** the formula is stored and displayed as `=$A$1` (normalization does not strip `$`).

6. **Given** a range reference with absolute anchors (e.g. `=SUM($A$1:$B$3)`), **when** pasted to a new location, **then** the range endpoints with `$` anchors remain fixed; relative endpoints shift.

## Tasks / Subtasks

- [x] Task 1: Extend the lexer and AST to support `$`-prefixed cell references (AC: 4, 5)
  - [x] In `model/formula.go`, change the `CellRef` lexer rule from `[A-Z]+\d+` to `\$?[A-Z]+\$?\d+` to accept optional `$` before the column letter and/or before the row digit
  - [x] Add `AbsCol bool` and `AbsRow bool` fields to `CellRef` in `model/formula_ast.go` (zero-value = relative; gob-safe because `CellRef` is not persisted directly)
  - [x] Update `CellRef.ToCoords()` (and `ResolveCoords()`) to strip `$` signs before parsing, and set `AbsCol`/`AbsRow` from the `Ref` string
  - [x] Add `AbsCol bool` and `AbsRow bool` fields to `Range` in `model/formula_ast.go` to carry per-endpoint anchor state (4 bools: `StartAbsCol`, `StartAbsRow`, `EndAbsCol`, `EndAbsRow`)
  - [x] Update `Range.ResolveCoords()` to delegate per-endpoint to a shared `parseRefWithAnchors()` helper
  - [x] Update `serializePrimary()` and `serializePrimaryDisplay()` in `model/formula.go` to reconstruct `$`-prefixed ref strings from `AbsRow`/`AbsCol` + coords instead of from the raw `Ref` field — this is what makes anchors survive after a coordinate mutation
  - [x] Update `CoordsToRef` callers inside `CellRef` and `Range` mutation paths (insert/delete shift, paste shift) to preserve anchor flags when rebuilding `Ref`/`Start`/`End` strings

- [x] Task 2: Update `ShiftFormulaByOffset` to respect anchors (AC: 1, 2, 3, 6)
  - [x] In `model/formula_shift.go`, `ShiftFormulaByOffset`: when processing a `CellRef`, skip `rowOffset` if `AbsRow == true`; skip `colOffset` if `AbsCol == true`
  - [x] For `Range`: apply same axis-by-axis anchor check to each of `StartRow`/`StartCol`/`EndRow`/`EndCol` using `StartAbsRow`, `StartAbsCol`, `EndAbsRow`, `EndAbsCol`
  - [x] Out-of-bounds check: only check/mark `Invalid` on the axes that were actually shifted (absolute axes never go out of bounds by shifting)
  - [x] Add unit tests in `model/formula_abs_test.go` covering: `$A$1` stays fixed on any paste direction, `$A1` col fixed/row shifts, `A$1` row fixed/col shifts, range with mixed anchors, and `=SUM($A$1:$B$3)` full-range anchor passthrough

- [x] Task 3: Ensure `normalizeFormula` preserves `$` markers (AC: 5)
  - [x] In `model/formula.go`, `normalizeFormula()` uppercases all non-string bytes — `$` passes through unchanged. Confirmed with tests; also added `resolveAllCoords` call to `NormalizeFormula` so serialization preserves anchors
  - [x] Unit tests confirm `normalizeFormula("=$a$1+b2")` → `"=$A$1+B2"` (anchors preserved, letters uppercased)

- [x] Task 4: Verify gob persistence round-trip for formulas with `$` refs (AC: 4)
  - [x] `TestGobRoundTripAbsRef` in `model/formula_abs_test.go`: sets cell to `=$A$1+C1`, gob-encodes, decodes, verifies raw value and `IsFormula` flag preserved
  - [x] `NormalizeFormula("=$A$1+C1")` returns `"=$A$1+C1"` — confirmed by `TestNormalizeFormulaWithAnchors`

- [x] Task 5: Playwright E2E tests (AC: 1–5)
  - [x] New file `playwright_tests/test_absolute_refs.spec.js`
  - [x] AC1: copy B1=`=$A$1+C1`, paste to B2 → `=$A$1+C2`
  - [x] AC2: copy B1=`=$A1`, paste to C3 → `=$A3`
  - [x] AC3: copy B1=`=A$1`, paste to C3 → `=B$1`
  - [x] AC5: set cell to `=$A$1`, verify raw value roundtrips correctly
  - [x] AC1 variant: paste right → `=$A$1+E1`
  - [x] All waits use `waitForFunction` pattern; no sleeps

## Dev Notes

### Architecture Overview

This is a pure **model-layer grammar extension** — no backend API changes, no frontend JS changes (other than what naturally flows through the existing `ShiftFormula` API call).

**The stack of changes is:**
1. Lexer rule (`model/formula.go`) — widen `CellRef` pattern
2. AST structs (`model/formula_ast.go`) — add anchor bools
3. Coord resolution (`formula_ast.go`) — parse `$` from `Ref`
4. Serialization (`formula.go` `serializePrimary`/`serializePrimaryDisplay`) — emit `$` back from anchor bools
5. Shift logic (`formula_shift.go`) — skip offset on anchored axes
6. Tests — unit + E2E

### Critical Lexer Detail

Current lexer rule (in `model/formula.go`, line 14):
```go
{Name: "CellRef", Pattern: `[A-Z]+\d+`},
```

New rule needed:
```go
{Name: "CellRef", Pattern: `\$?[A-Z]+\$?\d+`},
```

**Important:** The `CellRef` rule must still precede `Ident` in the rules slice — participle's `MustSimple` lexer matches in order and the `Ident` pattern (`[A-Za-z_][A-Za-z0-9_]*`) would otherwise consume the letter part of cell refs without the `$`.

The `$` before the column letter or row number is optional in both positions, covering all four forms:
- `A1` (no anchors)
- `$A1` (col anchored)
- `A$1` (row anchored)
- `$A$1` (both anchored)

### Parsing `$` in `ToCoords()` / `ResolveCoords()`

`CellRef.Ref` after parsing will contain the raw token including `$` signs, e.g. `"$A$1"`, `"$A1"`, `"A$1"`.

Recommended helper (`parseRefWithAnchors`):
```go
func parseRefWithAnchors(ref string) (row, col int, absRow, absCol bool) {
    s := ref
    if strings.HasPrefix(s, "$") {
        absCol = true
        s = s[1:]
    }
    // find boundary between letters and digits
    i := 0
    for i < len(s) && s[i] >= 'A' && s[i] <= 'Z' {
        i++
    }
    colStr := s[:i]
    s = s[i:]
    if strings.HasPrefix(s, "$") {
        absRow = true
        s = s[1:]
    }
    col = ColLetterToIndex(colStr)
    var rowNum int
    fmt.Sscanf(s, "%d", &rowNum)
    row = rowNum - 1
    return
}
```

Call this from `CellRef.ResolveCoords()` and `Range.ResolveCoords()`.

### Serialization: Preserving `$` After Coordinate Mutation

**Critical insight:** After `ShiftFormulaByOffset` mutates `CellRef.Row`/`CellRef.Col`, it calls `CoordsToRef(newRow, newCol)` which produces bare `"B2"` — losing the `$` markers. The fix is to use a new helper `coordsToRefWithAnchors`:

```go
func coordsToRefWithAnchors(row, col int, absRow, absCol bool) string {
    colPart := ColIndexToLetter(col)
    rowPart := fmt.Sprintf("%d", row+1)
    if absCol {
        colPart = "$" + colPart
    }
    if absRow {
        rowPart = "$" + rowPart
    }
    return colPart + rowPart
}
```

Use this wherever `CoordsToRef` is called on a `CellRef` or `Range` that carries anchor flags:
- In `ShiftFormulaByOffset` (for both `CellRef` and `Range` coord updates)
- In `shiftCellRef` and `shiftRange` (for insert/delete shifts — those should also preserve anchors)

Update `serializePrimary` and `serializePrimaryDisplay` to use `coordsToRefWithAnchors` instead of `prim.CellRef.Ref` so that the serialized string always reflects the current (post-mutation) coords with anchors:
```go
// serializePrimary: replace:
//   return prim.CellRef.Ref
// with:
//   return coordsToRefWithAnchors(prim.CellRef.Row, prim.CellRef.Col, prim.CellRef.AbsRow, prim.CellRef.AbsCol)
```

**But wait** — for `Invalid` refs, we still want `serializePrimary` to emit the original `Ref` string (so `cell.Value` stays parseable). Only `serializePrimaryDisplay` renders `Invalid` refs as `#REF!`. So the logic is:
- If `CellRef.Invalid` → `serializePrimary` returns `prim.CellRef.Ref` (original, unchanged); `serializePrimaryDisplay` returns `"#REF!"`
- If not `Invalid` → both serializers use `coordsToRefWithAnchors(row, col, absRow, absCol)`

Similarly for `Range`:
- If `Invalid` → `serializePrimary` returns `prim.Range.Start + ":" + prim.Range.End`; `serializePrimaryDisplay` returns `"#REF!"`
- If not `Invalid` → both use `coordsToRefWithAnchors` per-endpoint

### `normalizeFormula` and `$`

`normalizeFormula` uppercases every byte that is not inside a string literal. The `$` character is `0x24` — not a letter, passes through `strings.ToUpper` unchanged. So `=$a$1` → `=$A$1` naturally. **No code change needed here** — just verify with a test.

### Insert/Delete Shift (`shiftCellRef`, `shiftRange`)

When a row/col is inserted or deleted, `shiftCellRef` in `formula_shift.go` mutates `ref.Row`/`ref.Col` and then calls `CoordsToRef`. After this story, it must call `coordsToRefWithAnchors` instead to preserve anchors.

Similarly `shiftRange*` functions rebuild `rng.Start`/`rng.End`.

However, insert/delete shifts should arguably move absolute refs too — in Excel, inserting a row above `$A$1` does shift it to `$A$2`. For now: **preserve existing insert/delete behavior** (absolute refs are relative to the grid, not the content). This is an open question but is out of scope for this story. Focus only on `ShiftFormulaByOffset` (paste shift) for the anchor-skip behavior. Add a `// TODO(19.2): decide if absolute refs should resist insert/delete shifts` comment in `shiftCellRef`.

### Gob Persistence

`cell.Value` stores the raw formula string including `$` signs (e.g. `=$A$1+C1`). `GobEncode` persists `Value` and `InvalidRefs`. `ParsedFormula` is excluded (runtime only). On load, `cell.SetValue` calls `ParseFormula` which will parse the `$`-inclusive string, then `resolveAllCoords` sets `AbsRow`/`AbsCol`. **No file format version bump needed** — `$` refs are just a wider set of valid formula strings.

### Testing Approach

- Unit tests in `model/formula_shift_paste_test.go` (or a new `model/formula_abs_test.go`) — focus on: `parseRefWithAnchors` helper, `ShiftFormulaByOffset` with anchor variants, `NormalizeFormula` preserving `$`, gob round-trip
- Playwright E2E in `playwright_tests/test_absolute_refs.spec.js` — 5 tests covering the 5 ACs
- **No existing tests should regress** — `CellRef` with no `$` has `AbsRow=false, AbsCol=false` (zero values), so all existing behavior is unchanged

### Complexity Limits

- Go: max cyclomatic complexity 20 (hard; soft target 15) per `.golangci.yml`
- JS: max cyclomatic complexity 20 per ESLint config (caught the 23 violation in Story 19.1 — extract helpers if needed)
- `parseRefWithAnchors` is a straight-line helper — well under limits
- `coordsToRefWithAnchors` is trivial

### Key Files to Touch

- `model/formula.go` — lexer `CellRef` pattern (1 line); `serializePrimary`/`serializePrimaryDisplay` to use `coordsToRefWithAnchors`
- `model/formula_ast.go` — `CellRef` struct (add `AbsRow`, `AbsCol`); `Range` struct (add 4 anchor bools); `ResolveCoords()` methods
- `model/coords.go` — add `coordsToRefWithAnchors()` helper
- `model/formula_shift.go` — `ShiftFormulaByOffset` anchor-aware axis skipping; update `CoordsToRef` → `coordsToRefWithAnchors` calls; add `TODO` comment in `shiftCellRef`
- `model/formula_abs_test.go` (new) — or extend `formula_shift_paste_test.go`
- `playwright_tests/test_absolute_refs.spec.js` (new)

### References

- [Source: model/formula.go:12-14] — `formulaLexer` `CellRef` pattern and ordering constraint
- [Source: model/formula_ast.go:50-57] — `CellRef` struct with `Ref`, `Row`, `Col`, `Invalid`
- [Source: model/formula_ast.go:83-108] — `Range` struct and `ResolveCoords()`
- [Source: model/formula_shift.go:199-245] — `ShiftFormulaByOffset` implementation (Story 19.1)
- [Source: model/coords.go:71-75] — `CoordsToRef` — needs `$`-aware companion
- [Source: model/cell.go:17-72] — gob encode/decode; `Value` is what persists
- [Source: _bmad-output/planning-artifacts/epics.md#Story 19.2] — acceptance criteria and implementation notes

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Extended `CellRef` lexer pattern to `\$?[A-Z]+\$?\d+`; added `AbsRow`/`AbsCol` to `CellRef` and `StartAbsRow/Col`/`EndAbsRow/Col` to `Range`
- Added `parseRefWithAnchors()` and `coordsToRefWithAnchors()` to `model/coords.go`; `CellRef.ResolveCoords()` and `Range.ResolveCoords()` now populate anchor flags
- Updated `serializePrimary()` and `serializePrimaryDisplay()` to use `coordsToRefWithAnchors()` so mutations (paste, insert/delete) preserve `$` markers in output
- `NormalizeFormula` now calls `resolveAllCoords` before serializing so anchor flags are populated
- `ShiftFormulaByOffset` skips row/col offset on anchored axes; only non-anchored axes checked for out-of-bounds
- `shiftCellRef`/`shiftRangeInsert`/`shiftRangeDelete` updated to use `coordsToRefWithAnchors` — anchors survive insert/delete shifts too
- `$`-absolute ref syntax deferred for undo/redo special-casing (not needed — flows through existing `SetRangeValuesCommand`)
- 20 Go unit tests pass; 5 Playwright E2E tests pass; all pre-existing model + paste-shift tests pass; lint clean

### File List

- model/formula.go
- model/formula_ast.go
- model/formula_shift.go
- model/coords.go
- model/formula_abs_test.go
- playwright_tests/test_absolute_refs.spec.js
- _bmad-output/implementation-artifacts/19-2-absolute-cell-references.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
