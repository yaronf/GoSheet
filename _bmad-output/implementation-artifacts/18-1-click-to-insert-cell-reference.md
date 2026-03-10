# Story 18.1: Click-to-Insert Cell Reference While Editing Formula

Status: done

## Story

As a user,
I want to click a cell while editing a formula to insert its reference at the cursor,
So that I can build formulas by pointing rather than typing cell addresses manually.

## Acceptance Criteria

1. Given a cell is in edit mode with a formula starting with `=`, when the user clicks any other cell, then the clicked cell's address (e.g. `B3`) is inserted at the current cursor position in the formula editor, and the formula edit mode remains active (the click does not commit or cancel the formula).

2. Given a formula is being edited and a cell reference has just been inserted by clicking, when the user clicks a different cell, then the previously inserted reference token is replaced with the new cell's address; if the cursor has moved past the reference (e.g. user typed an operator after it), a new reference is appended at the current cursor position instead.

3. Given a cell is in edit mode without a leading `=` (plain text entry), when the user clicks another cell, then normal navigation occurs: the edit is committed and the new cell is selected — no reference insertion.

4. Given a cell reference is inserted by clicking, when the formula is committed (Enter or Tab), then the formula evaluates correctly using the clicked cell's value.

5. Given a formula is being edited in the formula bar (not the inline cell editor), when the user clicks a cell, then the same reference-insertion behavior applies (reference inserted at formula-bar cursor position, edit mode maintained).

## Tasks / Subtasks

- [x] Task 1: Track "just-inserted-by-click" reference span in edit state
  - [x] Add state to track the span `[insertStart, insertEnd]` of the last auto-inserted reference in the formula string, so it can be replaced on the next click
  - [x] Reset the span when the user types a non-reference character (operator, comma, paren, etc.) or moves the cursor manually
  - [x] Store this state in a module-level variable in `app-cell-editor.js` (e.g. `lastInsertedRefSpan`)

- [x] Task 2: Intercept cell click during formula edit mode (AC: 1, 2, 3)
  - [x] In `app.js` cell click handler: check `appState.isEditing` AND active input value starts with `=`
  - [x] If in formula edit mode: call `insertCellRefAtCursor(row, col)` and `return` (suppress normal `selectCell`)
  - [x] If in plain-text edit mode (`isEditing` but no leading `=`): let the existing commit-and-navigate path run unchanged

- [x] Task 3: Implement `insertCellRefAtCursor(row, col)` in `app-cell-editor.js` (AC: 1, 2)
  - [x] Find the active `.cell-editor` input element
  - [x] Compute the cell reference string using `colToLetter(col) + (row + 1)`
  - [x] If `lastInsertedRefSpan` is set AND cursor is still at `insertEnd`: replace `[insertStart, insertEnd]` in the input value with the new ref
  - [x] Otherwise: splice the ref at `input.selectionStart`, shifting subsequent characters right
  - [x] Update `lastInsertedRefSpan` to `[insertStart, insertStart + ref.length]`
  - [x] Set `input.selectionStart = input.selectionEnd = insertStart + ref.length`
  - [x] Keep focus on the input (call `input.focus()`)

- [x] Task 4: Intercept formula-bar click during edit mode (AC: 5)
  - [x] In `app.js` mousedown handler: check if the formula bar (`#formula-bar`) is the active element AND its value starts with `=`
  - [x] If so: insert the reference at the formula-bar's cursor position using the same logic
  - [x] Keep focus on the formula bar (via `preventDefault` on mousedown)

- [x] Task 5: Playwright tests (AC: 1–5)
  - [x] Click cell while editing formula: verify ref inserted, edit mode still active
  - [x] Click second cell: verify previous ref replaced
  - [x] Type operator after ref, click again: verify new ref appended (not replaced)
  - [x] Plain-text edit: click other cell navigates normally
  - [x] Commit formula after click-insert: verify correct evaluation

## Dev Notes

### Key Files to Modify

- `frontend/app.js` — intercept cell click when `appState.isEditing` and formula in progress
- `frontend/app-cell-editor.js` — `insertCellRefAtCursor`, `lastInsertedRefSpan` state
- `frontend/app-utils.js` — `colToLetter` already available
- `playwright_tests/test_formula_click_insert.spec.js` — new test file

### Interaction Model

The tricky part is distinguishing three cases on cell click:
1. **Not editing** → normal `selectCell`
2. **Editing plain text** (`isEditing`, no `=`) → commit + navigate (current behavior)
3. **Editing formula** (`isEditing`, leading `=`) → insert ref, stay in edit

The "replace vs append" heuristic:
- Track `lastInsertedRefSpan = { start, end }` after each click-insert
- On next click: if cursor is at `end` (user hasn't typed anything after the ref), replace `[start, end]`
- Otherwise: insert at current cursor (append)
- Reset `lastInsertedRefSpan` on any keydown event in the editor

### Edge Cases

- Merged cells: use anchor cell address (already handled by `resolveToAnchor`)
- Formula bar vs inline editor: need to check which one has focus
- Row/column header clicks during formula edit: should insert row/column range notation (out of scope for 18.1, but don't break)

### Dependencies

- Depends on: Story 17.3 (copy/paste range — cell editor infrastructure) ✓ done
- Story 18.2 (drag-to-insert range) builds directly on this story's infrastructure

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `lastInsertedRefSpan` module-level state in `app-cell-editor.js` tracks the span of the last auto-inserted reference for replace-vs-append logic
- `insertCellRefAtCursor(row, col, inputEl)` handles both `.cell-editor` and `#formula-bar` inputs
- `suppressBlurFinish` flag prevents the rAF blur handler from committing the formula when `insertCellRefAtCursor` refocuses the editor
- Replaced `setTimeout(150)` blur handler with `requestAnimationFrame` — lets the click event run first before deciding whether to finish editing; eliminates the arbitrary sleep
- Formula-bar ref insertion handled in `mousedown` (not `click`) with `preventDefault` to retain focus; `suppressNextCellClick` prevents the subsequent click event from navigating
- Plain-text edit path unchanged: falls through to `selectCell` → `saveCurrentEditOnCellSwitch`
- 6 Playwright tests in `test_formula_click_insert.spec.js` — all pass; no retries triggered

### File List

- frontend/app-cell-editor.js
- frontend/app.js
- playwright_tests/test_formula_click_insert.spec.js
- _bmad-output/implementation-artifacts/18-1-click-to-insert-cell-reference.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
