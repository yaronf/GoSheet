# Story 13.2: Context Menu (Right-Click)

**Epic:** 13 - Spreadsheet UX & Polish  
**Story:** 13.2  
**Estimated Effort:** 3–4 hours  
**Status:** ready-for-dev  
**Created:** 2026-03-02  
**Last Updated:** 2026-03-02

---

## Story

As a user,
I want a context menu when right-clicking a cell,
So that I can access common actions (copy, paste, format, etc.) quickly.

---

## Context

**Prerequisites:** Story 13.1 complete (row/column selection and insert). Edit menu (Copy, Paste) and Format menu (styles, merge) exist.

**Source:** `planning-artifacts/epics.md` Story 13.2

**Current State:**

- Edit menu: Cut, Copy, Paste, Select All
- Format menu: Merge, Unmerge, Title, Header, Total, Format Cleanup
- Insert menu: Insert Row Above, Insert Column Before (when row/column selected)
- No context menu on right-click; browser/Electron default may show or be suppressed

**Desired State:**

- Right-click on selection shows a context menu
- Menu includes: Copy, Paste, Format (styles submenu or shortcuts), Clear
- Choosing an action executes it on the current selection

---

## Acceptance Criteria

1. **Context menu appears**
  - Given I have selected one or more cells (or a row/column)
  - When I right-click on the selection
  - Then a context menu appears at the click position
  - And the default browser/Electron context menu is suppressed
2. **Menu actions**
  - Actions include at least: Copy, Paste, Format (styles), Clear
  - Copy: same behavior as Edit → Copy
  - Paste: same behavior as Edit → Paste
  - Format: submenu or quick access to Title, Header, Total (reuse Format menu logic)
  - Clear: clear cell values in selection (no merge/style change)
3. **Action execution**
  - Choosing an action executes it on the selection
  - Menu dismisses after selection
  - Selection remains unchanged unless the action changes it

---

## Tasks / Subtasks

- Task 1: Context menu trigger (AC: 1)
  - Add `contextmenu` listener on spreadsheet table (or container)
  - On right-click on cell/row-header/col-header: prevent default, determine selection
  - If click is on selection (or extends it), show menu; else select cell and show menu
- Task 2: Context menu UI (AC: 1, 2)
  - Implement context menu: positioned div or Electron native `Menu.popup()`
  - Items: Copy, Paste, separator, Format (submenu: Title, Header, Total), separator, Clear
  - Enable/disable items based on selection state (e.g. Paste enabled when clipboard has content; Copy when selection exists)
- Task 3: Action handlers (AC: 3)
  - Wire Copy, Paste to existing Edit menu handlers (or shared logic)
  - Wire Format submenu to existing Format style handlers
  - Implement Clear: clear values in selection range via API or existing clear logic
- Task 4: Playwright tests
  - Right-click on cell shows context menu
  - Context menu Copy then Paste works
  - Context menu Clear clears selection

---

## Dev Notes

- **Implementation options:**
  - **HTML/CSS menu:** Custom div positioned at `clientX/clientY`, styled to match app. Simpler, no main-process changes. Use `position: fixed` and `transform` for positioning.
  - **Electron native menu:** IPC to main; main builds `Menu.buildFromTemplate`, calls `menu.popup({ x, y })`. Returns choice via IPC. More native look/feel.
- **Selection on right-click:** If user right-clicks a cell outside current selection, either (a) select that cell first then show menu, or (b) show menu for that cell only. Common pattern: select the cell/range under the click, then show menu.
- **Clear action:** Need API or controller method to clear cell values in a range. Check if `ClearRange` or similar exists; if not, iterate selection and call SetCell(empty) or add `POST /api/range/clear`.
- **Format submenu:** Can be flat (Copy, Paste, Clear, Title, Header, Total) or nested. Flat is simpler for MVP. But should include all styles if we edit them.
- **Row/column selection:** When row or column is selected, context menu could show Insert Row/Column. Defer to keep scope small, or include if trivial.

### Project Structure Notes

- `frontend/app.js` — contextmenu listener, menu render/hide, action dispatch
- `frontend/spreadsheet.css` — context menu styles (if HTML menu)
- `api/handlers.go` — `HandleClearRange` if new endpoint needed
- `electron/main.js` or `preload.js` — only if using native Menu.popup via IPC

### References

- [Source: epics.md] Story 13.2
- [Source: 11-5-add-merge-and-unmerge-ui.md] Optional: context menu noted
- [Source: 7-2-implement-edit-menu] Copy, Paste handlers
- [Source: 12-2-add-style-picker-ui] Format style handlers

---

## Dev Agent Record

### Change Log

- 2026-03-02: Story created (ready-for-dev).

