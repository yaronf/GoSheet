# Story 21.1: Clear Cell Styling

Status: done

## Story

As a spreadsheet user,
I want to clear all formatting (style and alignment) from selected cells without affecting their content,
so that I can reset cells to the default unstyled appearance quickly.

## Acceptance Criteria

1. **Given** one or more cells are selected
   **When** the user triggers "Clear Formatting" (Cmd+\ shortcut, Format menu item, or context menu item)
   **Then** `styleId` is set to 0 and `alignment` is set to `""` for all selected cells
   **And** cell content (value) is preserved unchanged

2. **Given** a range selection (including open-ended row/column selections)
   **When** "Clear Formatting" is triggered
   **Then** formatting is cleared for all cells in the range that have explicit style or alignment

3. **Given** the Format menu
   **When** "Clear Formatting" is visible
   **Then** it appears as a distinct item separate from "Format Cleanup" (which removes unused styles from registry)

4. **Given** the context menu
   **When** cells are selected and right-clicked
   **Then** "Clear Formatting" appears in the format section of the context menu

5. **Given** the keyboard shortcut Cmd+\ is pressed
   **When** cells are selected
   **Then** formatting is cleared (same as menu action)

6. **Given** read-only mode is active
   **When** "Clear Formatting" is triggered
   **Then** the action is disabled/ignored (no change)

7. **Given** "Clear Formatting" is performed
   **When** the user presses Cmd+Z
   **Then** the formatting is restored (undo works)

## Tasks / Subtasks

- [ ] Task 1: Add Go backend endpoint `POST /api/range/clear-format` (AC: 1, 2, 7)
  - [ ] Add `ClearRangeFormat(startRow, startCol, endRow, endCol int)` to `controller/app.go` — sets StyleId=0, Alignment="" for cells in range (skip empty cells with no style already); wraps in Command for undo
  - [ ] Add handler `ClearRangeFormatHandler` in `api/handlers_format.go` — same request shape as `/api/range/style` (startRow, startCol, endRow, endCol); returns `hasUnsavedChanges` + undo/redo state
  - [ ] Register route in `server/main.go` or wherever routes are registered
  - [ ] Add `ClearRangeFormatCmd` in `controller/command.go` (undo/redo Command) capturing before/after per-cell styleId+alignment

- [ ] Task 2: Add frontend API client function (AC: 1)
  - [ ] Add `ClearRangeFormat(startRow, startCol, endRow, endCol)` to `frontend/api-client.js` — `POST /api/range/clear-format`

- [ ] Task 3: Add frontend handler function (AC: 1, 2, 6)
  - [ ] Add `clearFormattingFromSelection()` in `frontend/app-file-ops.js` — reads `appState.selection`, calls `ClearRangeFormat`, calls `refreshAllCells()`, calls `applyUndoRedoState()`; respects read-only (return early if `appState.isReadOnly`)
  - [ ] Export `clearFormattingFromSelection` and expose as `window.clearFormattingFromSelection` for menu use

- [ ] Task 4: Wire keyboard shortcut Cmd+\ (AC: 5)
  - [ ] Add keydown handler in `frontend/app.js` — `if (e.key === '\\' && (e.metaKey || e.ctrlKey))` → call `clearFormattingFromSelection()`
  - [ ] Add Electron menu accelerator `CmdOrCtrl+\\` in `electron/menu.js` Format menu

- [ ] Task 5: Add Format menu item (AC: 3)
  - [ ] In `electron/menu.js` Format menu: add "Clear Formatting" item with `accelerator: 'CmdOrCtrl+\\'` after the style items, before "Format Cleanup"
  - [ ] Click handler calls `window.clearFormattingFromSelection?.()`

- [ ] Task 6: Add context menu item (AC: 4)
  - [ ] In `frontend/app-ui.js` `populateContextMenuFormatItems()` or the context menu HTML in `frontend/app.js`: add "Clear Formatting" button in the format section
  - [ ] In `dispatchContextMenuAction()`: handle action `"clear-formatting"` → call `clearFormattingFromSelection()`

- [ ] Task 7: Add Playwright test (AC: 1, 3, 4, 7)
  - [ ] New file `playwright_tests/test_clear_formatting.spec.js`
  - [ ] Test: apply Title style to A1, trigger "Clear Formatting" via keyboard, confirm style class removed, content preserved
  - [ ] Test: apply style to range A1:B2, clear formatting, confirm all 4 cells cleared
  - [ ] Test: undo restores formatting

## Dev Notes

### Key Architecture Insight
**There is NO existing API endpoint to clear formatting without clearing content.** `ApplyRangeStyle` with `styleId=0` is explicitly a no-op (handlers_format.go line ~693: `if styleId == 0 { return ... }`). A new endpoint is required.

### Backend Pattern to Follow
The closest pattern is `ApplyStyleToRange` in `controller/app.go` and `api/handlers_format.go`:
- Command struct captures before/after state per cell for undo
- Handler reads request, calls controller, returns unified response with `hasUnsavedChanges` + undo state
- Route registered in `server/main.go`

For the `ClearRangeFormatCmd`, capture a slice of `{row, col, oldStyleId, oldAlignment}` for undo. On Do: set StyleId=0, Alignment="". On Undo: restore captured values.

