# Story 19.1: Formula Reference Shift on Paste

Status: done

## Story

As a user,
I want copied formulas to adjust their cell references when pasted to a new location,
So that relative formulas work correctly after copy/paste — matching the expected behaviour from Excel/Google Sheets.

## Acceptance Criteria

1. **Given** cell A1 contains `=B1+C1`, **when** the user copies A1 and pastes into A2, **then** A2 contains `=B2+C2` (references shifted down by 1 row).

2. **Given** cell A1 contains `=B1+C1`, **when** the user copies A1 and pastes into B1, **then** B1 contains `=C1+D1` (references shifted right by 1 column).

3. **Given** a range A1:A3 contains formulas `=B1`, `=B2`, `=B3`, **when** the user copies A1:A3 and pastes into C1, **then** C1:C3 contain `=D1`, `=D2`, `=D3` respectively (each formula shifts relative to its own position in the range).

4. **Given** a formula contains an absolute reference styled as `$B$1` (or any `$`-anchored part), **when** the formula is pasted to a new location, **then** the absolute reference is unchanged. *(Note: the current parser may not support `$` syntax yet — if not, treat all refs as relative for now and document as a known limitation.)*

5. **Given** a formula reference would shift outside the valid grid (row < 0 or col < 0), **when** the paste is performed, **then** the shifted reference is replaced with `#REF!` in the stored formula value.

6. **Given** a non-formula value (plain text, number) is pasted, **when** the paste is performed, **then** the value is pasted unchanged — no shifting applied.

7. **Given** a single-cell copy of a formula, **when** pasted into a single cell, **then** references shift by `(destRow - srcRow, destCol - srcCol)`.

## Tasks / Subtasks

- [x] Task 1: Add `ShiftFormulaByOffset` function in Go backend (AC: 1–5, 7)
  - [x] Create or extend `model/formula_shift.go` with `ShiftFormulaByOffset(formula string, rowOffset, colOffset int) (string, error)`
  - [x] Parse formula string via `ParseFormula()` (strips leading `=` if present)
  - [x] Walk AST via `WalkPrimaries()` — for each `CellRef`: apply `row + rowOffset`, `col + colOffset`; if result < 0, mark `Invalid = true`
  - [x] For each `Range`: shift all four endpoints (`StartRow`, `StartCol`, `EndRow`, `EndCol`) by offset; mark `Invalid` if any endpoint goes out of bounds (row/col < 0)
  - [x] Re-serialize AST back to string via `SerializeForDisplay()` (renders invalid nodes as `#REF!`)
  - [x] Return shifted formula string with leading `=` prefix
  - [x] Add unit tests in `model/formula_shift_paste_test.go` covering: basic row/col shift, range shift, out-of-bounds → `#REF!`, non-formula passthrough, zero-offset noop

- [x] Task 2: Add API endpoint `POST /api/formula/shift` (AC: 1–5)
  - [x] Add `HandleShiftFormula` in `api/handlers.go`; parse request, call `model.ShiftFormulaByOffset`, return JSON
  - [x] Register route in `server/main.go`: `http.HandleFunc("/api/formula/shift", cors(srv.HandleShiftFormula))`
  - [x] Add `ShiftFormula` client function in `frontend/api-client.js` (POST wrapper with error fallback)

- [x] Task 3: Update frontend paste logic to shift formulas (AC: 1–7)
  - [x] Added `ShiftFormula` import in `frontend/app-file-ops.js`
  - [x] Multi-cell paste: compute `rowOffset = targetRow - styleClipboard.startRow`, `colOffset = targetCol - styleClipboard.startCol`; shift any value starting with `=`
  - [x] Single-cell paste: also shift if value starts with `=`, `styleClipboard` is non-null, and target differs from copy origin
  - [x] Removed `// TODO: Adjust relative formula references on paste (Epic 18 scope)` comment

