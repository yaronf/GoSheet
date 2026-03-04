# Story 13.7: Quote Prefix for Text

**Epic:** 13 - Spreadsheet UX & Polish
**Story:** 13.7
**Estimated Effort:** 1–2 hours
**Status:** done
**Source:** epics.md, todo-2026-03-01.md

---

## Story

As a user,
I want to prefix a value with `'` (apostrophe) to force text format (Excel-style),
so that numbers like `001` or `3.14` display as text without numeric conversion.

## Acceptance Criteria

1. **Given** I enter a value starting with `'` (e.g. `'001`)
   **When** I confirm the cell
   **Then** the cell displays the value without the leading quote (shows `001`)

2. **Given** I enter `'001` in a cell
   **When** the cell is rendered
   **Then** the value is treated as text — no numeric alignment, no `number-cell` CSS class

3. **Given** I enter `'001` and the cell is selected
   **When** the formula bar shows the raw value
   **Then** it shows `'001` (with the leading quote) so the user can see/edit the full raw value

4. **Given** a cell has a quote-prefixed value stored
   **When** the file is saved and reloaded
   **Then** the value is preserved correctly (still displays without quote, raw value retains quote)

## Tasks / Subtasks

- [x] Task 1: Model — strip leading quote for display, preserve in raw value (AC: 1, 2, 4)
  - [x] In `model/cell.go` `SetValue()`: detect if value starts with `'` and does NOT start with `=`
  - [x] Store raw value as-is (with the `'`) in `c.Value`
  - [x] Set `c.Computed` to value with the leading `'` stripped (e.g. `'001` → `001`)
  - [x] Set `c.IsFormula = false` (quote prefix is never a formula)
  - [x] Add a new field `c.IsQuotePrefix bool` to `Cell` struct to signal text-forced mode
  - [x] Add Go unit test in `model/cell_test.go`: `TestCellSetValue_QuotePrefix` covering `'001`, `'3.14`, `'hello`, `'` (lone quote)

- [x] Task 2: Frontend — suppress numeric class for quote-prefix cells (AC: 2)
  - [x] In `frontend/app.js` `applyCellValue()`: check `rawValue?.startsWith("'")` and force `isNum = false` so `number-cell` class is NOT applied
  - [x] No other frontend changes needed — display value comes from `computed` which already lacks the quote (handled in model)

- [x] Task 3: API — no change needed (AC: 2)
  - [x] `applyCellValue` already receives `rawValue` (returned by `GetAllCells` as `"value"` field); checking `rawValue.startsWith("'")` in `applyCellValue` is sufficient — no API or handler changes required

- [x] Task 4: Playwright test (AC: 1, 2, 3)
  - [x] Created `playwright_tests/test_quote_prefix.spec.js`
  - [x] Test: entering `'001` shows `001` in cell (no leading quote in display)
  - [x] Test: cell does NOT have `number-cell` class (also sanity test that plain `42` does get it)
  - [x] Test: formula bar shows `'001` (raw value with quote) when cell is selected

## Dev Notes

### Design Decision: Where to Implement

**The stripping of the leading `'` belongs in `model/cell.go` `SetValue()`**, following the same pattern as formula normalization:
- Raw value (`c.Value`) = `'001` (preserved for formula bar display and save/load)
- Computed value (`c.Computed`) = `001` (what renders in the cell)
- `c.IsQuotePrefix = true` (signals text mode to frontend)

This is consistent with how `IsFormula` signals formula mode and `Computed` holds display value.

**The `number-cell` suppression belongs in `frontend/app.js` `applyCellValue()`**:

Current logic (line ~1574):
```javascript
const isNum = safeValue && !isNaN(safeValue) && safeValue.trim() !== '';
cell.classList.toggle('number-cell', !!isNum);
```

With quote prefix: `safeValue` is `001` (no quote), and `!isNaN('001')` is `true`, so it would incorrectly get `number-cell`. The fix: check if `rawValue` starts with `'` and force `isNum = false`.

**No formula bar change needed**: The formula bar already calls `GetCellRawValue()` which returns `c.Value` (= `'001` with quote). AC3 is satisfied for free.

**No save/load change needed**: The model serializes `c.Value` (raw) and `c.IsQuotePrefix`. On load, `refreshAllCells()` calls the API which returns both `computed` (no quote) and `value` (raw with quote). Everything works.

### Cell Struct Change

Add `IsQuotePrefix` field to `model/cell.go`:

```go
type Cell struct {
    Value         string // Raw value — for quote-prefix cells starts with "'"
    Computed      string // What is displayed — for quote-prefix cells, quote is stripped
    IsFormula     bool
    IsQuotePrefix bool   // True if value starts with "'" (Excel-style text force)
    StyleId       int
}
```

