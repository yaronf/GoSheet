# Story 11.4: Update Cell Logic for Merge-Aware Behavior

**Epic:** 11 - Cell Merging  
**Story:** 11.4  
**Estimated Effort:** 4-5 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-23  
**Last Updated:** 2026-02-25 (CS for Epic 11)

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
- `loadCells()`, `refreshAllCells()` use `getElementById('cell-${row}-${col}')` — fails for covered cells (no such element)
- `selectCell(row, col)` assumes every (row,col) has a DOM element
- Click handlers pass (row,col) from td; covered cells have no td — need to handle clicks on anchor's spanned area

**Desired State:**
- All cell logic uses getCellElement(row, col)
- Covered (row,col) maps to anchor for selection and display
- Formula bar shows anchor value when merged cell selected

---

## Acceptance Criteria

1. **selectCell(row, col)**
   - [ ] When (row,col) is covered, resolve to anchor (startRow, startCol) and select anchor
   - [ ] Click on merged cell area (anchor or covered) selects anchor
   - [ ] No errors when clicking covered region

2. **loadCells() / refreshAllCells()**
   - [ ] Use getCellElement(row, col) instead of getElementById('cell-${row}-${col}')
   - [ ] Only update anchors (covered cells display via anchor's td; no separate update needed)
   - [ ] Formula bar shows anchor's value when merged cell selected

3. **Editing**
   - [ ] Editing a merged cell updates the anchor
   - [ ] startEditing(row, col) receives anchor coords when (row,col) is covered
   - [ ] SetCellValue, GetCellRawValue use anchor refs

4. **No regressions**
   - [ ] Unmerged cells behave as before
   - [ ] No console errors when interacting with merged cells

---

## Tasks / Subtasks

- [ ] Task 1: Resolve (row,col) to anchor (AC: 1, 3)
  - [ ] Add resolveToAnchor(row, col) → {row, col} using merge data
  - [ ] selectCell: before using (row,col), resolve to anchor if covered
  - [ ] startEditing: pass resolved (anchor) coords

- [ ] Task 2: Update loadCells and refreshAllCells (AC: 2)
  - [ ] Replace getElementById('cell-${row}-${col}') with getCellElement(row, col)
  - [ ] Iterate over cells to update; for merged regions, only update anchor (covered cells share anchor's td)
  - [ ] Ensure formula bar receives anchor coords when merged cell selected

- [ ] Task 3: Click handlers (AC: 1)
  - [ ] buildSpreadsheet: td click handlers — need to pass (row,col) for the cell. For anchor td with rowSpan/colSpan, clicks anywhere on td should use anchor (row,col). Verify existing logic or fix.
  - [ ] For covered cells: they have no td; user clicks on anchor's td. The anchor's td spans the area. Click handler gets anchor (row,col). So we need to map click position to (row,col). Option: store data attributes on td with row,col; for merged anchor, all clicks report anchor. Already correct if td.id = cell-{row}-{col} and we use that.

- [ ] Task 4: Formula bar and editing (AC: 2, 3)
  - [ ] When selection changes, formula bar shows selected cell's value. If selection is anchor (or resolved to anchor), formula bar shows anchor. Verify.
  - [ ] startEditing(anchorRow, anchorCol) when user edits merged cell
  - [ ] setCellValue called with anchor coords

- [ ] Task 5: Regression testing (AC: 4)
  - [ ] Run Playwright tests
  - [ ] Manual test: merge cells, click, edit, verify no errors

---

## Dev Notes

### Key Functions to Update

- `loadCells()` — ~line 765 in app.js
- `refreshAllCells()` — ~line 693
- `selectCell(row, col)` — ~line 441; add resolveToAnchor at start
- Click handlers in buildSpreadsheet — ensure (row,col) passed is correct (anchor for merged)
- Any `getElementById('cell-${row}-${col}')` → `getCellElement(row, col)`

### resolveToAnchor Logic

- If merges empty or (row,col) not in any merge: return (row, col)
- If (row,col) in merge M: return (M.startRow, M.startCol)

### References

- [Source: frontend/app.js] — loadCells, refreshAllCells, selectCell, buildSpreadsheet
- [Source: research/technical-cell-merging-research-2026-02-23.md]
- [Source: Story 11.3] — getCellElement

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

### File List
