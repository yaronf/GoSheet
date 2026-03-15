# Code Review: Story 23.1 — Generic Font Fallback

**Story:** 23-1-generic-font-fallback.md  
**Git vs Story Discrepancies:** 0  
**Issues Found:** 0 High, 0 Medium, 1 Low

---

## Git vs Story Discrepancies

None. File List matches changed files.

---

## Code Review

### frontend/app-modals.js

**Change:** `formatToCssPreview` — `fontFamily` now uses `${font.name}, sans-serif` instead of `font.name` alone.

**Assessment:** ✅ Correct. Single-line change, minimal surface area. `sans-serif` is a CSS generic keyword; the browser selects a system sans-serif when the named font is unavailable. No special-casing for known fonts — keeps behavior consistent.

### docs/FILE_FORMAT.md

**Change:** "Font names and unknown fonts" section — added sentence: "If a font is not available on the system, GoSheet applies a fallback stack when rendering (e.g. `"CustomFont", sans-serif`) so a sensible default is used. The file format does not store the fallback; it is applied at render time."

**Assessment:** ✅ Clear. Correctly distinguishes file format (stores font name only) from render-time behavior (fallback applied by app).

### playwright_tests/test_font_fallback.spec.js

**Assessment:** ✅ Solid. Creates style with imaginary font `ZzyxxFont999`, applies to cell, asserts `getComputedStyle(cell).fontFamily` contains both the font name and `sans-serif`. Covers AC 1 and 3. `addStyleWithFont` helper is self-contained; format structure matches `AddStyleRequest` / `CellFormat`.

---

## LOW ISSUES

### L1: Test helper could be extracted to helpers.js

**Location:** playwright_tests/test_font_fallback.spec.js:8-41

**Finding:** `addStyleWithFont` is a useful helper that could be reused by other style-related tests (e.g. test_manage_styles.spec.js). Not blocking — only one consumer today.

**Fix (optional):** Move to helpers.js and export if future tests need it.

---

## Validation Summary

| AC | Status | Evidence |
|----|--------|----------|
| 1. Cell with unknown font → fallback stack | ✅ | formatToCssPreview; applyCellStyleClasses uses it |
| 2. Manage Styles preview → fallback | ✅ | formatToCssPreview used for style preview |
| 3. fontFamily set with fallback | ✅ | `${font.name}, sans-serif` |
| 4. FILE_FORMAT.md documents behavior | ✅ | Unknown fonts section updated |

**All Acceptance Criteria implemented.** Playwright test passed.

---

## Recommendation

**Approve.** Story is complete. L1 is optional; no changes required for merge.
