# Story 13.6: Bug Fixes (Formula, Merge, Scroll)

**Epic:** 13 - Spreadsheet UX & Polish
**Story:** 13.6
**Estimated Effort:** 2–4 hours
**Status:** done
**Source:** epics.md, todo-2026-03-01.md, bug-formula-invalid-displayed-as-text.md

---

## Story

As a developer,
I want critical bugs fixed,
So that the spreadsheet behaves correctly.

## Acceptance Criteria

1. **Given** a user enters `=` alone in a cell
   **When** they confirm the cell
   **Then** it is rejected or treated as invalid (shows `#ERROR`, not literal `=`)

2. **Given** a user enters `=` followed by invalid formula text (e.g. `=hello`, `=foo`)
   **When** they confirm the cell
   **Then** the cell shows a formula error (e.g. `#ERROR: parse error`) — NOT the raw text `=hello`

3. **Given** a user selects a range to merge where more than one cell has non-empty content
   **When** they trigger Merge Cells
   **Then** merge is refused with a clear message (e.g. "Only one cell in the selection may have content")

4. **Given** the user has scrolled down to view rows near the bottom
   **When** new rows are added (grid expansion triggered by scroll threshold)
   **Then** the view does NOT reset to the top — scroll position is preserved

## Tasks / Subtasks

- [x] Task 1: Fix formula validation — invalid formulas show error, not literal text (AC: 1, 2)
  - [x] In `model/cell.go` `SetValue()`: when `NormalizeFormula()` fails for a `=`-prefixed value, set `IsFormula = true` and `Computed = "#ERROR: invalid formula"` instead of treating it as plain text
  - [x] Handle edge case: `=` alone (empty after equals) — same treatment: `#ERROR: invalid formula`
  - [x] Verify `controller/app.go` `SetCellValue()` still propagates correctly — no change needed if model handles it
  - [x] Add Go unit test: `TestCellSetValue_InvalidFormula` covering `=`, `=hello`, `=1+`, `=abc`

- [x] Task 2: Fix merge validation — refuse merge when multiple cells have content (AC: 3)
  - [x] In `controller/app.go` `SetMerge()`: before appending the merge, iterate over all cells in the region; count non-empty cells; if count > 1, return error "Only one cell in the selection may have content to merge"
  - [x] Use `c.Sheet.GetCell(row, col)` to check each cell; treat cell as non-empty if `cell != nil && cell.Value != ""`
  - [x] Frontend already shows alert on error from `SetMerge` result — no frontend change needed
  - [x] Add Go unit tests: `TestSetMerge_RefusesWhenMultipleCellsHaveContent`, `TestSetMerge_AllowsWhenOneCellHasContent`, `TestSetMerge_AllowsWhenNoCellsHaveContent`

- [x] Task 3: Fix scroll reset — preserve scroll position after grid expansion (AC: 4)
  - [x] In `frontend/app.js` `checkScrollPosition()`: changed to `async function`, replaced fragile `setTimeout`/`.then()` with `await buildSpreadsheet(); await refreshAllCells(); container.scrollLeft = ...; container.scrollTop = ...`
  - [x] Add Playwright test: verify scroll position is preserved after grid expansion

## Dev Notes

### Bug 1: Formula Validation (`model/cell.go`)

**Root cause** (`model/cell.go:19-46`):
```go
func (c *Cell) SetValue(value string) {
    startsWithEquals := len(value) > 0 && value[0] == '='
    if startsWithEquals {
        normalized, err := NormalizeFormula(value)
        if err == nil {
            c.IsFormula = true
            c.Value = normalized
        } else {
            // BUG: treats invalid formula as plain text
            c.IsFormula = false
            c.Value = value
            c.Computed = value  // shows "=hello" literally
        }
    }
    // ...
}
```

**Fix:** When normalization fails for a `=`-prefixed value, set `IsFormula = true` and `Computed = "#ERROR: invalid formula"`:
```go
} else {
    // Invalid formula — mark as formula with error, not plain text
    c.IsFormula = true
    c.Value = value         // preserve raw input
    c.Computed = "#ERROR: invalid formula"
}
```

This follows the existing `#ERROR:` cell-level error pattern used throughout the codebase (see architecture Pattern 3: Error Message Format).

**Also handle `=` alone** — `NormalizeFormula("=")` currently returns `("=", fmt.Errorf("invalid parse result"))` because `ast.Expr == nil`. The fix above covers this case too.

**Note:** `controller/app.go:SetCellValue()` also calls `NormalizeFormula()` to extract refs for circular reference detection. For an invalid formula, it falls back to `model.ExtractCellReferences(value)` which returns empty refs — this is fine. No change needed there.

### Bug 2: Merge Content Validation (`controller/app.go`)

**Root cause** (`controller/app.go:269-283`):
```go
func (c *AppController) SetMerge(startRow, startCol, rowSpan, colSpan int) error {
    // Only checks overlap — no content check
    for _, m := range c.Sheet.Merges {
        if rectanglesOverlap(newMerge, m) {
            return fmt.Errorf("merge overlaps existing region at (%d,%d)", m.StartRow, m.StartCol)
        }
    }
    c.Sheet.Merges = append(c.Sheet.Merges, newMerge)
    // ...
}
```

