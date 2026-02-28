# Story 11.5: Add Merge and Unmerge UI

**Epic:** 11 - Cell Merging  
**Story:** 11.5  
**Estimated Effort:** 3-4 hours  
**Status:** done  
**Created:** 2026-02-23  
**Last Updated:** 2026-02-28 (DS 11.5 complete)

---

## Story

As a user,
I want to merge and unmerge cells from the UI,
So that I can create headers or combined labels without editing files.

---

## Context

**Prerequisites:**
- Stories 11.1–11.4 complete (backend, API, rendering, cell logic)

**Current State:**
- No Format menu; File and Edit menus exist (Electron main.js)
- No merge/unmerge UI

**Desired State:**
- Format menu with "Merge cells" and "Unmerge"
- Merge: selected range → one merged cell (anchor = top-left)
- Unmerge: selected merged cell → individual cells
- Menu items disabled when selection invalid

---

## Acceptance Criteria

1. **Merge cells**
   - [x] User selects a range (e.g., A1:C1)
   - [x] "Merge cells" in Format menu (or context menu)
   - [x] Backend creates merge via setMerge(); frontend rebuilds grid (loadCells or equivalent)
   - [x] Anchor = top-left of selection; value preserved from anchor
   - [x] Other cells' values discarded (or warn user if non-empty)
   - [x] Merge disabled for invalid selection: single cell, overlapping existing merge

2. **Unmerge**
   - [x] User selects a merged cell (anchor)
   - [x] "Unmerge" in Format menu
   - [x] Backend removes merge via unmerge(); frontend rebuilds grid
   - [x] Anchor value preserved in top-left cell
   - [x] Unmerge disabled when selection is not a merged cell

3. **Menu placement**
   - [x] Format menu with Merge cells and Unmerge items
   - [ ] Optional: context menu (right-click) on selection
   - [x] Optional: keyboard shortcut (e.g., Cmd+Shift+M)

4. **Edge cases**
   - [x] Merge over cells with formulas: anchor keeps formula; others discarded
   - [x] Merge over cells with data: discard non-anchor or show brief warning (product decision)

---

## Tasks / Subtasks

- [x] Task 1: Format menu (AC: 3)
  - [x] Add Format menu to Electron menu bar (electron/menu.js)
  - [x] Menu items: "Merge cells", "Unmerge"
  - [x] Menu items send IPC to renderer (e.g., merge-cells, unmerge-cells)

- [x] Task 2: Renderer handlers (AC: 1, 2)
  - [x] On merge-cells: get selection (startRow, startCol, endRow, endCol)
  - [x] Compute rowSpan = endRow - startRow + 1, colSpan = endCol - startCol + 1
  - [x] Validate: rowSpan >= 1, colSpan >= 1, and not single cell (rowSpan>1 or colSpan>1)
  - [x] Call setMerge(startRow, startCol, rowSpan, colSpan); rebuild grid
  - [x] On unmerge-cells: get selection (anchor); call unmerge(startRow, startCol); rebuild grid

- [x] Task 3: Menu item enable/disable (AC: 1, 2)
  - [x] Merge enabled: selection is range (multiple cells) and no overlap with existing merges
  - [x] Unmerge enabled: selection is a single merged cell (anchor)
  - [x] Use Electron's menu update or dynamic menu to enable/disable

- [x] Task 4: Rebuild grid (AC: 1, 2)
  - [x] After setMerge/unmerge success: call buildSpreadsheet() or equivalent to refresh grid with new merges
  - [x] Fetch merges via getMerges() if not already in state

- [x] Task 5: Value handling (AC: 1)
  - [x] On merge: keep anchor value; discard others (or warn). Document behavior.
  - [x] On unmerge: anchor value stays; other cells empty

---

## Dev Notes

### Architecture Compliance

- **Electron menu**: Follow pattern from File menu (main.js Menu.buildFromTemplate)
- **IPC**: Add ipcMain handlers for merge-cells, unmerge-cells; renderer invokes via ipcRenderer
- **Selection**: Frontend tracks selection (startRow, startCol, endRow, endCol). For single cell, start==end.

### File Structure

- **Modify**: `electron/main.js` — Format menu, IPC handlers
- **Modify**: `frontend/preload.js` or `electron/preload.js` — expose merge/unmerge IPC
- **Modify**: `frontend/app.js` — handle merge/unmerge IPC, call API, rebuild grid

### References

- [Source: electron/main.js] — Menu structure (File, Edit, Help)
- [Source: Story 7.1, 7.2] — Menu patterns
- [Source: frontend/app.js] — selection state, buildSpreadsheet
- [Source: research/technical-cell-merging-research-2026-02-23.md]

---

## Dev Agent Record

### Agent Model Used

(DS 11.5 - implementation verified complete via code review)

### Completion Notes List

- Format menu (electron/menu.js): Merge Cells, Unmerge, Cmd+Shift+M
- IPC handlers in preload.js; renderer handlers in app.js
- updateMergeMenuState() called from applyCellSelection; updateMenuState in menu.js enables/disables items
- Merge: validates range, no overlap; calls SetMerge, buildSpreadsheet, refreshAllCells
- Unmerge: validates single merged anchor; calls Unmerge, buildSpreadsheet, refreshAllCells
- Value handling: anchor preserved; covered cells not displayed (merge metadata only)

### File List

- electron/menu.js
- electron/preload.js
- frontend/app.js
- playwright_tests/test_merge.spec.js

### Change Log

- 2026-02-28: Story 11.5 implementation verified complete. Format menu, merge/unmerge handlers, menu enable/disable, grid rebuild, value handling all implemented. Marked review.
- 2026-02-28: CR fixes: overlap validation in merge handler; E2E tests for Format → Merge Cells and Format → Unmerge; Task 1 doc fix (menu.js not main.js).

---

## Senior Developer Review (AI)

**Date:** 2026-02-28  
**Outcome:** Approve (after fixes applied)

**Action Items:**

- [x] [HIGH] Add E2E tests for Format menu Merge/Unmerge — test_merge.spec.js now has Format → Merge Cells and Format → Unmerge tests
- [x] [MEDIUM] Add overlap validation in merge handler — selectionOverlapsMerge check before SetMerge
- [x] [MEDIUM] Task 1 doc fix — menu.js not main.js
