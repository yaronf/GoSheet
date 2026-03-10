# Story 18.2: Drag-to-Insert Range Reference While Editing Formula

Status: done

## Story

As a user,
I want to drag across cells while editing a formula to insert a range reference,
So that I can reference ranges like `B2:D5` without typing the address manually.

## Acceptance Criteria

1. Given a cell is in edit mode with a formula starting with `=`, when the user clicks and drags across a rectangular range of cells, then the range address (e.g. `B2:D5`) is inserted at the cursor position in the formula, and the dragged cells are highlighted with a distinct "reference selection" color (visually distinct from normal `.selected`).

2. Given a range reference is inserted by dragging, when the drag ends, then the formula editor cursor is positioned immediately after the inserted range reference, and the user can continue typing (e.g. add `+` or `)`).

3. Given a range reference has been inserted by dragging and the user drags again, when the second drag completes, then the previous range reference at the cursor is replaced with the new range; if the cursor has moved past the old reference, a new range reference is inserted at the current cursor position.

4. Given a range reference is inserted by dragging, when the formula is committed (Enter or Tab), then the formula evaluates correctly using the full range.

5. Given a cell is in edit mode without a leading `=` (plain text entry), when the user drags, then normal drag-to-select behavior occurs — no range reference insertion.

## Tasks / Subtasks

- [x] Task 1: Detect drag start during formula edit mode (AC: 1, 5)
  - [x] In `app.js` `mousedown` handler: if `appState.isEditing` AND active input value starts with `=`, set a `formulaDragState = { startRow, startCol }` instead of the normal `dragState`
  - [x] Suppress the normal `dragState` path when `formulaDragState` is active
  - [x] If plain-text edit mode, leave normal drag behavior unchanged

- [x] Task 2: Track drag range and apply "reference highlight" CSS class (AC: 1)
  - [x] In `app.js` `mousemove` handler: if `formulaDragState` is active, compute rectangular range `[startRow..row, startCol..col]` from drag start to current cell
  - [x] Clear any previous `.ref-highlight` classes
  - [x] Apply `.ref-highlight` CSS class to all cells in the range (distinct color, e.g. blue tint, not the normal selection blue)
  - [x] Live-update the formula editor with the current tentative range ref (e.g. `A1:B3`) so the user sees it as they drag — use the same `insertCellRefAtCursor` / replace logic from Story 18.1
  - [x] Add `.ref-highlight` CSS rule to `frontend/spreadsheet.css`

- [x] Task 3: Finalize range reference on mouseup (AC: 2, 3, 4)
  - [x] In `app.js` `mouseup` handler: if `formulaDragState` is active, compute final range, insert/replace range ref in editor at cursor, clear `.ref-highlight` classes, reset `formulaDragState = null`
  - [x] Position cursor after the inserted reference
  - [x] Keep focus on the formula editor input

- [x] Task 4: Reuse `insertCellRefAtCursor` from Story 18.1 for range strings (AC: 2, 3)
  - [x] Added `insertRangeRefAtCursor(startRow, startCol, endRow, endCol, inputEl)` in `app-cell-editor.js` to handle range strings
  - [x] Single-cell drag (start === end) produces a plain cell ref (e.g. `A1` not `A1:A1`)
  - [x] Reuses `lastInsertedRefSpan` replace-vs-append logic from 18.1

- [x] Task 5: Playwright tests (AC: 1–5)
  - [x] Drag range while editing formula: verify range ref inserted, cursor after ref, edit active
  - [x] Drag a second range: verify first ref replaced
  - [x] Type after first drag, drag again: verify second ref appended
  - [x] Commit formula after drag-insert: verify correct evaluation (e.g. `=SUM(A2:B2)`)
  - [x] Plain-text edit drag: normal selection behavior (no ref insertion)

## Dev Notes

### Key Files to Modify