**Important**: Only clear cells that actually have data or non-zero formatting — don't create empty cells just to set StyleId=0. Iterate over existing cells in range only.

### Frontend Patterns
- `clearFormattingFromSelection()` lives in `app-file-ops.js` alongside other selection-based format operations (e.g. `applyStyleToSelection`)
- Read-only guard: `if (appState.isReadOnly) return;`
- After API call: `await refreshAllCells()` + `applyUndoRedoState(result)`
- Expose via `window.clearFormattingFromSelection` for Electron menu IPC (same pattern as `window.__applyStyleToSelection`)

### Open-ended Range Handling
`appState.selection` may have `endRow === OPEN_END` or `endCol === OPEN_END` (value: `Infinity`). The Go backend handles OPEN_END by clamping to actual spreadsheet dimensions. Pass raw values — the backend already handles this (see `handlers_format.go` for range clamping pattern).

### Context Menu Location
Context menu format items are dynamically built in `app-ui.js:populateContextMenuFormatItems()` (lines ~181-203). The HTML shell is in `app.js` lines ~142-179 (`#context-menu-format-items` div). Add "Clear Formatting" as a static button in the format section of `app.js` HTML, then handle it in `dispatchContextMenuAction()`.

### Keyboard Shortcut
`Cmd+\` is currently unbound. In `app.js` the global keydown handler is at the bottom — add the shortcut there. In `menu.js` the accelerator string is `'CmdOrCtrl+\\'` (escaped backslash).

### Files to Touch
- `controller/app.go` — add `ClearRangeFormat()` method + `ClearRangeFormatCmd` struct
- `api/handlers_format.go` — add `ClearRangeFormatHandler`
- `server/main.go` — register new route
- `frontend/api-client.js` — add `ClearRangeFormat()`
- `frontend/app-file-ops.js` — add `clearFormattingFromSelection()`, expose on window
- `frontend/app.js` — add Cmd+\ keydown handler; add context menu HTML button
- `frontend/app-ui.js` — handle `clear-formatting` action in `dispatchContextMenuAction()`
- `electron/menu.js` — add "Clear Formatting" menu item with accelerator
- `playwright_tests/test_clear_formatting.spec.js` — new test file

### Testing Notes
- Use `waitForFunction` not sleeps
- Check that style CSS class is removed AND `cell.style.textAlign` is reset
- Verify cell value unchanged after clearing
- Run targeted: `npx playwright test test_clear_formatting.spec.js`

### Project Structure Notes
- Route registration: `server/main.go` — look for existing `router.HandleFunc("/api/range/style", ...)` pattern and add alongside
- Command pattern: `controller/command.go` — follow existing `ApplyStyleCmd` or `SetAlignmentCmd` pattern
- All API responses use `api.SuccessResponse` from `api/response.go`

### References
- [Source: frontend/app-file-ops.js#~620-691] Format menu listeners, `applyStyleToSelection`
- [Source: frontend/app-ui.js#~181-313] Context menu population and dispatch
- [Source: frontend/app.js#~142-179] Context menu HTML structure
- [Source: api/handlers_format.go#~129-151] `ApplyRangeStyle` handler pattern
- [Source: controller/app.go#~690-718] `ApplyStyleToRange` controller pattern
- [Source: model/cell.go#~8-19] Cell struct: `StyleId int`, `Alignment string`
- [Source: electron/menu.js#~136-177] Format menu with accelerators
- [Source: frontend/api-client.js#~254-263] `ApplyRangeStyle` API client pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- New Go endpoint `POST /api/range/clear-format` with `ClearRangeFormatCommand` for undo/redo
- `ClearRangeFormatCommand` modifies cells in-place (sets StyleId=0, Alignment="") — no cell deletion
- `/api/cells/all` does NOT include `styleId` key when styleId=0 — test assertions use `?? 0`
- Keyboard shortcut `Meta+\` intercepted by Electron menu accelerator → IPC → `menu-clear-formatting` → `onMenuClearFormatting` callback
- Context menu action `clear-formatting` dispatched in `dispatchContextMenuAction` in `app-ui.js`
- Binary must be rebuilt (`go build -o bin/gosheet-server ./server`) before test runs

### File List

- controller/command.go — added ClearRangeFormatCommand + cellFormatSnapshot types
- controller/app.go — added ClearRangeFormat() method
- api/handlers_format.go — added HandleClearRangeFormat handler
- server/main.go — registered /api/range/clear-format route
- frontend/api-client.js — added ClearRangeFormat() + export
- frontend/app-file-ops.js — added clearFormattingFromSelection(), window.clearFormattingFromSelection, onMenuClearFormatting listener
- frontend/app-cell-editor.js — added Cmd+\ case to handleKeydownFileOps
- frontend/app.js — added "Clear Formatting" context menu button (data-action="clear-formatting")
- frontend/app-ui.js — added 'clear-formatting' case to dispatchContextMenuAction
- electron/menu.js — added "Clear Formatting" menu item with CmdOrCtrl+\ accelerator in Format menu
- electron/preload.js — added onMenuClearFormatting IPC listener
- playwright_tests/test_clear_formatting.spec.js — new test file (4 tests, all passing)
