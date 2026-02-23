# Story 11.6: Keyboard Navigation and Edge Cases for Merged Cells

**Epic:** 11 - Cell Merging  
**Story:** 11.6  
**Estimated Effort:** 3-4 hours  
**Status:** backlog  
**Created:** 2026-02-23

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
- Arrow keys move to adjacent (row,col); may land on covered cell (no DOM element)
- CSV export/import doesn't account for merges

**Desired State:**
- Arrow keys skip covered cells
- CSV export: merged cells output anchor value only
- CSV import: no merge creation
- All tests pass

---

## Acceptance Criteria

1. **Keyboard navigation**
   - [ ] Arrow Up/Down/Left/Right: skip covered cells, land on anchor or next unmerged cell
   - [ ] Tab: move to next selectable cell (skip covered)
   - [ ] Enter: same behavior
   - [ ] selectCell called with resolved (row,col) — never a covered cell

2. **Formula references**
   - [ ] Formula referencing merged range (e.g., A1:C1) resolves to anchor A1
   - [ ] No #REF or errors when formulas reference merged cells
   - [ ] GetCellRawValue, GetAllCells return anchor for merged regions

3. **CSV export**
   - [ ] Merged cell exports as single value in anchor position
   - [ ] Covered positions: empty or repeat anchor (document choice)

4. **CSV import**
   - [ ] Import does not create merges
   - [ ] Data goes to individual cells as today
   - [ ] No regression for existing CSV import behavior

5. **Tests**
   - [ ] Existing Playwright tests pass
   - [ ] Add tests for merge/unmerge flow
   - [ ] Add tests for navigation with merged cells (if feasible)
   - [ ] Go unit tests pass

---

## Technical Requirements

### Navigation Logic

- When moving from (row,col), compute next (row,col) in direction
- If next is covered, recursively find next until anchor or unmerged
- Ensure we never call selectCell with covered (row,col)

### References

- [Source: frontend/app.js] - Keyboard handler, selectCell
- [Source: research/technical-cell-merging-research-2026-02-23.md]