- `frontend/app.js` — `mousedown`/`mousemove`/`mouseup` handlers; add `formulaDragState`
- `frontend/app-cell-editor.js` — extend `insertCellRefAtCursor` or add `insertRangeRefAtCursor`
- `frontend/styles.css` — add `.ref-highlight` rule
- `playwright_tests/test_formula_drag_insert.spec.js` — new test file

### Visual Design

`.ref-highlight` should be visually distinct from:
- `.selected` (normal selection — blue border/background)
- `.row-selected` / `.col-selected` (header selection band)

Suggested: semi-transparent blue-green tint (e.g. `rgba(0, 160, 180, 0.25)` with a solid border).

### Live Update During Drag

While dragging, the formula should update in real-time as the user expands the range. This means the `mousemove` handler needs to:
1. Compute tentative range ref
2. Replace the last inserted span in the input with the new range ref
3. This is the same as the "replace" path in `lastInsertedRefSpan` logic

This requires `formulaDragState` to also track the span of the initial reference insertion so it can be continuously replaced during the drag.

### Dependencies

- **Depends on Story 18.1** (click-to-insert infrastructure: `insertCellRefAtCursor`, `lastInsertedRefSpan`, formula-edit mode detection in click handler) — must be done first
- The drag infrastructure in `app.js` (`mousedown`/`mousemove`/`mouseup`) already exists (Story 17.1); this story adds a parallel `formulaDragState` path

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `formulaDragState = { startRow, startCol, inputEl }` is a separate drag state from `dragState`; active only when `appState.isEditing && input.value.startsWith('=')`
- `insertRangeRefAtCursor(startRow, startCol, endRow, endCol, inputEl)` added to `app-cell-editor.js`; reuses `lastInsertedRefSpan` replace-vs-append logic from Story 18.1; single-cell drag produces plain ref (e.g. `B2` not `B2:B2`)
- Live update during drag: `mousemove` calls `insertRangeRefAtCursor` on every intermediate cell — `lastInsertedRefSpan` replace path handles replacement without any extra state
- `.ref-highlight` CSS: `rgba(0, 160, 180, 0.18)` tint with `outline` border — visually distinct from `.selected` (teal) and normal cell state
- mouseup finalizes by clearing highlights and refocusing the editor; `suppressNextCellClick` cleared to avoid leaking across gestures
- Lint fixes: removed unused `colToLetter` import from `app.js` (Story 18.1 residual) and unused `letterToCol` import from `app-file-ops.js` (Story 17.x residual); extracted `handleRowHeaderClick` and `handleColHeaderClick` helpers to bring click handler complexity from 25 → within limit
- 7 Playwright tests in `test_formula_drag_insert.spec.js` — all pass; no retries triggered
- **CR fixes (all findings):**
  - H1: `cancelFormulaDrag()` exposed on `window._cancelFormulaDrag`; called from `cancelEditing` and on `window blur`; mouseup guards with `inputEl.isConnected`; mousemove bails via `isConnected` check
  - M1: removed redundant `suppressNextCellClick = true` from formula-drag mousedown path (click handler already guards via `appState.isEditing`)
  - M2: extracted `spliceRefIntoInput(ref, inputEl)` private helper — `insertCellRefAtCursor` and `insertRangeRefAtCursor` now delegate to it, eliminating ~30 lines of duplication
  - M3: added `lastRefHighlightRange` cache; mousemove skips all DOM work when the range hasn't changed (O(1) check per event for steady-state dragging)
  - L1: removed `waitForTimeout(300)` from AC5 test; replaced with condition-based wait
  - L2: AC5 test now asserts the specific expected outcome (editor commits, A1='hello') rather than accepting either of two possible behaviors
  - L3: added `[data-theme='dark'] .cell.ref-highlight` rule with higher opacity for adequate contrast on dark backgrounds

### File List

- frontend/app.js
- frontend/app-cell-editor.js
- frontend/app-file-ops.js
- frontend/spreadsheet.css
- playwright_tests/test_formula_drag_insert.spec.js
- _bmad-output/implementation-artifacts/18-2-drag-to-insert-range-reference.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
