# Story 11.6: Keyboard Navigation and Edge Cases for Merged Cells

**Epic:** 11 - Cell Merging  
**Story:** 11.6  
**Estimated Effort:** 3-4 hours  
**Status:** ready-for-dev  
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
   - [ ] Arrow Up/Down/Left/Right: skip covered cells, land on anchor or next unmerged cell
   - [ ] Tab: move to next selectable cell (skip covered)
   - [ ] Enter: same behavior
   - [ ] selectCell never receives covered (row,col); always resolved to anchor or unmerged

2. **Formula references**
   - [ ] Formula referencing merged range (e.g., A1:C1) resolves to anchor A1
   - [ ] GetCellValue(row,col) for covered cell returns anchor's value (backend)
   - [ ] GetCellRawValue, GetAllCells return anchor for merged regions (backend)
   - [ ] No #REF or errors when formulas reference merged cells

3. **CSV export**
   - [ ] Merged cell: export anchor value in anchor position; covered positions empty
   - [ ] Or: covered positions repeat anchor (document choice; empty is simpler)

4. **CSV import**
   - [ ] Import does not create merges
   - [ ] Data goes to individual cells as today
   - [ ] No regression

5. **Tests**
   - [ ] Existing Playwright tests pass
   - [ ] Add tests for merge/unmerge flow, navigation with merges
   - [ ] Go unit tests pass

---

## Tasks / Subtasks

- [ ] Task 1: Keyboard navigation (AC: 1)
  - [ ] Add getNextCell(row, col, direction) → {row, col} that skips covered cells
  - [ ] direction: 'up'|'down'|'left'|'right'
  - [ ] When moving to (r,c), if (r,c) is covered, recurse to next in direction
  - [ ] Update keydown handler to use getNextCell before selectCell
  - [ ] Tab/Enter: use same logic (next cell in tab order)

- [ ] Task 2: Backend GetCellValue for covered cells (AC: 2)
  - [ ] controller.GetCellValue(row, col): if (row,col) is covered, return anchor's value
  - [ ] controller.GetCellRawValue: same
  - [ ] GetAllCells: for merged regions, only include anchor; omit covered (or document)
  - [ ] Formula engine: range A1:C1 when merged → resolve to A1. May already work if GetCellValue returns anchor value for covered.

- [ ] Task 3: CSV export (AC: 3)
  - [ ] In GenerateCSV / export path: when iterating cells, if (row,col) is covered, output empty string (or skip)
  - [ ] Anchor position gets anchor value
  - [ ] Verify in api/csv.go or controller export logic

- [ ] Task 4: CSV import (AC: 4)
  - [ ] Verify import does not touch Merges; data goes to Cells only
  - [ ] No code change expected; regression test

- [ ] Task 5: Tests (AC: 5)
  - [ ] Playwright: test merge, navigate with arrows, verify no errors
  - [ ] Playwright: test CSV export with merged cells
  - [ ] Go: test GetCellValue for covered cell returns anchor value
  - [ ] All tests pass

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

(To be filled by dev agent)

### Completion Notes List

### File List