**Fix:** Add content check before appending:
```go
// Count non-empty cells in the merge region
nonEmpty := 0
for r := startRow; r < startRow+rowSpan; r++ {
    for col := startCol; col < startCol+colSpan; col++ {
        cell := c.Sheet.GetCell(r, col)
        if cell != nil && cell.Value != "" {
            nonEmpty++
        }
    }
}
if nonEmpty > 1 {
    return fmt.Errorf("only one cell in the selection may have content to merge")
}
```

The frontend (`app.js`) already calls `showAlert(error.message)` when `SetMerge` returns an error — no frontend changes needed.

**Method to use:** `c.Sheet.GetCell(row, col)` — already used in the controller. See existing usages in `SetCellValue()`.

### Bug 3: Scroll Reset (`frontend/app.js`)

**Root cause** (`frontend/app.js:877-888`):
```javascript
if (needsRebuild) {
    const oldScrollLeft = scrollLeft;
    const oldScrollTop = scrollTop;

    buildSpreadsheet().then(() => refreshAllCells());

    // BUG: setTimeout(0) fires before buildSpreadsheet() finishes
    setTimeout(() => {
        container.scrollLeft = oldScrollLeft;
        container.scrollTop = oldScrollTop;
    }, 0);
}
```

`buildSpreadsheet()` is async. The `setTimeout(..., 0)` callback may run before the DOM is fully rebuilt, so the scroll restoration has no effect (or is immediately overridden).

**Fix:** Make the block `async` and await properly. Since `checkScrollPosition` is called from inside a `setTimeout` callback (already async), we can use async/await:
```javascript
if (needsRebuild) {
    const oldScrollLeft = scrollLeft;
    const oldScrollTop = scrollTop;
    await buildSpreadsheet();
    await refreshAllCells();
    container.scrollLeft = oldScrollLeft;
    container.scrollTop = oldScrollTop;
}
```

**Important:** `checkScrollPosition()` is called from a `setTimeout(() => { checkScrollPosition(); }, 100)` in the scroll event listener. To use `await` inside, `checkScrollPosition` must be declared `async`. Check current signature at `app.js:~845`.

### Files to Modify

- `model/cell.go` — `SetValue()` fix for invalid formula handling
- `controller/app.go` — `SetMerge()` add content count validation
- `frontend/app.js` — `checkScrollPosition()` scroll preservation fix
- `tests/` (new Go test file or append to existing) — unit tests for formula + merge
- `playwright_tests/test_bug_fixes.spec.js` (new) — Playwright test for scroll preservation

### Testing Standards

- Go unit tests are co-located with source as `*_test.go` files (Go standard convention). Use `TestFeature_Scenario` naming.
- Playwright tests go in `playwright_tests/` directory, file named `test_bug_fixes.spec.js`.
- Use `setCellViaApi()` helper from `playwright_tests/helpers.js` for setting cell values in Playwright tests.
- Use fixtures from `playwright_tests/fixtures.js` for Electron app setup.

### Previous Story Intelligence (Story 13.5)

- `applyCellValue()` in `app.js` now uses `const safeValue = value ?? ''` guard — good pattern to follow for null safety in JS
- `TOOLTIP_LENGTH_THRESHOLD = 25` constant defined near `STYLE_CLASSES` — follow same constant placement pattern
- Playwright tests use `test.afterEach` with `setCellViaApi` to clean up — follow this for new tests
- 151 tests currently passing — all must remain green

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.6]
- [Source: _bmad-output/planning-artifacts/todo-2026-03-01.md]
- [Source: _bmad-output/implementation-artifacts/bug-formula-invalid-displayed-as-text.md]
- [Source: model/cell.go:19-46] — SetValue, formula validation
- [Source: model/formula.go:78-90] — NormalizeFormula
- [Source: controller/app.go:269-283] — SetMerge, no content check
- [Source: frontend/app.js:877-888] — scroll restoration, fragile setTimeout
- [Source: frontend/app.js:845-843] — scroll event listener, debounce
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-3] — cell-level error format `#ERROR: message`
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-5] — test organization

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `model/cell.go` — `SetValue()`: invalid formula branch now sets `IsFormula=true`, `Computed="#ERROR: invalid formula"`
- `model/cell_test.go` — Updated `TestCellSetValue_InvalidFormula` to assert new correct behavior
- `controller/app.go` — `SetMerge()`: added content count check; refuses if >1 cell has content
- `controller/controller_test.go` — Added `TestSetMerge_RefusesWhenMultipleCellsHaveContent`, `TestSetMerge_AllowsWhenOneCellHasContent`, `TestSetMerge_AllowsWhenNoCellsHaveContent`
- `frontend/app.js` — `checkScrollPosition()`: made `async`, replaced `.then()`/`setTimeout` with `await buildSpreadsheet(); await refreshAllCells()` then restores scroll
- `playwright_tests/test_bug_fixes.spec.js` — New: 8 E2E tests for all 3 bug fixes (including UI alert test)
- `frontend/app.js` — Also: added `.catch()` to unawaited `checkScrollPosition()` call in scroll listener