### SetValue Logic

```go
func (c *Cell) SetValue(value string) {
    startsWithEquals := len(value) > 0 && value[0] == '='
    startsWithQuote  := len(value) > 0 && value[0] == '\''

    if startsWithEquals {
        // existing formula handling (unchanged)
        ...
    } else if startsWithQuote {
        // Quote prefix — force text mode
        c.IsFormula     = false
        c.IsQuotePrefix = true
        c.Value         = value          // preserve "'001"
        c.Computed      = value[1:]      // strip quote → "001"
    } else {
        c.IsFormula     = false
        c.IsQuotePrefix = false
        c.Value         = value
        c.Computed      = value
    }

    if !c.IsFormula {
        // For plain text and quote-prefix, Computed is already set above
    }
}
```

**Edge case**: `'` alone (just a quote, nothing after) → `c.Computed = ""` (empty display). This is valid: user typed `'` to clear/force-text an empty cell.

### Frontend `applyCellValue` Change

```javascript
// After existing rawValue check:
const isQuotePrefix = (rawValue ?? '').startsWith("'");
const isNum = !isQuotePrefix && safeValue && !isNaN(safeValue) && safeValue.trim() !== '';
cell.classList.toggle('number-cell', !!isNum);
```

This is a 2-line change in `applyCellValue`.

### What Does NOT Change

- No API endpoint changes (existing `/api/cell/set` passes `value` string as-is to `SetCellValue` → `SetValue`)
- No handler changes (except optionally adding `isQuotePrefix` to `GetAllCells` response — but since `rawValue` is already returned, frontend can derive it from `rawValue.startsWith("'")`)
- No formula bar changes — already uses `GetCellRawValue` which returns `c.Value`
- No save/load changes — `gob` serializes the full `Cell` struct including new field

### Previous Story Intelligence (Story 13.6)

- `model/cell.go` `SetValue()` was just refactored — the structure is clean with `startsWithEquals` branch. Adding `startsWithQuote` as a new `else if` branch fits naturally
- Go tests for cell are co-located in `model/cell_test.go` (not in `tests/` — architecture doc is wrong about this; reality is co-located `_test.go` files)
- Playwright tests use `setCellViaApi(window, row, col, value)` helper from `helpers.js`
- `test.afterEach` with `setCellViaApi(window, 0, 0, '')` for cleanup (Story 13.5 and 13.6 pattern)
- `applyCellValue` in `app.js` — be aware of `safeValue = value ?? ''` guard already in place
- Formula bar population: `updateFormulaBar()` at line ~1358 calls `GetCellRawValue` → returns `c.Value` — no changes needed

### Testing Standards (Actual Practice — Architecture Doc is Outdated)

- **Go unit tests**: Co-located as `*_test.go` files (e.g., `model/cell_test.go`, `controller/controller_test.go`)
- **Playwright tests**: `playwright_tests/test_quote_prefix.spec.js`
- Use `setCellViaApi` + `waitForFunction` or `toHaveText` for assertions (avoid fixed `setTimeout` waits)
- `test.beforeEach` with `ensureSpreadsheetView(window)`, `test.afterEach` with cell cleanup
- 158 tests currently passing — all must remain green

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.7]
- [Source: model/cell.go:19-46] — SetValue, existing formula/plain logic to extend
- [Source: frontend/app.js:1557-1575] — applyCellValue, isNum logic to patch
- [Source: frontend/app.js:1358-1371] — updateFormulaBar, GetCellRawValue already used
- [Source: api/handlers.go:127-153] — HandleGetAllCells, returns computed + value (raw)
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-3] — cell-level vs API error types
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-6] — Go code style
- [Source: _bmad-output/implementation-artifacts/13-6-bug-fixes-formula-merge-scroll.md] — previous story patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Code review (post-implementation): fixed L1 dead code in `SetValue()` (redundant `if !c.IsFormula && !c.IsQuotePrefix` block removed); added L2 inline editor re-edit roundtrip test

### File List

- `model/cell.go` — Added `IsQuotePrefix bool` field to `Cell` struct; new `startsWithQuote` branch in `SetValue()` strips quote for `Computed`, preserves raw in `Value`; removed dead code block (code review L1)
- `model/cell_test.go` — Added `TestCellSetValue_QuotePrefix` (4 cases) and `TestCellSetValue_NonQuotePrefix`
- `frontend/app.js` — `applyCellValue()`: added `isQuotePrefix` check to suppress `number-cell` class
- `playwright_tests/test_quote_prefix.spec.js` — New: 6 E2E tests covering AC1, AC2, AC3, inline editor re-edit roundtrip (code review L2)
