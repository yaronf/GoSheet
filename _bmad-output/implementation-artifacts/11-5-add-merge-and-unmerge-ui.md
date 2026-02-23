# Story 11.5: Add Merge and Unmerge UI

**Epic:** 11 - Cell Merging  
**Story:** 11.5  
**Estimated Effort:** 3-4 hours  
**Status:** backlog  
**Created:** 2026-02-23

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
- No Format menu or merge UI

**Desired State:**
- Format menu (or context menu) with Merge cells and Unmerge
- Merge: selected range → one merged cell
- Unmerge: selected merged cell → individual cells

---

## Acceptance Criteria

1. **Merge cells**
   - [ ] User selects a range (e.g., A1:C1)
   - [ ] "Merge cells" in Format menu or context menu
   - [ ] Backend creates merge region; frontend rebuilds grid
   - [ ] Anchor = top-left of selection; value preserved from anchor
   - [ ] Other cells' values discarded (or user warned if non-empty)
   - [ ] Merge disabled for invalid selection (single cell, overlapping existing merge)

2. **Unmerge**
   - [ ] User selects a merged cell
   - [ ] "Unmerge" in Format menu or context menu
   - [ ] Backend removes merge; frontend rebuilds grid
   - [ ] Anchor value preserved in top-left cell
   - [ ] Unmerge disabled when selection is not a merged cell

3. **Menu placement**
   - [ ] Format menu exists (or Edit/View) with Merge and Unmerge items
   - [ ] Optional: context menu (right-click) on selection
   - [ ] Keyboard shortcuts optional (e.g., Cmd+Shift+M for merge)

4. **Edge cases**
   - [ ] Merge over cells with formulas: document behavior (anchor keeps formula?)
   - [ ] Merge over cells with data: warn or discard non-anchor data

---

## Technical Requirements

### Menu Structure

- Add Format menu to Electron menu bar (if not exists)
- Items: Merge cells, Unmerge
- Call API: POST /api/merge, POST /api/unmerge
- Rebuild grid after success

### References

- [Source: electron/main.js] - Menu structure
- [Source: Story 7.1, 7.2] - File menu, Edit menu patterns
