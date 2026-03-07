# Story 15.6: EvaluateFormula Returns Value Instead of String

Status: done

## Story

As a developer,
I want `EvaluateFormula` to return a typed `Value` instead of `(string, bool, error)`,
So that callers never need to string-construct or re-parse evaluation results, and error handling is done through the type system rather than string conventions.

## Background / Technical Debt Being Fixed

`EvaluateFormula` currently has this signature:

```go
func EvaluateFormula(formula string, storedAST *Formula, sheet *Spreadsheet) (string, bool, error)
```

The `string` return is a serialised `Value`, the `bool` flags whether it is an error value.  Every caller in `controller/app.go` and `controller/command.go` does:

```go
result, isErr, err := model.EvaluateFormula("="+cell.Value, cell.ParsedFormula, c.Sheet)
if err != nil {
    cell.SetError(err.Error())
} else if isErr {
    cell.SetError(result)       // re-parses a string we just serialised
} else {
    cell.SetComputed(result)
}
```

Problems:
1. A typed `Value` is available inside `EvaluateFormula`; serialising it and having callers branch on a `bool` flag is a string round-trip.
2. `SetError` needed a special-case in Story 15.5 (`if msg[0] == '#'` skip the `"#ERROR "` prefix) specifically to handle `"#REF!"` coming back as a string.  That is a smell caused by this design.
3. Two separate error channels (`bool` flag vs `error` return) are confusing.  Parse/eval errors are distinct from value-level errors (`ErrorValue`, `RefErrorValue`) and should be communicated differently.

The fix: return `(Value, error)` from `EvaluateFormula`.  The `error` return is only for hard failures (parse error, eval machinery error).  The `Value` is always typed — callers switch on it.

## Acceptance Criteria

**AC1 — Signature change**
`EvaluateFormula` returns `(model.Value, error)`.  `error` is non-nil only for parse/eval machinery failures.  `ErrorValue` and `RefErrorValue` are returned as the `Value` (not via the `error` channel).

**AC2 — Caller dispatch uses type switch**
All callers in `controller/app.go`, `controller/command.go` use a type switch (or `isErrorLike`) on the returned `Value` to call `cell.SetError`/`cell.SetComputed` — no `bool` flag, no string inspection.

**AC3 — `#REF!` displays correctly without string hacks**
`SetError` no longer needs the `if msg[0] == '#'` special-case.  `RefErrorValue` is handled before `SetError` is called, so `SetError` can always prepend `"#ERROR "` and the `#REF!` path never goes through it.

**AC4 — All existing tests pass unchanged**
No behaviour change for end users.  All Go unit tests pass.

## Tasks / Subtasks

- [x] Task 1: Change `EvaluateFormula` signature (model/formula.go)
  - [x] Return `(Value, error)` instead of `(string, bool, error)`
  - [x] On parse error: return `nil, fmt.Errorf("parse error: %w", err)`
  - [x] On eval error: return `nil, fmt.Errorf("eval error: %w", err)`
  - [x] On success: return the raw `Value` (may be `ErrorValue`, `RefErrorValue`, `NumberValue`, etc.)
  - [x] Remove the `switch ev := result.(type)` block that converts to string

- [x] Task 2: Update all callers (controller/app.go, controller/command.go)
  - [x] Used `cell.SetFromValue(val)` helper — DRY, 6 call sites updated

- [x] Task 3: Clean up `SetError` in model/cell.go
  - [x] Reverted `if msg[0] == '#'` special-case — `SetError` always prepends `"#ERROR "` again

- [x] Task 4: Add `SetRefError()` and `SetFromValue()` helpers on Cell
  - [x] `func (c *Cell) SetRefError()` sets `c.Computed = "#REF!"`, `c.IsError = true`
  - [x] `func (c *Cell) SetFromValue(v Value)` dispatches to SetRefError/SetError/SetComputed

- [x] Task 5: `valueToString` kept internal; callers use `SetFromValue` — no need to export

- [x] Task 6: Update formula_test.go and formula_shift_test.go callers
  - [x] All ~44 `EvaluateFormula` call sites updated to `(Value, error)` pattern
  - [x] Deep path at line 782 replaced with `firstCellRef(cell)` helper

- [x] Task 7: Verify no regression
  - [x] `go test ./...` passes — all model, controller, api packages green

## Dev Notes

### Cleanest dispatch pattern

Option A — type switch at each call site (explicit, easy to grep):
```go
val, err := model.EvaluateFormula("="+cell.Value, cell.ParsedFormula, c.Sheet)
if err != nil {
    cell.SetError(err.Error())
    return
}
switch v := val.(type) {
case model.ErrorValue:
    cell.SetError(v.Error.Error())
case model.RefErrorValue:
    cell.SetRefError()
default:
    cell.SetComputed(model.ValueToString(val))
}
```

Option B — single `Cell.SetFromValue(val Value)` helper (DRY, fewer lines at each call site):
```go
val, err := model.EvaluateFormula("="+cell.Value, cell.ParsedFormula, c.Sheet)
if err != nil {
    cell.SetError(err.Error())
} else {
    cell.SetFromValue(val)
}
```
`SetFromValue` is defined on `Cell` in `model/cell.go` and imports nothing from `controller`.  Recommended — there are 6 call sites.

### `valueToString` export

Currently unexported.  If `SetFromValue` is added to `Cell`, it can call `valueToString` internally — no need to export.  If callers need it directly, export as `ValueToString`.

### `SetError` cleanup

Current (post Story 15.5):
```go
func (c *Cell) SetError(msg string) {
    if len(msg) > 0 && msg[0] == '#' {
        c.Computed = msg
    } else {
        c.Computed = "#ERROR " + msg
    }
    c.IsError = true
}
```

After this story, `#REF!` never goes through `SetError` — it goes through `SetRefError()` or `SetFromValue`.  Revert to the simple form:
```go
func (c *Cell) SetError(msg string) {
    c.Computed = "#ERROR " + msg
    c.IsError = true
}
```

### Call sites (use LSP findReferences to confirm)

`controller/app.go`: lines ~155, ~188, ~244, ~284
`controller/command.go`: lines ~172, ~241
`model/formula_test.go`: ~38 call sites — all currently pass `nil` AST; return type changes from `(string, bool, error)` to `(Value, error)`

### Key Files

| File | Change |
|---|---|
| `model/formula.go` | `EvaluateFormula` signature → `(Value, error)` |
| `model/cell.go` | Add `SetRefError()` or `SetFromValue(Value)`; revert `SetError` |
| `controller/app.go` | Update all 4 call sites |
| `controller/command.go` | Update both call sites |
| `model/formula_test.go` | Update all call sites |

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
