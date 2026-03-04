# Story 13.5: Cell Hover for Long Content

**Epic:** 13 - Spreadsheet UX & Polish  
**Story:** 13.5  
**Estimated Effort:** 1–2 hours  
**Status:** done  
**Source:** epics.md

---

## Story

As a user,
I want to see full content on hover when it doesn't fit in the cell,
So that I can read long error messages or text without editing.

## Acceptance Criteria

1. **Given** a cell displays truncated content (e.g. #ERROR with long message)
2. **When** I hover over the cell
3. **Then** a tooltip shows the full content
4. **And** the tooltip dismisses when I move the cursor away

## Tasks / Subtasks

- [x] Task 1: Add tooltip for truncated/long content (AC: 1–4)
  - [x] In `applyCellValue`, set `cell.title` to full display value when content may be truncated
  - [x] Option A: Always set title for error cells (full #ERROR message) and when value length exceeds threshold (e.g. 20 chars)
  - [ ] Option B: Set title only when `scrollWidth > clientWidth` after render (requires check after layout) — NOT chosen; Option A used per recommendation
  - [x] Clear title when cell is empty or content fits
- [x] Task 2: Verify behavior (AC: 3–4)
  - [x] Native `title` attribute shows browser tooltip on hover and dismisses on mouseout
  - [x] Test with long error message, long text, short text (no tooltip when fits)

## Dev Notes

### Current Behavior

- Cells use `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap` (spreadsheet.css ~684–686)
- `applyCellValue(cell, value, rawValue, ...)` sets `cell.textContent = value`
- Error cells: `value.startsWith('#ERROR')` → class `error-cell`
- Backend returns `display` (e.g. "#ERROR: Circular reference...") and `raw` (formula)

### Implementation Approach

- **Simplest:** Set `cell.title = value` when value is non-empty and (a) starts with `#ERROR` or (b) length > ~25 chars. Native `title` provides tooltip on hover, dismisses on mouseout.
- **More precise:** Set `cell.title = value` only when truncated. After `cell.textContent = value`, check `cell.scrollWidth > cell.clientWidth` in a `requestAnimationFrame` or after a microtask so layout is computed. If truncated, set title; else clear it.
- **Recommendation:** Start with heuristic (error cells + length threshold) for robustness; avoid layout-dependent checks if they cause flicker.

### Files to Modify

- `frontend/app.js` — `applyCellValue` function (~line 1558)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.5]
- [Source: frontend/spreadsheet.css] — .cell overflow, text-overflow
- [Source: frontend/app.js] — applyCellValue, refreshAllCells

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Implemented Option A (heuristic approach) in `applyCellValue`: sets `cell.title = value` when value is non-empty and either starts with `#ERROR` or has length > 25 chars; clears title otherwise.
- Added `cell.title = ''` to the `refreshAllCells` clear loop so titles are cleared when cells are wiped during refresh.
- Used threshold of 25 chars (>25 triggers tooltip). Native browser `title` attribute provides tooltip on hover and auto-dismisses on mouseout — no custom JS needed.
- All 6 new Playwright tests pass; full regression suite 150/150 passes.

### File List

- `frontend/app.js` (modified — `applyCellValue` and `refreshAllCells`)
- `playwright_tests/test_cell_hover_tooltip.spec.js` (new — 7 tests for tooltip behavior)

### Change Log

- 2026-03-04: Story 13.5 implemented — cell hover tooltip via native `title` attribute for error cells and long content (>25 chars).
- 2026-03-04: Code review fixes — named constant `TOOLTIP_LENGTH_THRESHOLD`, `safeValue ?? ''` null guard, stronger `#ERROR` assertion in test, `afterEach` cleanup, `loadCells` path test added, Option B checkbox corrected.
