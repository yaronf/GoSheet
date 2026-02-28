# Story 12.3: Style Optimization and Format Cleanup

**Epic:** 12 - Named Styles (Title, Header, Total)  
**Story:** 12.3  
**Estimated Effort:** 4–6 hours  
**Status:** done  
**Created:** 2026-03-01  
**Last Updated:** 2026-03-01

---

## Story

As a developer,
I want format cleanup for unused cells and optional theme support,
So that large workbooks remain performant and styling stays maintainable.

---

## Context

**Prerequisites:** Stories 12.1 and 12.2 complete (style registry, API, style picker UI)

**Current State:**
- Cells can have StyleId; formatting persists even when cell value is cleared
- GetAllCells returns cells with value OR style (so styled empty cells are included)
- No mechanism to remove orphaned formatting from empty cells
- Style CSS uses `var(--color-*)` (theme-aware); light/dark already works

**Desired State:**
- Format cleanup: identify and remove style from cells that are empty and have no value
- Formatting applied only to used ranges where practical
- (Optional) theme support for style color/font variants across the registry

---

## Acceptance Criteria

1. **Format cleanup**
   - [x] When a cell's value is cleared, we can optionally remove its style (or provide a cleanup API)
   - [x] Unnecessary formatted cells (empty + styled) can be identified and cleaned
   - [x] Cleanup does not affect cells with values or intentional empty-but-styled cells (if any)

2. **Used-range awareness**
   - [x] Formatting is applied only to used ranges where practical (e.g., GetAllCells / save does not expand to full grid for style-only cells beyond used range)

3. **Theme support (optional)**
   - [ ] (Optional) Theme support allows changing colors/fonts across styles (e.g., style theme presets) — deferred

---

## Tasks / Subtasks

- [x] Task 1: Format cleanup API or logic (AC: 1)
  - [x] Define behavior: separate cleanup endpoint POST /api/format/cleanup
  - [x] Implement cleanup: model.CleanupFormat, controller, API, Format menu
  - [x] Unit tests: TestCleanupFormat, TestHandleFormatCleanup
- [x] Task 2: Used-range optimization (AC: 2)
  - [x] Cleanup deletes empty cells (styled or not), reducing used range and file size
  - [x] GetAllCells/save only include remaining cells
- [x] Task 3: Theme support (optional, AC: 3)
  - [x] Deferred — style theme presets out of scope for this story

---

## Dev Notes

- Follow technical-named-styles-research: "Limit formatting to used ranges to avoid performance degradation"
- Excel "Check Performance" identifies and removes unnecessary formatted cells
- Current model: Cell has Value, Computed, StyleId; clearing value leaves StyleId
- Options: (a) clear StyleId when value cleared in SetCellValue, (b) separate cleanup API, (c) both
- Style IDs: 1=Title, 2=Header, 3=Total; CSS: .style-title, .style-header, .style-total
- Theme: App already has light/dark via data-theme; optional = style color presets

### References

- [Source: technical-named-styles-research-2026-02-23.md] Format accumulation and cleanup; used ranges; theme integration
- [Source: epics.md] Story 12.3 acceptance criteria

---

## Dev Agent Record

### Agent Model Used

Cursor Composer

### File List

- model/spreadsheet.go — CleanupFormat()
- model/spreadsheet_test.go — TestCleanupFormat
- controller/app.go — CleanupFormat()
- api/handlers.go — HandleFormatCleanup
- api/handlers_test.go — TestHandleFormatCleanup
- server/main.go — POST /api/format/cleanup
- frontend/api-client.js — CleanupFormat
- frontend/app.js — import, onMenuFormatCleanup handler
- electron/menu.js — Format Cleanup menu item
- electron/preload.js — onMenuFormatCleanup

### Change Log

- 2026-03-01 DS: Implemented format cleanup. Model: CleanupFormat clears StyleId from empty cells and deletes them. API: POST /api/format/cleanup. Format menu: Format Cleanup. Used-range: cleanup reduces cells; GetAllCells/save only include remaining. Theme presets deferred.
