# Story 19.4: Toolbar Style Buttons

Status: done

## Story

As a user,
I want the toolbar to show named-style buttons instead of alignment buttons,
So that I can apply styles with one click and the toolbar reflects the real style system rather than ad-hoc alignment controls.

## Acceptance Criteria

1. **Given** the application is running and showing the spreadsheet view, **when** the user looks at the toolbar, **then** the three alignment buttons (Align Left, Align Center, Align Right) are no longer present.

2. **Given** the application is running, **when** the spreadsheet view is shown, **then** the toolbar contains style buttons — one per named style (minimum: Title, Header, Total) — positioned where the alignment buttons were (after the Undo/Redo separator).

3. **Given** styles have been loaded from `GET /api/styles`, **when** a style button is rendered, **then** it displays the style's name as its label and is styled visually to reflect that named style (e.g., Title button is bold, Header is bold+colored).

4. **Given** a cell or range is selected and the spreadsheet is not read-only, **when** the user clicks a style button, **then** `ApplyRangeStyle` is called for the selection with that style's ID — identical behavior to clicking the corresponding item in the Format menu.

5. **Given** the spreadsheet is in read-only mode, **when** the user inspects the style buttons, **then** all style buttons are disabled (same pattern as the save button and former alignment buttons).

6. **Given** new styles are added or existing styles are renamed via the Manage Styles dialog, **when** the dialog closes and `syncFormatMenuFromApi` is called, **then** the toolbar style buttons are rebuilt to reflect the updated style list.

7. **Given** custom styles beyond the built-in three exist, **when** the toolbar is rendered, **then** all styles (built-in + custom) appear as toolbar buttons (same set as shown in the Format menu).

## Tasks / Subtasks

- [x] Task 1: Remove alignment buttons from toolbar HTML in `frontend/app.js` (AC: 1)
  - [x] Remove the `<!-- Alignment buttons -->` separator + the three `align-left-btn`, `align-center-btn`, `align-right-btn` button elements from the inline HTML template
  - [x] Keep the `<span class="toolbar-separator">` before them if style buttons will follow; otherwise remove it too

- [x] Task 2: Add dynamic style button container to toolbar HTML in `frontend/app.js` (AC: 2, 3)
  - [x] Add a `<div id="toolbar-style-buttons" class="toolbar-style-group"></div>` placeholder in the toolbar after the undo/redo separator
  - [x] Write a `buildToolbarStyleButtons(styles)` function that:
    - Clears `#toolbar-style-buttons`
    - For each style in `styles`, creates a `<button>` with: `id="style-btn-${s.id}"`, `class="toolbar-btn toolbar-style-btn"`, `title="${s.name}"`, `aria-label="Apply ${s.name} style"`, and label text = `s.name`
    - Applies a visual preview: for built-in styles, applies known CSS (e.g., `font-weight:bold` for Title/Header); for custom styles, applies the style's format fields if available
    - Attaches click handler → calls `applyStyleToSelection(s.id)`

- [x] Task 3: Wire style buttons into the existing style lifecycle in `frontend/app-file-ops.js` (AC: 4, 5, 6, 7)
  - [x] After `applyStyleToSelection` is defined (line ~596), call `buildToolbarStyleButtons` to do initial render
  - [x] In `setReadOnly(value)` (line ~76), replace the loop over `['align-left-btn', ...]` with a loop that disables/enables all `.toolbar-style-btn` elements
  - [x] In `syncFormatMenuFromApi` (line ~155), after calling `window.electronAPI?.syncFormatMenu?.(styles)`, also call `buildToolbarStyleButtons(styles)` to keep toolbar in sync

- [x] Task 4: Remove alignment button event listeners from `frontend/app.js` (AC: 1)
  - [x] Remove the three `.getElementById('align-*-btn').addEventListener(...)` calls at lines ~901–908
  - [x] Remove the `import { applyAlignmentToSelection, STYLE_ID }` → replace with `import { STYLE_ID }` from `app-cell-editor.js` if `applyAlignmentToSelection` is no longer needed in `app.js` (check if used elsewhere first)

- [x] Task 5: Update `setReadOnly` alignment button loop in `frontend/app-file-ops.js` (AC: 5)
  - [x] Replace the hard-coded `['align-left-btn', 'align-center-btn', 'align-right-btn']` array in `setReadOnly` with `document.querySelectorAll('.toolbar-style-btn')`

- [x] Task 6: Add CSS for toolbar style buttons in `frontend/style.css` or `frontend/spreadsheet.css` (AC: 3)
  - [x] `.toolbar-style-btn` — base style: text label, same height as other toolbar buttons, compact padding
  - [x] Built-in style previews: `.toolbar-style-btn[data-style-id="1"]` → bold; `[data-style-id="2"]` → bold + accent color; `[data-style-id="3"]` → italic or distinct color

- [x] Task 7: Write Playwright tests in `playwright_tests/test_toolbar_style_buttons.spec.js` (AC: 1–6)
  - [x] Test: alignment buttons no longer present in DOM
  - [x] Test: style buttons rendered with correct labels (Title, Header, Total)
  - [x] Test: clicking a style button applies the style to selected cell (verify via API)
  - [x] Test: style buttons disabled in read-only mode
  - [x] Test: style buttons rebuilt after `syncFormatMenuFromApi` (simulate via API style creation)

