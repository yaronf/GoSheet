# Story 13.9: Merge Text Centering

**Epic:** 13 - Spreadsheet UX & Polish
**Story:** 13.9
**Estimated Effort:** 1 hour
**Status:** done
**Source:** epics.md, todo-2026-03-01.md

---

## Story

As a user,
I want text in merged cells to be centered by default,
so that merged headers look clean.

## Acceptance Criteria

1. **Given** I merge a range of cells
   **When** the merged cell has content
   **Then** the content is horizontally centered within the merged region

2. **Given** existing merged cells already in the spreadsheet
   **When** the grid renders
   **Then** content in all merged cells is centered

3. **Given** a merged cell has cell-level alignment set (from Story 13.8)
   **When** the merged cell renders
   **Then** the explicit alignment overrides the merge default centering

## Tasks / Subtasks

- [x] Task 1: CSS — add `.merged-anchor` centering rule (AC: 1, 2)
  - [x] In `frontend/spreadsheet.css`: added `.cell.merged-anchor { text-align: center; }`

- [x] Task 2: Frontend — mark anchor cells with CSS class (AC: 1, 2, 3)
  - [x] In `frontend/app.js` `buildSpreadsheetImpl()` merge anchor block: `td.className = 'cell merged-anchor'`
  - [x] Story 13.8 inline style override handles AC3 automatically (inline beats CSS class)

- [x] Task 3: Playwright test (AC: 1, 2, 3)
  - [x] Created `playwright_tests/test_merge_centering.spec.js` — 4 tests, all pass
  - [x] Test: merged anchor has `merged-anchor` class
  - [x] Test: merged anchor text is centered via computed style
  - [x] Test: plain cell does NOT have `merged-anchor` class
  - [x] Test: explicit left alignment on merged cell overrides centering

## Dev Notes

### Where Merge Anchor Cells Are Created

In `buildSpreadsheetImpl()` (app.js ~line 1101):
```javascript
if (merge && isAnchor) {
    const td = document.createElement('td');
    td.className = 'cell';
    td.id = `cell-${row}-${col}`;
    td.colSpan = merge.colSpan;
    td.rowSpan = merge.rowSpan;
    // ...
    tr.appendChild(td);
```

**Add**: `td.classList.add('merged-anchor');` in this block.

### Where to Apply Centering

**Option A (CSS-only, simplest):** Add to `spreadsheet.css`:
```css
.cell.merged-anchor {
  text-align: center;
}
```
This works for the default case. If Story 13.8 is implemented, inline `style.textAlign` from cell-level alignment will override CSS class (inline styles beat class-based styles).

**Option B (JS-driven):** In `applyCellValue()`, check if the cell DOM element has `colSpan > 1` and no explicit alignment is set. Set `cell.style.textAlign = 'center'` in that case.

**Recommended approach: Option A (CSS)** — simpler, 1-line CSS change. The Story 13.8 inline style override will naturally take precedence over the CSS rule.

If Story 13.8 is NOT yet done, Option A still works correctly for the basic centering requirement.

### Dependency on Story 13.8

Story 13.9 is essentially a **1-2 line change**:
1. Add `td.classList.add('merged-anchor')` in `buildSpreadsheetImpl()` merge anchor block
2. Add `.cell.merged-anchor { text-align: center; }` to `spreadsheet.css`

If Story 13.8 is implemented first, AC3 (override with explicit alignment) works automatically because inline styles beat CSS class rules. If Story 13.8 is not done yet, AC3 can be skipped or noted as a follow-up.

### CSS Selector Options

- `.cell[colspan]` — CSS attribute selector for any cell with colspan attribute
- `.cell.merged-anchor` — explicit class added in JS (cleaner, more intentional)

**Use `.cell.merged-anchor`** — it's explicit and doesn't accidentally catch other elements.

### Testing Standards (Actual Practice)

- **Playwright tests**: `playwright_tests/test_merge_centering.spec.js`
- Use `setMergeViaApi` helper from `helpers.js` to create merge regions
- Use `setCellViaApi` to set content on anchor cell
- Use `cell.evaluate(el => getComputedStyle(el).textAlign)` or check inline style for assertion
- `test.beforeEach` with `ensureSpreadsheetView(window)`, `test.afterEach` with merge cleanup via `setMergeViaApi` to remove (or `buildSpreadsheet` reset)
- ~164+ tests currently passing (may be higher if 13.8 done first) — all must remain green

### Merge API

- `GetMerges()` — in `api-client.js`, GET `/api/merges`
- `setMergeViaApi(window, startRow, startCol, rowSpan, colSpan)` — helper in `helpers.js`
- Cleanup: unmerge via `setUnmergeViaApi` or direct fetch to `/api/unmerge`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.9]
- [Source: frontend/app.js:1101-1119] — Merge anchor td creation in `buildSpreadsheetImpl()`
- [Source: frontend/app.js:1557-1600] — `applyCellValue()` where alignment is applied
- [Source: frontend/spreadsheet.css] — Where to add `.cell.merged-anchor` CSS rule
- [Source: playwright_tests/helpers.js] — `setMergeViaApi`, `ensureSpreadsheetView`
- [Source: _bmad-output/implementation-artifacts/13-8-alignment-left-right-center.md] — Story 13.8, dependency for AC3
- [Source: _bmad-output/implementation-artifacts/13-7-quote-prefix-for-text.md] — previous story patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- CSS-only approach: `.cell.merged-anchor { text-align: center }` in spreadsheet.css; `merged-anchor` class added to anchor TDs in `buildSpreadsheetImpl()`; Story 13.8 inline style override automatically satisfies AC3

### File List

- `frontend/app.js` — `buildSpreadsheetImpl()`: anchor `td.className = 'cell merged-anchor'`
- `frontend/spreadsheet.css` — Added `.cell.merged-anchor { text-align: center; }`
- `playwright_tests/test_merge_centering.spec.js` — New: 5 E2E tests (added AC2 save/reload test; fixed afterEach cleanup)

