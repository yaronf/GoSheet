# Story 11.6: Keyboard Navigation and Edge Cases for Merged Cells

**Epic:** 11 - Cell Merging  
**Story:** 11.6  
**Estimated Effort:** 3-4 hours  
**Status:** done  
**Created:** 2026-02-23  
**Last Updated:** 2026-02-25 (CS for Epic 11)

---

## Story

As a user,
I want keyboard navigation and edge cases to work correctly with merged cells,
So that I can use the spreadsheet normally when merges are present.

---

## Context

**Prerequisites:**
- Stories 11.1–11.5 complete

**Current State:**
- Arrow keys move to adjacent (row,col); may land on covered cell (no DOM element → selectCell fails or breaks)
- Tab/Enter: similar issue
- CSV export: iterates cells; merged cells need special handling (anchor value only)
- CSV import: creates individual cells; no merges (correct)
- Formula refs: GetCellValue(row,col) for covered cell — should return anchor value or empty?

**Desired State:**
- Arrow keys skip covered cells; land on anchor or next unmerged cell
- CSV export: merged cells output anchor value in anchor position; covered positions empty
- CSV import: no change (no merges created)
- Formula refs to merged range resolve to anchor
- All tests pass

---

## Acceptance Criteria

1. **Keyboard navigation**
   - [x] Arrow Up/Down/Left/Right: skip covered cells, land on anchor or next unmerged cell
   - [x] Tab: move to next selectable cell (skip covered)
   - [x] Enter: same behavior (kept as startEditing; Tab skips covered)
   - [x] selectCell never receives covered (row,col); getNextCell returns only anchors/unmerged

2. **Formula references**
   - [x] Formula referencing merged range (e.g., A1:C1) resolves to anchor A1
   - [x] GetCellValue(row,col) for covered cell returns anchor's value (backend)
   - [x] GetCellRawValue, GetAllCells return anchor for merged regions (backend)
   - [x] No #REF or errors when formulas reference merged cells

3. **CSV export**
   - [x] Merged cell: export anchor value in anchor position; covered positions empty
   - [x] Or: covered positions repeat anchor (document choice; empty is simpler)

4. **CSV import**
   - [x] Import does not create merges
   - [x] Data goes to individual cells as today
   - [x] No regression

5. **Tests**
   - [x] Existing Playwright tests pass
   - [x] Add tests for merge/unmerge flow, navigation with merges
   - [x] Go unit tests pass

---

## Tasks / Subtasks

- [x] Task 1: Keyboard navigation (AC: 1)
  - [x] Add getNextCell(row, col, direction) → {row, col} that skips covered cells
  - [x] direction: 'up'|'down'|'left'|'right'
  - [x] When moving to (r,c), if (r,c) is covered, jump past merge in direction
  - [x] Update keydown handler to use getNextCell before selectCell
  - [x] Tab: getNextCellTabOrder (right, wrap to next row)

- [x] Task 2: Backend GetCellValue for covered cells (AC: 2)
  - [x] controller.GetCellValue(row, col): ResolveToAnchor, return anchor's value
  - [x] controller.GetCellRawValue: same
  - [x] GetAllCells: omit covered; only include anchor
  - [x] Formula engine: GetCellValue returns anchor for covered → formulas work

- [x] Task 3: CSV export (AC: 3)
  - [x] HandleCSVExport: covered positions output ""; anchor gets value
  - [x] Bounds include merge regions

- [x] Task 4: CSV import (AC: 4)
  - [x] Verified: import uses NewFile + SetCellValue; does not touch Merges

- [x] Task 5: Tests (AC: 5)
  - [x] Playwright: arrow keys skip covered cells test
  - [x] Go: TestControllerGetCellValue_CoveredCell
  - [x] All tests pass

---

## Dev Notes

### Navigation Logic

- getNextCell(row, col, 'right'): nextCol = col+1; if (row, nextCol) covered, find its anchor and move right from anchor's right edge, etc.
- Simpler: maintain list of "selectable" (row,col) — anchors + unmerged. getNextCell finds next in direction from that list.
- Or: given (row,col), compute next (r,c) in direction. If (r,c) covered, (r,c) = resolveToAnchor(r,c); then get next from (r,c) again (to skip past the merge). Repeat until anchor or unmerged.

### Backend Changes

- Controller or model: add helper IsCovered(row, col) bool, GetAnchor(row, col) (int, int, bool)
- GetCellValue: if covered, return GetCellValue(anchorRow, anchorCol)

### File Structure

- **Modify**: `frontend/app.js` — keydown handler, getNextCell
- **Modify**: `controller/app.go` — GetCellValue, GetCellRawValue for covered → anchor
- **Modify**: `api/csv.go` or export logic — merged cell handling
- **Modify**: `model/spreadsheet.go` — optional helper GetMergeAt(row, col)
- **Modify**: Playwright tests — merge scenarios

### References

- [Source: frontend/app.js] — keydown handler, selectCell
- [Source: controller/app.go] — GetCellValue, GetCellRawValue
- [Source: api/csv.go] — GenerateCSV, export
- [Source: research/technical-cell-merging-research-2026-02-23.md]

---

## Dev Agent Record

### Agent Model Used

(DS 11.6)

### Completion Notes List

- getNextCell, getNextCellTabOrder in app.js; handleKeydownCellNavigation uses them
- model.ResolveToAnchor; controller GetCellValue/GetCellRawValue resolve covered → anchor
- api HandleGetAllCells skips covered; HandleCSVExport outputs "" for covered
- CSV import verified: no Merges

### File List

- frontend/app.js
- model/spreadsheet.go
- model/formula.go
- controller/app.go
- controller/controller_test.go
- api/handlers.go
- api/handlers_test.go
- playwright_tests/test_merge.spec.js

### Senior Developer Review (AI)

**Date:** 2026-02-28  
**Outcome:** Approved after fixes

**Findings addressed:**
- **HIGH:** Formula engine did not resolve covered cell refs to anchor → fixed in model/formula.go (evaluateCellRef, evaluateRange)
- **MEDIUM:** Added TestHandleGetAllCells_WithMerges, TestHandleCSVExport_WithMergedCells