- [x] Task 4: Playwright tests (AC: 1–7)
  - [x] File: `playwright_tests/test_formula_paste_shift.spec.js` (new file, 5 tests)
  - [x] AC1: copy `=B1+C1` from A1, paste to A2 → A2 shows `=B2+C2`
  - [x] AC2: copy `=B1+C1` from A1, paste to B1 → B1 shows `=C1+D1`
  - [x] AC3: copy range A1:A3 with `=B1`, `=B2`, `=B3`, paste to C1 → C1:C3 have `=D1`, `=D2`, `=D3`
  - [x] AC6: copy plain text "hello", paste to another cell → unchanged
  - [x] Zero offset: paste to same location → formula unchanged
  - [x] All tests use condition-based waiting (`waitForFunction`), no sleeps

## Dev Notes

### Offset Calculation

The key insight is that `styleClipboard` (in `app-file-ops.js`) already stores `{ startRow, startCol }` — the top-left cell of the copied range. When building `cellsToSet`, each pasted cell at `(targetRow + ri, targetCol + ci)` was originally at `(styleClipboard.startRow + ri, styleClipboard.startCol + ci)`. So:

```
rowOffset = targetRow - styleClipboard.startRow
colOffset = targetCol - styleClipboard.startCol
```

These offsets are **constant for the entire paste operation** (all cells in the range shift by the same amount). This matches Excel/Google Sheets semantics: pasting a range moves all refs by the distance between copy origin and paste destination.

**Single-cell paste caveat**: `styleClipboard` is set during copy (for multi-cell) but also has `startRow`/`startCol` for single-cell (`startRow === endRow` path). The offset computation is the same.

**If `styleClipboard` is null** (e.g. pasting from an external app): no shifting — pass values through unchanged.

### Go Backend: serializeComparison visibility

`serializeComparison` in `model/formula.go` is package-private (lowercase). `ShiftFormulaByOffset` lives in the same package (`model`), so it can call it directly. No export needed.

The new function signature:

```go
// ShiftFormulaByOffset returns formula with all relative cell/range refs shifted by
// (rowOffset, colOffset). Returns the original string unchanged if it is not a formula.
// Refs that would land outside the grid (row < 0 or col < 0) become #REF!.
func ShiftFormulaByOffset(formula string, rowOffset, colOffset int) (string, error)
```

Implementation sketch:
```go
func ShiftFormulaByOffset(formula string, rowOffset, colOffset int) (string, error) {
    if !strings.HasPrefix(formula, "=") {
        return formula, nil  // not a formula
    }
    raw := formula[1:] // strip "="
    ast, err := ParseFormula(raw)
    if err != nil {
        return formula, nil  // unparseable, return as-is
    }
    WalkPrimaries(ast, func(prim *Primary) {
        if prim.CellRef != nil {
            newRow := prim.CellRef.Row + rowOffset
            newCol := prim.CellRef.Col + colOffset
            if newRow < 0 || newCol < 0 {
                prim.CellRef.Invalid = true
            } else {
                prim.CellRef.Row = newRow
                prim.CellRef.Col = newCol
                prim.CellRef.Ref = CoordsToRef(newRow, newCol)
            }
        }
        if prim.Range != nil {
            sr, sc := prim.Range.StartRow+rowOffset, prim.Range.StartCol+colOffset
            er, ec := prim.Range.EndRow+rowOffset, prim.Range.EndCol+colOffset
            if sr < 0 || sc < 0 || er < 0 || ec < 0 {
                prim.Range.Invalid = true
            } else {
                prim.Range.StartRow, prim.Range.StartCol = sr, sc
                prim.Range.EndRow, prim.Range.EndCol = er, ec
                prim.Range.Start = CoordsToRef(sr, sc)
                prim.Range.End = CoordsToRef(er, ec)
            }
        }
    })
    result := serializeComparison(ast.Expr.Comparison)
    if result == "" {
        return formula, nil
    }
    return "=" + result, nil
}
```

### API endpoint design

Keep it minimal — this is a pure transformation, no spreadsheet state involved:

```
POST /api/formula/shift
Request:  { "formula": "=A1+B2", "row_offset": 2, "col_offset": 1 }
Response: { "shifted": "=C3+D4" }
```

No auth, no undo, no side effects. The endpoint is stateless.

