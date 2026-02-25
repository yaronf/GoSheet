# Story 11.5: Add Merge and Unmerge UI

**Epic:** 11 - Cell Merging  
**Story:** 11.5  
**Estimated Effort:** 3-4 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-23  
**Last Updated:** 2026-02-25 (CS for Epic 11)

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
   - [ ] User selects a range (e.g., A1:C1)
   - [ ] "Merge cells" in Format menu (or context menu)
   - [ ] Backend creates merge via setMerge(); frontend rebuilds grid (loadCells or equivalent)
   - [ ] Anchor = top-left of selection; value preserved from anchor
   - [ ] Other cells' values discarded (or warn user if non-empty)
   - [ ] Merge disabled for invalid selection: single cell, overlapping existing merge

2. **Unmerge**
   - [ ] User selects a merged cell (anchor)
   - [ ] "Unmerge" in Format menu
   - [ ] Backend removes merge via unmerge(); frontend rebuilds grid
   - [ ] Anchor value preserved in top-left cell
   - [ ] Unmerge disabled when selection is not a merged cell

3. **Menu placement**
   - [ ] Format menu with Merge cells and Unmerge items
   - [ ] Optional: context menu (right-click) on selection
   - [ ] Optional: keyboard shortcut (e.g., Cmd+Shift+M)

4. **Edge cases**
   - [ ] Merge over cells with formulas: anchor keeps formula; others discarded
   - [ ] Merge over cells with data: discard non-anchor or show brief warning (product decision)

---

## Tasks / Subtasks

- [ ] Task 1: Format menu (AC: 3)
  - [ ] Add Format menu to Electron menu bar (electron/main.js)
  - [ ] Menu items: "Merge cells", "Unmerge"
  - [ ] Menu items send IPC to renderer (e.g., merge-cells, unmerge-cells)

- [ ] Task 2: Renderer handlers (AC: 1, 2)
  - [ ] On merge-cells: get selection (startRow, startCol, endRow, endCol)
  - [ ] Compute rowSpan = endRow - startRow + 1, colSpan = endCol - startCol + 1
  - [ ] Validate: rowSpan >= 1, colSpan >= 1, and not single cell (rowSpan>1 or colSpan>1)
  - [ ] Call setMerge(startRow, startCol, rowSpan, colSpan); rebuild grid
  - [ ] On unmerge-cells: get selection (anchor); call unmerge(startRow, startCol); rebuild grid

- [ ] Task 3: Menu item enable/disable (AC: 1, 2)
  - [ ] Merge enabled: selection is range (multiple cells) and no overlap with existing merges
  - [ ] Unmerge enabled: selection is a single merged cell (anchor)
  - [ ] Use Electron's menu update or dynamic menu to enable/disable

- [ ] Task 4: Rebuild grid (AC: 1, 2)
  - [ ] After setMerge/unmerge success: call buildSpreadsheet() or equivalent to refresh grid with new merges
  - [ ] Fetch merges via getMerges() if not already in state

- [ ] Task 5: Value handling (AC: 1)
  - [ ] On merge: keep anchor value; discard others (or warn). Document behavior.
  - [ ] On unmerge: anchor value stays; other cells empty

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

(To be filled by dev agent)

### Completion Notes List

### File List
