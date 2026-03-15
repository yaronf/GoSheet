# Story 23.1: Generic Font Fallback

Status: done

## Story

As a user,
I want fonts in my spreadsheet to use a sensible fallback when the specified font is not installed,
so that cells and style previews render legibly instead of falling back to the browser's generic font.

## Acceptance Criteria

1. **Given** a cell or style uses a font name (e.g. `"CustomFont"`, `"Helvetica"`)
   **When** that font is not installed on the system
   **Then** the renderer applies a fallback stack (e.g. `"CustomFont", sans-serif`) so a sensible default is used

2. **Given** the Manage Styles modal shows a style preview
   **When** the style's font is not installed
   **Then** the preview uses the same fallback stack and displays legibly

3. **Given** `formatToCssPreview` or cell style application
   **When** a font name is set
   **Then** `fontFamily` is set with a fallback (e.g. `"Helvetica", sans-serif`)

4. **Given** `docs/FILE_FORMAT.md` documents unknown font behavior
   **When** this story is complete
   **Then** the unknown fonts section reflects that GoSheet applies a fallback stack when rendering

## Tasks / Subtasks

- [x] Task 1: Add font fallback to formatToCssPreview (AC: 1, 2, 3)
  - [x] In `frontend/app-modals.js`: when setting `css.fontFamily = font.name`, append `, sans-serif` (or a configurable fallback)
  - [x] Ensure the fallback is applied for all font names (no special-case for "known" fonts — keep it simple)
  - [x] Verify Manage Styles preview and style picker use `formatToCssPreview` (they do)

- [x] Task 2: Verify cell rendering uses fallback (AC: 1, 3)
  - [x] `frontend/app-cell-editor.js` `applyCellStyleClasses` calls `formatToCssPreview` — confirm fallback flows through
  - [x] Check `frontend/app-ui.js` style preview in welcome/CSV flows if applicable
  - [x] No changes needed if `formatToCssPreview` is the single source — it is used by `applyCellStyleClasses` and Manage Styles

- [x] Task 3: Update FILE_FORMAT.md (AC: 4)
  - [x] In "Font names and unknown fonts" section: state that GoSheet applies a fallback stack (e.g. `"FontName", sans-serif`) when rendering
  - [x] Align with current text: "Implementations may add one when rendering"

- [x] Task 4: Manual verification
  - [x] Create a style with a non-installed font (e.g. "NonExistentFont"); verify preview and cell render with fallback
  - [x] Verify existing styles (Title, Header, Total) still render correctly

## Dev Notes

### Key Files

- **`frontend/app-modals.js`** — `formatToCssPreview` (line ~179). Currently: `if (font?.name) css.fontFamily = font.name`. Change to append fallback.
- **`frontend/app-cell-editor.js`** — `applyCellStyleClasses` uses `formatToCssPreview`; no change if formatToCssPreview is fixed.
- **`docs/FILE_FORMAT.md`** — "Font names and unknown fonts" (line ~92).

### Implementation Approach

**Option A (recommended):** Append `, sans-serif` to every font name in `formatToCssPreview`:
```js
if (font?.name) css.fontFamily = `${font.name}, sans-serif`;
```
Simple, covers all cases. `sans-serif` is a generic CSS keyword; the browser picks a system sans-serif when the named font fails.

**Option B:** Use a constant fallback stack, e.g. `"Helvetica", "Arial", sans-serif`. Slightly more robust across platforms but more complex. Start with Option A.

### Architecture Compliance

- Frontend-only change. No API, model, or controller changes.
- Vanilla JS; no new dependencies.
- `formatToCssPreview` is the single place that converts CellFormat → CSS for font; fix there and all consumers benefit.

### Testing

- **Manual:** Create style with fake font name; verify preview and cell render.
- **Playwright:** Optional — add test that applies style with custom font and asserts `fontFamily` contains fallback. Low priority for this small change.
- **Typecheck:** `npm run typecheck` must pass.

### References

- [Source: sprint-change-proposal-2026-03-15-epic23.md] Epic 23 scope
- [Source: docs/FILE_FORMAT.md#Font names and unknown fonts] Current unknown-font behavior
- [Source: frontend/app-modals.js] formatToCssPreview
- [Source: frontend/app-cell-editor.js] applyCellStyleClasses, formatToCssPreview usage

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- formatToCssPreview: appended `, sans-serif` to fontFamily for all font names
- FILE_FORMAT.md: updated unknown fonts section to state GoSheet applies fallback at render time
- applyCellStyleClasses uses formatToCssPreview — fallback flows through automatically

### File List

- frontend/app-modals.js — formatToCssPreview fontFamily fallback
- docs/FILE_FORMAT.md — unknown fonts section
- playwright_tests/test_font_fallback.spec.js — Playwright test: imaginary font renders with fallback

### CR Report

- [23-1-CR-REPORT.md](23-1-CR-REPORT.md) — Approve