### Frontend: where to add the shift call

In `pasteFromClipboard()` multi-cell path (`app-file-ops.js`):

```js
// After: cellsToSet.push({ row, col, value: cells[ci] })
// Change to:
let value = cells[ci];
if (value.startsWith('=') && styleClipboard) {
  const rowOffset = targetRow - styleClipboard.startRow;
  const colOffset = targetCol - styleClipboard.startCol;
  if (rowOffset !== 0 || colOffset !== 0) {
    value = await window.electronAPI.shiftFormula(value, rowOffset, colOffset);
  }
}
cellsToSet.push({ row: targetRow + ri, col: targetCol + ci, value });
```

This is awaited inside the for-loop. If performance becomes an issue (large paste), batch into a single API call — but for typical paste sizes this is fine.

### Key files to touch

- `model/formula_shift.go` — add `ShiftFormulaByOffset()`
- `model/formula_shift_test.go` (new) or extend existing tests
- `api/handlers.go` — add `HandleShiftFormula`
- `api/openapi.yaml` — add `/formula/shift` path
- `controller/app.go` — register route
- `electron/preload.js` — add `shiftFormula` IPC bridge
- `frontend/app-file-ops.js` — update `pasteFromClipboard()`
- `playwright_tests/test_formula_paste_shift.spec.js` (new)

### Complexity limits

- Go functions: max 15 cyclomatic complexity (project limit from Story 10.3 / 16.6)
- JS functions: max 20 cyclomatic complexity
- `ShiftFormulaByOffset` should be well within limits (simple linear walk)

### Absolute ref syntax (`$`)

The current Participle lexer grammar (`model/formula.go`) does NOT support `$A$1` syntax. AC4 is aspirational. For this story: treat all refs as relative. Document in Dev Agent Record that `$`-anchoring is a future enhancement. Do NOT implement `$` syntax unless it's already in the grammar.

### Undo/Redo

The shifted formula goes through the existing `SetRangeValues` → `SetRangeValuesCommand` path, so undo/redo works automatically.

### References

- [Source: model/formula_shift.go] — existing AST shift infrastructure (`WalkPrimaries`, `shiftCellRef`, `shiftRange`, `serializeComparison`)
- [Source: model/formula_ast.go] — `CellRef`, `Range`, `Primary`, `WalkPrimaries`
- [Source: model/formula.go:74] — `ParseFormula()`; [Source: model/formula.go:175] — `serializeComparison()`
- [Source: frontend/app-file-ops.js:284] — `styleClipboard` with `startRow`/`startCol` copy origin
- [Source: frontend/app-file-ops.js:399] — TODO comment: "Adjust relative formula references on paste"
- [Source: api/handlers.go] — `HandleGetCellRawValue` as pattern for a simple read-only endpoint
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 19] — story requirements

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `ShiftFormulaByOffset(formula, rowOffset, colOffset)` added to `model/formula_shift.go`; reuses `WalkPrimaries`, `CellRef`/`Range` mutation, and `SerializeForDisplay` (invalid nodes render as `#REF!`)
- Stateless API endpoint `POST /api/formula/shift` added to `api/handlers.go`, registered in `server/main.go`
- `ShiftFormula` client wrapper added to `frontend/api-client.js` with error fallback (returns original formula on failure)
- Both single-cell and multi-cell paste paths in `pasteFromClipboard()` updated; offset = `(targetRow - styleClipboard.startRow, targetCol - styleClipboard.startCol)` — constant for the whole paste
- `styleClipboard` already stores copy origin — no new state needed
- `$`-absolute ref syntax deferred to Story 19.2 (parser doesn't support it); documented as known limitation
- 5 Playwright tests pass; 11 existing copy/paste range tests still pass; Go lint clean

### File List

- model/formula_shift.go
- model/formula_shift_paste_test.go
- api/handlers.go
- server/main.go
- frontend/api-client.js
- frontend/app-file-ops.js
- playwright_tests/test_formula_paste_shift.spec.js
- _bmad-output/implementation-artifacts/19-1-formula-reference-shift-on-paste.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
