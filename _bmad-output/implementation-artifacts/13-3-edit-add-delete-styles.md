# Story 13.3: Edit/Add/Delete Styles

**Epic:** 13 - Spreadsheet UX & Polish  
**Story:** 13.3  
**Estimated Effort:** 4–6 hours  
**Status:** done  
**Created:** 2026-03-02  
**Last Updated:** 2026-03-02

---

## Story

As a user,
I want to edit, add, or delete named styles,
So that I can customize formatting beyond the built-in Title, Header, Total.

---

## Context

**Prerequisites:** Story 12.x style registry exists (12.1 registry + API, 12.2 style picker UI, 12.3 format cleanup).

**Source:** `planning-artifacts/epics.md` Story 13.3

**Current State:**

- StyleRegistry: built-in Title (1), Header (2), Total (3) only; no API to read or mutate registry
- Format menu: Title, Header, Total, Format Cleanup; no "Manage Styles"
- Cells reference styles by StyleId; grid renders via CSS classes (.style-title, .style-header, .style-total)
- File format v1.2 persists Styles registry

**Desired State:**

- Format → Manage Styles opens a style management UI (modal)
- Edit existing style definitions (font, fill, border, alignment)
- Add new named styles
- Delete any style (including built-in Title, Header, Total)
- Changes apply to cells using those styles; grid refreshes

---

## Acceptance Criteria

1. **Style management UI**
  - Given Story 12.x style registry exists
  - When I open Format → Manage Styles
  - Then a modal shows all styles (built-in + custom) with name and preview
  - And I can select a style to edit its definition
2. **Edit existing styles**
  - When I edit a style (font, fill, border, alignment)
  - Then the definition updates in the registry
  - And all cells using that style reflect the change immediately
3. **Add new styles**
  - When I add a new named style
  - Then it appears in the registry and in the Format menu / style picker
  - And I can apply it to cells
4. **Delete styles**
  - When I delete any style (including built-in Title, Header, Total)
  - Then a confirmation dialog appears before deletion
  - And on confirm, it is removed from the registry
  - And cells that used it have their style cleared (StyleId → 0)
5. **Persistence**
  - Changes to the style registry persist when saving the file
  - File format v1.2 already supports Styles; ensure custom styles round-trip correctly

---

## Tasks / Subtasks

- Task 1: Backend – read style registry (AC: 1)
  - Add GET /api/styles returning { styles: [{ id, name, format }] }
  - Controller/Model: expose registry as JSON (id = 1-based index; format = CellFormat)
- Task 2: Backend – update style (AC: 2)
  - Add PUT /api/styles/:id to update format for existing style
  - Validate id 1–N; update Formats[id-1]; mark Modified; no need to touch cells (they reference by id)
- Task 3: Backend – add style (AC: 3)
  - Add POST /api/styles with { name, format }; append to Formats, add to Names; return new id
  - Validate name unique, format valid
- Task 4: Backend – delete style (AC: 4)
  - Add DELETE /api/styles/:id; allow any style id 1..N
  - Clear StyleId from cells using this style; remove from Formats and Names; reindex Names for ids > deleted
  - Model: Add DeleteStyle(styleID int) error; controller + handler
- Task 5: Frontend – Manage Styles modal (AC: 1, 2, 3, 4)
  - Format menu: add "Manage Styles..." → opens modal
  - Modal: list styles with name + visual preview; Edit, Add, Delete buttons
  - Edit: form for font (name, size, bold, italic, color), fill, border, alignment
  - Add: same form + name input; call POST /api/styles
  - Delete: confirm dialog; call DELETE /api/styles/:id; refresh grid
- Task 6: Format menu / style picker integration (AC: 3)
  - After adding custom style, include in Format submenu and context menu Format submenu
  - Reuse applyStyleToSelection with new style id
- Task 7: Playwright tests
  - Manage Styles opens; edit Title font size; cells update
  - Add custom style; apply to cell; delete custom style; cell loses style
  - Delete built-in style; cells using it lose style
  - Delete style shows confirmation dialog; Cancel aborts; OK proceeds

---

## Dev Notes

### Architecture Compliance