- [x] Task 8: Run targeted tests to confirm no regressions
  - [x] `npm test -- --grep "toolbar style"` — all new tests pass
  - [x] `npm test -- --grep "alignment"` — alignment tests still pass (alignment still works via menu/context menu)

## Dev Notes

### Key Files

- `frontend/app.js` — toolbar HTML template (lines 86–148), alignment button event listeners (lines 899–908)
- `frontend/app-file-ops.js` — `setReadOnly` (line 76), `syncFormatMenuFromApi` (line 155), `applyStyleToSelection` (line 597), `onMenuApplyStyle` wiring (line 624)
- `frontend/app-cell-editor.js` — `STYLE_ID` constant (line 126), `applyAlignmentToSelection` (line 432+)
- `frontend/app-ui.js` — context menu style buttons (line 196), `align-left/center/right` action handlers (lines 300–304) — **DO NOT REMOVE** these; alignment still works via context menu and View menu
- `frontend/style.css` or `frontend/spreadsheet.css` — add `.toolbar-style-btn` styles

### Alignment Buttons: What to Remove vs Keep

**REMOVE** (toolbar only):
- HTML: `align-left-btn`, `align-center-btn`, `align-right-btn` buttons in `app.js` template
- JS: The three `.getElementById('align-*-btn').addEventListener(...)` calls in `app.js`
- JS: The `['align-left-btn', ...]` loop in `setReadOnly` in `app-file-ops.js`

**KEEP** (alignment still works via menu/context):
- `applyAlignmentToSelection` function in `app-cell-editor.js` — used by context menu and View menu IPC handlers
- `align-left/center/right` action handlers in `app-ui.js` (context menu actions)
- `menu-align-left/center/right` IPC listeners (View menu still has alignment items)
- Alignment undo/redo tests — alignment functionality is not removed, just the toolbar buttons

### Style Button Visual Preview

Built-in style IDs (from `STYLE_ID` in `app-cell-editor.js`):
- `STYLE_ID.TITLE = 1` — typically bold, larger
- `STYLE_ID.HEADER = 2` — bold, accent color
- `STYLE_ID.TOTAL = 3` — italic or highlighted

Apply `data-style-id="${s.id}"` attribute to each button so CSS selectors can target them.

For custom styles: the `GET /api/styles` response includes format fields. Apply them inline if the format object is available.

### `buildToolbarStyleButtons` Placement

This function should be defined in `app-file-ops.js` (where `applyStyleToSelection` is defined) or as a module export from `app.js`. The simplest approach: define it in `app-file-ops.js` as a module-level function and expose it on `window` if needed by `syncFormatMenuFromApi`.

Alternatively, define in `app.js` and import `applyStyleToSelection` — but this creates a circular dependency risk. **Preferred:** define `buildToolbarStyleButtons` in `app-file-ops.js`, call it there, and also call it from `syncFormatMenuFromApi`.

### Initial Load Sequence

On spreadsheet open (`buildSpreadsheet` or `loadCells`), `window.syncFormatMenuFromApi?.()` is already called (see `app.js` line 884). Since `buildToolbarStyleButtons` will be called inside `syncFormatMenuFromApi`, the toolbar will be populated on first load automatically.

### Read-Only Pattern

Current `setReadOnly` loops over a hard-coded array of button IDs (line 83 in `app-file-ops.js`). Replace with:
```js
document.querySelectorAll('.toolbar-style-btn').forEach(btn => btn.disabled = value);
```
This is dynamic and handles any number of style buttons.

### No Backend Changes

This story is frontend-only. No Go changes, no API changes, no preload.js changes.

### Testing Pattern

For style application test — use `GET /api/cell` to verify `styleId` was set after clicking toolbar button. Pattern established in `test_manage_styles.spec.js`.

For read-only test — use `window.electronAPI.updateMenuState({ isReadOnly: true })` pattern established in existing read-only tests.

### Project Structure Notes

- No new files needed except `test_toolbar_style_buttons.spec.js`
- CSS goes into `frontend/style.css` (existing toolbar styles are there)
- Follow existing toolbar button pattern: `class="toolbar-btn"`, SVG icon or text label

### References

- [Source: frontend/app.js#86–148] — toolbar HTML template
- [Source: frontend/app.js#899–908] — alignment event listeners to remove
- [Source: frontend/app-file-ops.js#76–91] — `setReadOnly` with alignment button loop
- [Source: frontend/app-file-ops.js#155–166] — `syncFormatMenuFromApi`
- [Source: frontend/app-file-ops.js#597–633] — `applyStyleToSelection` and IPC wiring
- [Source: frontend/app-cell-editor.js#126] — `STYLE_ID` constants
- [Source: frontend/app-ui.js#196] — context menu style buttons (keep these)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 19] — story rationale

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `frontend/app.js` — removed alignment buttons from toolbar HTML; removed alignment event listeners; removed `applyAlignmentToSelection` import
- `frontend/app-file-ops.js` — replaced alignment button loop in `setReadOnly` with `.toolbar-style-btn` selector; added `buildToolbarStyleButtons`; wired into `syncFormatMenuFromApi`; exposed `__applyStyleToSelection` on window
- `frontend/spreadsheet.css` — added `.toolbar-style-group`, `.toolbar-style-btn`, and built-in style preview CSS
- `playwright_tests/test_toolbar_style_buttons.spec.js` — new test file (5 tests)
