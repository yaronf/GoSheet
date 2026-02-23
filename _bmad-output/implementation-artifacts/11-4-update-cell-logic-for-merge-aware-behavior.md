# Story 11.4: Update Cell Logic for Merge-Aware Behavior

**Epic:** 11 - Cell Merging  
**Story:** 11.4  
**Estimated Effort:** 4-5 hours  
**Status:** backlog  
**Created:** 2026-02-23

---

## Story

As a user,
I want selection, loading, and refresh to work correctly with merged cells,
So that I can interact with merged cells without errors.

---

## Context

**Prerequisites:**
- Story 11.3 complete (merge-aware buildSpreadsheet, getCellElement)

**Current State:**
- loadCells, refreshAllCells use `getElementById('cell-${row}-${col}')` — fails for covered cells
- selectCell assumes every (row,col) has a DOM element

**Desired State:**
- All cell logic uses getCellElement or equivalent
- Covered cells map to anchor for selection and display

---

## Acceptance Criteria

1. **selectCell(row, col)**
   - [ ] When (row,col) is covered by a merge, maps to anchor (startRow, startCol) and selects anchor
   - [ ] Click handler for merged cell area selects anchor
   - [ ] No errors when clicking covered region

2. **loadCells() / refreshAllCells()**
   - [ ] Use getCellElement(row, col) instead of getElementById
   - [ ] Only update anchors (covered cells don't need update; they display anchor's value)
   - [ ] Formula bar shows anchor's value when merged cell selected

3. **Editing**
   - [ ] Editing a merged cell updates the anchor
   - [ ] startEditing(row, col) receives anchor coords when (row,col) is covered
   - [ ] SetCellValue, GetCellRawValue work with anchor refs

4. **No regressions**
   - [ ] Unmerged cells behave as before
   - [ ] No console errors when interacting with merged cells

---

## Technical Requirements

### Functions to Update

- `loadCells()` - line ~765
- `refreshAllCells()` - line ~693
- `selectCell()` - line ~441
- Click handlers in buildSpreadsheet - ensure they pass correct (row,col) for merged areas
- Any `getElementById('cell-${row}-${col}')` → `getCellElement(row, col)`

---

## Dev Notes

### References

- [Source: frontend/app.js]
- [Source: research/technical-cell-merging-research-2026-02-23.md]