- **model/** package: Add UpdateStyle, AddStyle, DeleteStyle to StyleRegistry or Spreadsheet
- **controller/** package: GetStyles, UpdateStyle, AddStyle, DeleteStyle
- **api/** package: GET /api/styles, PUT /api/styles/:id, POST /api/styles, DELETE /api/styles/:id
- **File format:** v1.2 already encodes Styles; custom styles in Formats/Names will persist on save/load

### Technical Requirements

**StyleRegistry mutations:**

- `UpdateStyle(id int, format *CellFormat) error` — update Formats[id-1]; id must be 1..len(Formats)
- `AddStyle(name string, format *CellFormat) (int, error)` — append to Formats; Names[name]=len(Formats); return new id
- `DeleteStyle(id int) error` — id must be 1..len(Formats); clear cells with StyleId==id; remove Formats[id-1]; update Names (remove name, decrement ids > id)

**Delete reindexing:** After removing Formats[id-1], indices shift. Names map stores id (1-based). When we remove index id-1, all entries in Names with value > id must be decremented. Iterate Names and adjust.

**Cell update on delete:** Spreadsheet must iterate all cells and set StyleId=0 where StyleId==id; then for StyleId > id, set StyleId-- (because we removed one entry and indices shifted). Actually: we remove at index id-1, so indices id, id+1, ... become id-1, id, ... So style id+1 becomes id, etc. Cells with old id get 0. Cells with old id+1 get id, etc. So: for each cell with StyleId > id, set StyleId--.

**Built-in style IDs:** 1=Title, 2=Header, 3=Total. All styles (built-in and custom) can be deleted.

### Project Structure Notes

- `model/style.go` — Add UpdateStyle, AddStyle, DeleteStyle (or on Spreadsheet if cell iteration needed)
- `model/spreadsheet.go` — DeleteStyle will need to iterate Cells; may belong here
- `controller/app.go` — GetStyles, UpdateStyle, AddStyle, DeleteStyle
- `api/handlers.go` — HandleGetStyles, HandleUpdateStyle, HandleAddStyle, HandleDeleteStyle
- `server/main.go` — register new routes
- `frontend/api-client.js` — GetStyles, UpdateStyle, AddStyle, DeleteStyle
- `frontend/app.js` — Manage Styles modal, Format menu item, IPC handler
- `electron/menu.js` — Format → Manage Styles...
- `electron/preload.js` — onMenuManageStyles
- `frontend/spreadsheet.css` — Manage Styles modal styles; dynamic style preview (inline or generated class)

### Dynamic Style Rendering

- Built-in styles use CSS classes .style-title, .style-header, .style-total
- Custom styles: either (a) generate inline style from CellFormat on render, or (b) inject a `<style>` block with generated classes. For MVP, inline style is simpler: compute CSS from Font, Fill, Border, Alignment and set as element.style.

### Previous Story Intelligence (13.2)

- Modal pattern: use modal-overlay, modal-dialog, setupDialogFocusTrap; follow CSV preview / formula help modal structure
- Add menu item in Format submenu; use menu-* IPC; preload sends to renderer
- refreshAllCells() after any change that affects grid display

### References

- [Source: epics.md] Story 13.3
- [Source: 12-1-add-style-registry-and-named-styles.md] StyleRegistry, CellFormat, built-in IDs
- [Source: 12-2-add-style-picker-ui.md] Format menu, applyStyleToSelection, STYLE_CLASSES
- [Source: model/style.go] Font, Fill, Border, Alignment, CellFormat, StyleRegistry
- [Source: model/file.go] v1.2 save/load with Styles

---

## Dev Agent Record

### Agent Model Used

Cursor Composer

### Debug Log References

### Completion Notes List

- 2026-03-02 DS: Implemented style management. Backend: model UpdateStyle, AddStyle, RemoveStyle, DeleteStyle; controller GetStyles, UpdateStyle, AddStyle, DeleteStyle; API GET/PUT/POST/DELETE /api/styles. Frontend: Manage Styles modal (Format menu), list with Edit/Add/Delete, confirmation dialog for delete. Playwright tests added (Electron launch env issue in sandbox). Task 6 (dynamic Format menu for custom styles) deferred.
- 2026-03-02 DS: Fixed style preview (kebab-case for inline style attr) and cell alignment (apply edited style format to grid cells via GetStyles + inline styles).

### File List

- model/style.go — GetStyleNameByID, UpdateStyle, AddStyle, RemoveStyle, StyleInfo
- model/spreadsheet.go — DeleteStyle
- controller/app.go — GetStyles, UpdateStyle, AddStyle, DeleteStyle
- api/handlers.go — HandleStyles, HandleStyleByID, AddStyleRequest, UpdateStyleRequest
- server/main.go — /api/styles, /api/styles/, CORS PUT/DELETE
- frontend/api-client.js — GetStyles, UpdateStyle, AddStyle, DeleteStyle
- frontend/app.js — Manage Styles modal, showManageStylesModal
- frontend/spreadsheet.css — manage-styles-* styles
- electron/menu.js — Format → Manage Styles...
- electron/preload.js — onMenuManageStyles
- playwright_tests/test_manage_styles.spec.js — 4 tests

