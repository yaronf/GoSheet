# Story 13.4: UI Layout Compact (Fold Top Rows)

**Epic:** 13 - Spreadsheet UX & Polish  
**Story:** 13.4  
**Estimated Effort:** 2–3 hours  
**Status:** done  
**Depends on:** 13.1, 13.2, 13.3 (done)  
**Source:** epics.md

---

## Story

As a user,
I want the top toolbar compacted into one row,
So that more vertical space is available for the grid.

## Acceptance Criteria

1. **Given** the current layout has two rows (icons, file status, cell ref, formula bar)
2. **When** the layout is updated
3. **Then** these elements fold into a single compact row
4. **And** all functionality remains accessible
5. **And** the grid gains vertical space

## Tasks / Subtasks

- [ ] Task 1: Merge toolbar and formula bar into one row (AC: 1–3)
  - [ ] Combine `header.toolbar` and `.formula-bar-container` into a single flex row
  - [ ] Preserve order: [New] [Save] [Load] | [cell-ref] [formula-bar] | [file-status]
  - [ ] Ensure formula bar retains flex-grow and min-width for usability
- [ ] Task 2: Adjust CSS for compact layout (AC: 3–5)
  - [ ] Reduce padding/gaps to achieve compact height
  - [ ] Update `.spreadsheet-container` height calc (currently `100vh - 100px`) to reflect reduced header height
  - [ ] Verify toolbar buttons, cell-ref, formula bar, file-status all remain visible and usable
- [ ] Task 3: Verify no regressions (AC: 4–5)
  - [ ] Run Playwright tests (formula bar, toolbar, accessibility, file operations)
  - [ ] Manual check: all buttons work, formula bar editable, file status updates, grid scrolls correctly

## Dev Notes

### Current Layout (frontend/app.js)

- **Row 1:** `<header class="toolbar">` — New, Save, Load buttons + `#file-status` (margin-left: auto)
- **Row 2:** `<div class="formula-bar-container">` — `#cell-ref` (80px) + `#formula-bar` (flex: 1, min-width: 500px)

### Files to Modify

- `frontend/app.js` — HTML structure: merge toolbar and formula-bar-container into one wrapper
- `frontend/spreadsheet.css` — Layout CSS: single-row flex, compact padding, update spreadsheet-container height

### Key CSS (spreadsheet.css)

- `.toolbar` (line ~467): padding, gap, border-bottom
- `.formula-bar-container` (line ~524): separate row; merge into toolbar or create unified `.toolbar-row`
- `.spreadsheet-container` (line ~574): `height: calc(100vh - 100px)` — reduce 100px when header shrinks (e.g. to ~60px for one row)
- `.file-status`: `margin-left: auto` keeps it right-aligned; preserve in merged layout

### Implementation Approach

1. **Option A:** Single `<header>` containing all elements in one flex row. Use `flex-wrap: nowrap` and ensure formula bar has `flex: 1 1 auto` and `min-width`.
2. **Option B:** Keep semantic separation with wrapper — e.g. `<header class="toolbar-compact">` wrapping both toolbar buttons and formula bar area.
3. **Compact height:** Target ~48–56px total for the row (vs. current ~100px for two rows). Use `--spacing-sm` (8px) or `--spacing-xs` (4px) for vertical padding.
4. **Toolbar buttons:** Currently 40×40px; consider 32×32px or keep if space allows. Icons 24×24; could reduce to 20×20 for compact.

### UX Reference

- [Source: ux-design-specification.md] — "Dense Grid, Comfortable UI"; formula bar uses monospace; file status pinned to right
- [Source: epics.md] — "more vertical space available for the grid"

### Testing

- `playwright_tests/test_spreadsheet.spec.js` — formula bar, cell editing
- `playwright_tests/test_accessibility.spec.js` — toolbar, formula bar container roles
- `playwright_tests/test_file_operations.spec.js` — file status visibility
- `playwright_tests/test_keyboard_shortcuts.spec.js` — formula bar focus

### Previous Story Intelligence (13.3b)

- Manage Styles modal: Pico.css overrides scoped to `#manage-styles-modal`; avoid global resets
- Form layout: flexbox with `align-items: center`, consistent gap; compact = reduce padding, not functionality
- Playwright: use `element-based waits` (e.g. `waitForSelector`) over fixed `waitForTimeout` where possible

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.4] — Epic 13, Story 13.4
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] — Layout, spacing, formula bar
- [Source: frontend/spreadsheet.css] — Current toolbar, formula-bar-container, spreadsheet-container

## Dev Agent Record

### Agent Model Used

(UX designer approach)

### Completion Notes List

- Merged toolbar and formula bar into single compact row
- Order: [New][Save][Load] | [cell-ref][formula-bar] | [file-status]
- Compact sizing: 32×32 buttons, 28px formula bar, 44px row height
- Grid height: `calc(100vh - 48px)` (was 100px, gains ~52px vertical space)
- Preserved accessibility: roles, aria-labels, formula-bar-container

### File List

- frontend/app.js (HTML structure)
- frontend/spreadsheet.css (toolbar-compact, formula bar, spreadsheet-container)
