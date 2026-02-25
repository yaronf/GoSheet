# Story 11.3: Implement Merge-Aware Grid Rendering

**Epic:** 11 - Cell Merging  
**Story:** 11.3  
**Estimated Effort:** 6-8 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-23  
**Last Updated:** 2026-02-25 (CS for Epic 11)

---

## Story

As a user,
I want merged cells to render with colspan/rowspan,
So that I see a single combined cell instead of multiple separate cells.

---

## Context

**Prerequisites:**
- Story 11.1, 11.2 complete (backend Merges, API getMerges)

**Current State:**
- `buildSpreadsheet()` in `frontend/app.js` creates one `<td>` per (row,col) in nested loops
- No colspan/rowspan; cell IDs are `cell-${row}-${col}`

**Desired State:**
- Merge-aware rendering: anchor cells use td.colSpan, td.rowSpan
- Covered cells not in DOM
- `getCellElement(row, col)` helper returns anchor's td when (row,col) is covered

---

## Acceptance Criteria

1. **buildSpreadsheet()**
   - [ ] Fetches merge regions (getMerges() from API or passed in)
   - [ ] Anchor cells use `td.colSpan` and `td.rowSpan`
   - [ ] Covered cells are not rendered (no td for them)
   - [ ] Row rendering handles rowspan: rows below a rowspan have fewer td elements (cells "consumed" from above)

2. **getCellElement(row, col)**
   - [ ] Returns DOM element for (row,col)
   - [ ] When (row,col) is covered, returns the anchor's td
   - [ ] When (row,col) is anchor or unmerged, returns that td

3. **Visual correctness**
   - [ ] Horizontal merge (A1:C1) displays as one wide cell
   - [ ] Vertical merge (A1:A3) displays as one tall cell
   - [ ] 2D merge (A1:B2) displays as one combined cell
   - [ ] Cell styling (borders, selection) applies correctly

4. **Grid expansion**
   - [ ] ROWS/COLS constants or expansion logic accounts for merge regions if needed

---

## Tasks / Subtasks

- [ ] Task 1: Build merge lookup (AC: 1)
  - [ ] Create helper: given (row,col) and merges[], return merge containing it or null
  - [ ] Create helper: given (row,col), is it anchor? Return {merge, isAnchor}
  - [ ] Create occupancy map or inline logic for "is (row,col) covered by a rowspan from above?"

- [ ] Task 2: Rewrite buildSpreadsheet row loop (AC: 1)
  - [ ] For each row, track col offset (skip cols covered by rowspan from above)
  - [ ] For each col: if covered by rowspan from above, skip (no td)
  - [ ] If anchor: create td with colSpan, rowSpan; advance col by colSpan
  - [ ] If unmerged: create td; advance col by 1
  - [ ] If covered (same row as anchor): no td; advance col by 1

- [ ] Task 3: getCellElement(row, col) (AC: 2)
  - [ ] If (row,col) is anchor or unmerged: return document.getElementById(`cell-${row}-${col}`)
  - [ ] If covered: find anchor, return document.getElementById(`cell-${anchorRow}-${anchorCol}`)
  - [ ] Handle case when element doesn't exist (return null)

- [ ] Task 4: Integration and verification (AC: 3, 4)
  - [ ] Call getMerges() before/during buildSpreadsheet (or receive merges from loadCells)
  - [ ] Verify horizontal, vertical, 2D merges render correctly
  - [ ] Run Playwright tests; fix any breakage

---

## Dev Notes

### Rendering Algorithm (from technical research)

```javascript
// Pseudocode for row rendering with rowspan
for (let row = 0; row < ROWS; row++) {
  const tr = document.createElement('tr');
  let col = 0;
  while (col < COLS) {
    const merge = getMergeAt(row, col);
    if (merge && merge.anchorRow === row && merge.anchorCol === col) {
      const td = document.createElement('td');
      td.colSpan = merge.colSpan;
      td.rowSpan = merge.rowSpan;
      td.id = `cell-${row}-${col}`;
      // ... attach, append
      col += merge.colSpan;
    } else if (merge) {
      // (row,col) is covered — no td in this row
      col++;
    } else {
      const td = document.createElement('td');
      td.id = `cell-${row}-${col}`;
      // ... attach, append
      col++;
    }
  }
  tbody.appendChild(tr);
}
```

**Rowspan gotcha:** When a cell has rowSpan=3, the next 2 rows have one fewer td in that column. Track "consumed" columns per row.

### File Structure

- **Modify**: `frontend/app.js` — buildSpreadsheet, add getCellElement
- **Dependencies**: getMerges() from api-client (add in 11.2)

### References

- [Source: frontend/app.js] — buildSpreadsheet (~lines 374-426)
- [Source: research/technical-cell-merging-research-2026-02-23.md] — Pseudocode, row rendering
- [Source: Story 11.2] — getMerges API

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

### File List
