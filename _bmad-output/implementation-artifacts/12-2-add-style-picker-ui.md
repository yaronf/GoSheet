# Story 12.2: Add Style Picker UI

**Epic:** 12 - Named Styles (Title, Header, Total)  
**Story:** 12.2  
**Estimated Effort:** 4–6 hours  
**Status:** done  
**Created:** 2026-02-28  
**Last Updated:** 2026-02-28

---

## Story

As a user,
I want a style picker (dropdown or toolbar) to apply Title, Header, or Total to my selection,
So that I can format cells without using the API directly.

---

## Context

**Prerequisites:** Story 12.1 complete (style registry and API exist)

**Current State:**
- Backend has ApplyStyleToCell, ApplyStyleToRange, GetAllCells with styleId
- No UI to apply styles
- Grid does not render styled cells

**Desired State:**
- Format menu: Title, Header, Total options
- Choosing an option applies style to selected range
- Grid renders styled cells (font, fill, border, alignment)
- Playwright tests cover style picker interaction

---

## Acceptance Criteria

1. **Style picker**
   - [x] Format menu (or toolbar) shows Title, Header, Total options
   - [x] Choosing an option applies that style to the selected range

2. **Grid rendering**
   - [x] Styled cells display with correct font, fill, border, alignment

3. **Tests**
   - [x] Playwright tests cover style picker interaction

---

## Tasks / Subtasks

- [x] Task 1: API client (ApplyRangeStyle)
- [x] Task 2: Format menu items (Title, Header, Total)
- [x] Task 3: Grid rendering (CSS classes for styles)
- [x] Task 4: Playwright tests

---

## Dev Agent Record

### File List

- `frontend/api-client.js` – ApplyRangeStyle
- `electron/menu.js` – Format submenu: Title, Header, Total
- `electron/preload.js` – onMenuStyleTitle, onMenuStyleHeader, onMenuStyleTotal
- `frontend/app.js` – applyStyleToSelection, applyCellValue/loadCells/refreshAllCells with styleId, STYLE_CLASSES
- `frontend/spreadsheet.css` – .style-title, .style-header, .style-total (theme-aware)
- `playwright_tests/test_merge.spec.js` – Format → Title, Header, Total tests

### Change Log

| Date       | Event  | Notes |
|------------|--------|-------|
| 2026-02-28 | Implemented | Style picker UI, API client, grid rendering, tests |
| 2026-02-27 | CR 12.2 | Fixed dark mode CSS (use var), added Format→Total test, updated File List |
| 2026-02-27 | CR 12.2 (LOW) | Added STYLE_ID constants, keyboard shortcuts (Cmd+Shift+1/2/3) |

### Senior Developer Review (AI)

- **2026-02-27:** CR completed. Fixed: (1) Style cells now use CSS variables for dark mode; (2) Added Format → Total Playwright test. Story marked done.

---

## Dev Notes

- Follow merge menu pattern (Format menu, electron IPC)
- Style IDs: 1=Title, 2=Header, 3=Total
- CSS: .style-title, .style-header, .style-total
