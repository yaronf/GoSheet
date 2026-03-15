# Story 23.5: Formula Reference UX Polish

Status: done

## Story

As a user editing a formula,
I want to drag-to-insert range references from the formula bar and see inserted refs when editing inline,
so that formula entry is consistent and the inserted reference is always visible.

## Acceptance Criteria

1. **Given** the user is editing a formula in the formula bar (focus in `#formula-bar`, value starts with `=`)
   **When** the user mousedowns on a cell and drags to another cell
   **Then** a range reference (e.g. `A1:C3`) is inserted at the cursor, with live-update as they drag

2. **Given** the user is editing a formula inline (cell-editor with `=` formula)
   **When** the user inserts a cell or range reference via click or drag
   **Then** the inserted reference remains visible (e.g. cell expands, formula scrolls, or cursor shifts so the ref is in view)

3. **Given** AC 1 and 2
   **When** the user completes the insertion
   **Then** no regression to existing 18.1 (click) and 18.2 (inline drag) behavior

## Tasks / Subtasks

- [x] Task 1: Enable formula-bar drag-to-insert-range (AC: 1)
  - [x] In `frontend/app.js` mousedown handler: when formula bar is focused with formula, allow starting formula drag (reuse formulaDragState pattern from inline path)
  - [x] Pass formula bar element as `inputEl` to formulaDragState so mousemove/mouseup update it
  - [x] Ensure ref-highlight and insertRangeRefAtCursor work with formula bar (spliceRefIntoInput already supports formula-bar via `document.activeElement`)

- [x] Task 2: Improve inline ref visibility (AC: 2)
  - [x] Audit `frontend/app-cell-editor.js` and cell-editor styling — when ref is inserted, is it visible?
  - [x] Options: expand cell width on focus, scroll formula left so cursor/ref visible, or ensure min-width on cell-editor
  - [x] Implement chosen approach (e.g. `scrollIntoView` on inserted ref, or `input.scrollLeft` adjustment)

- [x] Task 3: Manual verification (AC: 3)
  - [x] Formula bar: type `=SUM(`, drag A1 to C3, verify `A1:C3` inserted
  - [x] Inline: edit cell, insert ref in narrow column, verify ref visible
  - [x] Run existing tests: `test_formula_click_insert.spec.js`, `test_formula_drag_insert.spec.js`

## Dev Notes

### Key Files

- **`frontend/app.js`** — mousedown handler (lines 318–337); formula bar path inserts single-cell ref only; formula drag (339–360) only runs for `appState.isEditing` + cell-editor. Need to extend formula drag to formula-bar path.
- **`frontend/app-cell-editor.js`** — `insertRangeRefAtCursor`, `spliceRefIntoInput`; `spliceRefIntoInput` resolves `#formula-bar` when active.
- **`frontend/spreadsheet.css`** — `.cell-editor`, `.formula-bar` styling; ref-highlight styles.

### Current Behavior

- **Formula bar + click:** Inserts single-cell ref (18.1). No drag.
- **Inline cell-editor + drag:** Full range drag with live-update (18.2).

### Gap

- Formula bar does not support drag-to-insert-range. The mousedown handler returns early after `insertCellRefAtCursor` for formula bar; it never starts `formulaDragState`.

### Architecture Compliance

- Frontend-only. No Go API or Electron changes.

### References

- [Source: sprint-change-proposal-2026-03-15-epic23.md] Epic 23 scope, 23-5 description

---

## Completion Notes

**Implemented:** 2026-03-15

### Summary

- **Formula bar drag (AC1):** Replaced single-cell insert with formula drag start. When formula bar is focused with formula, mousedown on a cell now starts `formulaDragState` with `inputEl: fbar`, so mousemove live-updates the range and mouseup finalizes. Click (no drag) still inserts single-cell ref via `insertRangeRefAtCursor(row,col,row,col)`.
- **Inline ref visibility (AC2):** In `spliceRefIntoInput`, after inserting ref, scroll the input right so the inserted ref is visible: `input.scrollLeft = input.scrollWidth - input.clientWidth` when content overflows.

### Files Touched

- `frontend/app.js` — formula bar mousedown: start formula drag instead of single insert
- `frontend/app-cell-editor.js` — spliceRefIntoInput: scroll to show inserted ref
- [Source: 18-1-click-to-insert-cell-reference.md] Click-to-insert infrastructure
- [Source: 18-2-drag-to-insert-range-reference.md] Formula drag state, insertRangeRefAtCursor
- [Source: backlog.md] "Epic 18 ✓ Done. Gaps: drag doesn't work in formula bar; inline ref may be hidden."
