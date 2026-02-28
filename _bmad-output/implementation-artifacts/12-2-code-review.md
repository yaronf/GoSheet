# Code Review: Story 12.2 – Add Style Picker UI

**Story:** 12-2-add-style-picker-ui  
**Reviewer:** AI (Adversarial Senior Developer)  
**Date:** 2026-02-27  
**Git vs Story Discrepancies:** 2 (no File List, story untracked)  
**Issues Found:** 2 High, 3 Medium, 2 Low

---

## Summary

Implementation delivers Format menu style options (Title, Header, Total), API client `ApplyRangeStyle`, grid rendering via CSS classes, and IPC wiring. Core flow works. Several issues require attention before marking done.

---

## CRITICAL ISSUES

*None.*

---

## HIGH ISSUES

### 1. Style cells break in dark mode

**File:** `frontend/spreadsheet.css` (lines 674–697)

**Problem:** `.style-title`, `.style-header`, `.style-total` use hardcoded hex colors (`#1a1a2e`, `#e0e0e0`, `#000000`, `#333333`) instead of CSS variables. The rest of the app uses `var(--color-text-primary)`, `var(--color-bg-*)`, etc., which switch in `[data-theme='dark']`. In dark mode, styled cells keep light-theme colors, so dark text on dark background becomes nearly invisible.

**Fix:** Use theme variables, e.g.:
- `.style-title`: `color: var(--color-text-primary);`
- `.style-header`: `background: var(--color-bg-header); color: var(--color-text-primary);`
- `.style-total`: `color: var(--color-text-primary);`
- Borders: `var(--color-text-primary)` or `var(--color-border)` as appropriate.

---

### 2. No Playwright test for Format → Total

**File:** `playwright_tests/test_merge.spec.js`

**Problem:** AC 3 requires “Playwright tests cover style picker interaction.” Tests exist for Format → Title and Format → Header (lines 140–185), but not for Format → Total. One of the three style options is untested.

**Fix:** Add a test for Format → Total, e.g. select a cell, apply Total via menu, assert `style-total` class.

---

## MEDIUM ISSUES

### 3. Story has no Dev Agent Record or File List

**File:** `_bmad-output/implementation-artifacts/12-2-add-style-picker-ui.md`

**Problem:** The story lacks a Dev Agent Record and File List. Git shows changes in `electron/menu.js`, `electron/preload.js`, `frontend/api-client.js`, `frontend/app.js`, `frontend/spreadsheet.css`, `playwright_tests/test_merge.spec.js`. Without a File List, it’s unclear what was changed for this story vs 12.1.

**Fix:** Add a Dev Agent Record section with a File List documenting the 12.2 changes.

---

### 4. Tasks and AC checkboxes not updated

**File:** `_bmad-output/implementation-artifacts/12-2-add-style-picker-ui.md`

**Problem:** All tasks and AC checkboxes remain unchecked, even though the implementation is largely complete. This makes status and traceability unclear.

**Fix:** Mark completed tasks and ACs as done and keep the story in sync with implementation.

---

### 5. CSS uses hardcoded colors instead of variables

**File:** `frontend/spreadsheet.css` (lines 674–697)

**Problem:** Same as issue #1. Style classes diverge from the rest of the stylesheet, which consistently uses `var(--color-*)`. This hurts maintainability and theme consistency.

**Fix:** Same as issue #1.

---

## LOW ISSUES

### 6. Magic numbers for style IDs — FIXED

**File:** `frontend/app.js`

**Fix applied:** Added `const STYLE_ID = { TITLE: 1, HEADER: 2, TOTAL: 3 };` and use in `applyCellValue` and menu handlers.

---

### 7. No keyboard shortcuts for style options — FIXED

**File:** `electron/menu.js`

**Fix applied:** Added accelerators: `CmdOrCtrl+Shift+1` (Title), `CmdOrCtrl+Shift+2` (Header), `CmdOrCtrl+Shift+3` (Total).

---

## Verification Summary

| AC | Status | Evidence |
|----|--------|----------|
| 1. Format menu shows Title, Header, Total | IMPLEMENTED | `electron/menu.js` lines 322–350 |
| 1. Choosing option applies style to selection | IMPLEMENTED | `app.js` applyStyleToSelection, ApplyRangeStyle |
| 2. Styled cells display correctly | PARTIAL | CSS present but dark mode broken (issue #1) |
| 3. Playwright tests cover style picker | PARTIAL | Title and Header tested; Total missing (issue #2) |

| Task | Status | Evidence |
|------|--------|----------|
| 1. API client (ApplyRangeStyle) | DONE | `frontend/api-client.js` lines 93–102 |
| 2. Format menu items | DONE | `electron/menu.js`, `preload.js` |
| 3. Grid rendering (CSS classes) | DONE | `app.js` applyCellValue, loadCells, refreshAllCells; `spreadsheet.css` |
| 4. Playwright tests | PARTIAL | Title, Header; Total missing |

---

## Recommendation

**Changes Requested.** Address HIGH issues #1 (dark mode) and #2 (Total test) before marking the story done. MEDIUM issues #3–5 improve documentation and consistency. LOW issues #6–7 are optional improvements.
