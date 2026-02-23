# Story 11.3: Implement Merge-Aware Grid Rendering

**Epic:** 11 - Cell Merging  
**Story:** 11.3  
**Estimated Effort:** 6-8 hours  
**Status:** backlog  
**Created:** 2026-02-23

---

## Story

As a user,
I want merged cells to render with colspan/rowspan,
So that I see a single combined cell instead of multiple separate cells.

---

## Context

**Prerequisites:**
- Story 11.1, 11.2 complete (backend + API)

**Current State:**
- `buildSpreadsheet()` creates one td per (row,col); no colspan/rowspan

**Desired State:**
- Merge-aware rendering; anchor cells span; covered cells not in DOM

---

## Acceptance Criteria

1. **buildSpreadsheet()**
   - [ ] Fetches merge regions from API (or receives as param)
   - [ ] Anchor cells use `td.colSpan` and `td.rowSpan`
   - [ ] Covered cells are not rendered (no td for them)
   - [ ] Row rendering handles rowspan: rows below a rowspan have fewer td elements

2. **getCellElement(row, col)**
   - [ ] Helper returns the DOM element for (row,col)
   - [ ] When (row,col) is covered, returns the anchor's td
   - [ ] When (row,col) is anchor or unmerged, returns that td

3. **Visual correctness**
   - [ ] Horizontal merge (e.g., A1:C1) displays as one wide cell
   - [ ] Vertical merge (e.g., A1:A3) displays as one tall cell
   - [ ] 2D merge (e.g., A1:B2) displays as one combined cell
   - [ ] Cell styling (borders, selection) applies correctly to merged cells

4. **Grid expansion**
   - [ ] ROWS/COLS expansion logic accounts for merge regions (if applicable)

---

## Technical Requirements

### Rendering Algorithm

- Build a "cell occupancy" map: for each (row,col), is it anchor, covered, or unmerged?
- For each row, iterate columns; skip columns that are covered by a rowspan from above
- Emit td with colspan/rowspan for anchors; single td for unmerged; nothing for covered

### References

- [Source: frontend/app.js] - buildSpreadsheet, lines 374-426
- [Source: research/technical-cell-merging-research-2026-02-23.md] - Pseudocode
