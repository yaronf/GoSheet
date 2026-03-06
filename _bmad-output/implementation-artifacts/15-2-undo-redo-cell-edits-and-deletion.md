# Story 15.2: Undo/Redo for Cell Edits and Deletion

**Status:** review
**Epic:** 15 — Undo / Redo

---

## Story

As a user,
I want to undo and redo cell value changes and deletions with Cmd+Z / Cmd+Shift+Z,
So that I can recover from accidental edits or deletions instantly.

---

## Acceptance Criteria

**AC1 — Undo cell edit**
**Given** a user types a new value into a cell and presses Enter
**When** the user presses Cmd+Z
**Then** the cell reverts to its previous value
**And** the grid updates immediately

**AC2 — Undo cell deletion**
**Given** a user deletes a cell's contents (Delete or Backspace)
**When** the user presses Cmd+Z
**Then** the deleted content is restored in the cell

**AC3 — Sequential undo**
**Given** a user edits multiple cells in sequence
**When** the user presses Cmd+Z repeatedly
**Then** each edit is undone in reverse order, one per key press

**AC4 — Redo**
**Given** an undo has been performed
**When** the user presses Cmd+Shift+Z
**Then** the undone change is reapplied

**AC5 — Edit menu integration**
**Given** the Edit menu
**When** undo is available
**Then** "Undo [operation]" is enabled (e.g. "Undo Set Cell A1")
**And** "Redo [operation]" is enabled when redo is available, disabled otherwise

**AC6 — Undo/Redo toolbar buttons**
**Given** the toolbar
**When** undo is available
**Then** an Undo button is visible and enabled
**And** a Redo button is visible, enabled only when redo is available

**AC7 — Disabled state when history empty**
**Given** the history is empty (no edits made)
**When** the user presses Cmd+Z
**Then** nothing happens and "Undo" in the Edit menu is disabled

---

## Tasks / Subtasks

- [x] Task 1: Add `/api/undo` and `/api/redo` HTTP endpoints (AC: 1, 2, 3, 4, 7)
  - [x] Add `HandleUndo` and `HandleRedo` handlers in `api/handlers.go`
  - [x] Response includes `canUndo`, `canRedo`, `undoDescription`, `redoDescription` so the frontend can update state in one round-trip
  - [x] Register routes `POST /api/undo` and `POST /api/redo` in `server/main.go`
  - [x] Add handler tests in `api/handlers_test.go`
- [x] Task 2: Add `ClearRange` to the history (AC: 2)
  - [x] Implement `ClearRangeCommand` in `controller/command.go` (snapshots all cells in range before clearing)
  - [x] Refactor `ClearRange` in `controller/app.go` to push `ClearRangeCommand` instead of mutating directly
  - [x] Add unit tests in `controller/command_test.go`
- [x] Task 3: Wire keyboard shortcuts in the frontend (AC: 1, 2, 3, 4, 7)
  - [x] In `handleKeydownFileOps` (`frontend/app.js`): handle `Cmd+Z` → call `POST /api/undo`, `Cmd+Shift+Z` → call `POST /api/redo`
  - [x] After each undo/redo: call `refreshAllCells()` and `displayFileStatus()`
  - [x] After each undo/redo: call `applyUndoRedoState()` to update menu and toolbar
- [x] Task 4: Add Undo/Redo to Edit menu (AC: 5, 7)
  - [x] In `electron/menu.js`, insert "Undo" (id: `undo`, accelerator: `CmdOrCtrl+Z`) and "Redo" (id: `redo`, accelerator: `CmdOrCtrl+Shift+Z`) at the top of the Edit submenu, followed by a separator
  - [x] Both items start `enabled: false` (no history on startup)
  - [x] In `updateMenuState`, handle `canUndo`, `canRedo`, `undoDescription`, `redoDescription` to enable/disable and update labels
  - [x] In `electron/main.js`, add IPC handlers for `menu-undo` and `menu-redo` that send to renderer
  - [x] In `electron/preload.js`, expose `onMenuUndo` and `onMenuRedo` listeners
  - [x] In `frontend/app.js`, register `onMenuUndo` → call `/api/undo`, `onMenuRedo` → call `/api/redo`
- [x] Task 5: Add Undo/Redo toolbar buttons (AC: 6, 7)
  - [x] Added undo/redo icon buttons to the toolbar in `frontend/app.js` (toolbar template)
  - [x] Wire click handlers in `frontend/app.js` to call `performUndo`/`performRedo`
  - [x] Buttons reflect `canUndo`/`canRedo` state (disabled when stack empty)
  - [x] `applyUndoRedoState()` helper updates both menu and toolbar in one place
- [x] Task 6: Write Playwright E2E tests (AC: 1, 2, 3, 4, 7)
  - [x] Test: type value, Cmd+Z → cell empty
  - [x] Test: delete cell (Delete key), Cmd+Z → value restored
  - [x] Test: two sequential edits, Cmd+Z twice → correct rollback order
  - [x] Test: undo then Cmd+Shift+Z → value restored
  - [x] Test: Undo menu item disabled on fresh sheet; enabled after edit

---

## Dev Notes

### Architecture

This story is purely additive — the History stack and `SetCellValue` command are already wired (Story 15.1). This story adds:

1. **HTTP exposure**: two new endpoints so the frontend can trigger undo/redo
2. **ClearRange wrapping**: the one remaining frontend-triggered cell mutation not yet in history
3. **UI plumbing**: keyboard shortcuts, Edit menu items, toolbar buttons

**No Go model changes required.** All work is in `api/`, `controller/`, `electron/`, and `frontend/`.

### New HTTP endpoints

```
POST /api/undo  → 200 { success, data: { canUndo, canRedo, undoDescription, redoDescription } }
POST /api/redo  → 200 { success, data: { canUndo, canRedo, undoDescription, redoDescription } }
```

On empty stack: return 200 with `canUndo: false` (not a 4xx) — this is an application-level no-op, not a protocol error. The frontend can silently ignore it.

Follow the same handler pattern as `HandleNewFile` (`api/handlers.go:240`) for the structure, and `HandleSetCellValue` for the response envelope.

Add to `server/main.go` alongside other API routes:

```go
http.HandleFunc("/api/undo", cors(srv.HandleUndo))
http.HandleFunc("/api/redo", cors(srv.HandleRedo))
```

### ClearRangeCommand

`ClearRange` is called when the user presses Delete/Backspace over a selected range (`frontend/app.js` → `POST /api/range/clear`). It must be wrapped in a command to make AC2 work.

Pattern (mirrors `SetCellCommand` from Story 15.1):

```go
type ClearRangeCommand struct {
    ctrl                         *AppController
    startRow, startCol           int
    endRow, endCol               int
    prevCells map[int]map[int]*model.Cell  // deep copy of all cells in range before clear
}
```

`Do()`: iterate range, snapshot then clear each clearable cell (respect `Sheet.ShouldClearCell`).
`Undo()`: restore each snapshotted cell directly to `Sheet.Cells[row][col]`, rebuild dependencies, call `recalculateDependents`.

**Note on `ShouldClearCell`:** this method (on `model.Spreadsheet`) returns false for non-anchor cells in a merged region. Respect this in both `Do()` and `Undo()` — don't snapshot or restore non-anchor covered cells.

Description: `"Clear Range A1:C3"` (use `model.CoordsToRef` for corners).

### Keyboard shortcut placement

Add Cmd+Z and Cmd+Shift+Z to `handleKeydownFileOps` in `frontend/app.js:1789`. This function already handles `metaKey`/`ctrlKey` and returns `true` to stop event propagation. Guard with `if (isEditing) return false` so undo doesn't fire mid-cell-edit (the existing `isEditing` guard at line 1888 handles the outer dispatch, but `handleKeydownFileOps` is called from within it — double-check the guard chain).

```js
if (e.key === 'z' && !e.shiftKey) {
  e.preventDefault();
  await performUndo();
  return true;
}
if (e.key === 'z' && e.shiftKey) {
  e.preventDefault();
  await performRedo();
  return true;
}
```

### Edit menu label update pattern

`updateMenuState` in `electron/menu.js` receives state from the renderer via `ipcRenderer.send('menu:updateState', state)`. The existing pattern (see lines 576–613) looks up menu items by `id` and mutates `.enabled`. For undo/redo also mutate `.label`:

```js
const undoItem = menu.getMenuItemById('undo');
if (undoItem) {
  undoItem.enabled = !!state.canUndo;
  if (state.undoDescription) undoItem.label = `Undo ${state.undoDescription}`;
  else undoItem.label = 'Undo';
}
```

On macOS, Electron rebuilds the native menu automatically when `.label` or `.enabled` changes on a menu item obtained via `getMenuItemById`.

### Toolbar HTML

The toolbar is in `frontend/index.html`. Follow the same icon button pattern as existing toolbar buttons (inspect the save/new/load buttons for the exact HTML pattern). Use Unicode arrows or SVG icons — keep it consistent with existing style. Buttons need `id="undo-btn"` and `id="redo-btn"` for reliable test selectors.

### State synchronisation helper

To avoid duplicating `updateMenuState` calls, introduce a single JS function:

```js
async function updateUndoRedoState() {
  // Can also be called with a pre-fetched result from /api/undo or /api/redo
  const resp = await fetch('/api/undo/state');  // OR extract from undo/redo response
  window.electronAPI?.updateMenuState({
    canUndo: resp.canUndo,
    canRedo: resp.canRedo,
    undoDescription: resp.undoDescription,
    redoDescription: resp.redoDescription,
  });
  document.getElementById('undo-btn')?.toggleAttribute('disabled', !resp.canUndo);
  document.getElementById('redo-btn')?.toggleAttribute('disabled', !resp.canRedo);
}
```

Alternatively: return `canUndo`/`canRedo`/descriptions directly from the `/api/undo` and `/api/redo` response bodies (recommended — avoids extra round-trip). Also include them in the `/api/cell/set` response so the toolbar/menu update immediately after every cell edit without needing a separate call.

### Key files

- `controller/command.go` — add `ClearRangeCommand`
- `controller/command_test.go` — new tests for ClearRangeCommand
- `controller/app.go` — refactor `ClearRange` to push command
- `api/handlers.go` — add `HandleUndo`, `HandleRedo`
- `api/handlers_test.go` — handler tests
- `server/main.go` — register new routes
- `electron/menu.js` — add undo/redo menu items, update `updateMenuState`
- `electron/main.js` — add IPC handlers for menu-undo, menu-redo
- `electron/preload.js` — expose `onMenuUndo`, `onMenuRedo`
- `frontend/index.html` — add undo/redo toolbar buttons
- `frontend/app.js` — keyboard shortcuts, menu handlers, toolbar handlers, `updateUndoRedoState`
- `playwright_tests/` — new E2E test file or additions to existing

### What is NOT in scope

- `InsertRow`, `InsertColumn`, paste, style/alignment/merge commands — those are Story 15.3 and 15.4
- Multi-cell paste undo — Story 15.3
- Undo/redo state in the `/api/file/status` response — not needed; use the undo/redo response body

### Testing approach

Playwright E2E tests are the primary verification for AC1–7. Go unit tests cover `ClearRangeCommand`. Handler tests cover the HTTP layer.

For Playwright, use `window.keyboard.press('Meta+z')` for Cmd+Z (existing tests use this pattern). After undo, use `page.waitForFunction` to confirm cell value changed rather than a fixed sleep.

---

## References

- `controller/command.go` — `Command` interface, `History`, `SetCellCommand`
- `controller/app.go` — `ClearRange`, `Undo()`, `Redo()` wrappers
- `api/handlers.go` — handler patterns
- `server/main.go` — route registration
- `electron/menu.js` — `updateMenuState`, Edit menu definition
- `electron/preload.js` — IPC listener pattern
- `frontend/app.js:1789` — `handleKeydownFileOps`
- `frontend/app.js:3004` — Edit menu handler registrations pattern
- `_bmad-output/planning-artifacts/epics.md` — Epic 15 Story 15.2 ACs

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

1. `HandleUndo` / `HandleRedo` handlers added to `api/handlers.go`; both return `canUndo`, `canRedo`, `undoDescription`, `redoDescription` for single-round-trip state updates. `HandleSetCellValue` response extended with same fields.
2. `ClearRangeCommand` added to `controller/command.go`: snapshots all clearable cells before clearing, restores with fresh formula re-evaluation on undo. `ClearRange` in `app.go` refactored to push this command.
3. Keyboard shortcuts: `Cmd+Z` / `Cmd+Shift+Z` added to `handleKeydownFileOps`; guarded by existing `isEditing` check.
4. Edit menu: Undo (id: `undo`, `CmdOrCtrl+Z`) and Redo (id: `redo`, `CmdOrCtrl+Shift+Z`) items added at top of Edit submenu, start disabled. `updateMenuState` extended to update enabled state and label (e.g. "Undo Set Cell A1").
5. Toolbar: undo/redo icon buttons added (`#undo-btn`, `#redo-btn`), start `disabled`. `applyUndoRedoState()` helper keeps menu and toolbar in sync.
6. 11 Playwright E2E tests in `test_undo_redo.spec.js` covering all 7 ACs.
7. 6 new Go unit tests for `ClearRangeCommand`; 5 new handler tests. All Go tests pass.

### File List

- `controller/command.go` — added `ClearRangeCommand`
- `controller/command_test.go` — 6 new `ClearRangeCommand` tests
- `controller/app.go` — refactored `ClearRange` to push `ClearRangeCommand`
- `api/handlers.go` — added `HandleUndo`, `HandleRedo`, `undoRedoState`; extended `HandleSetCellValue` response
- `api/handlers_test.go` — 5 new handler tests
- `server/main.go` — registered `/api/undo` and `/api/redo` routes
- `electron/menu.js` — added Undo/Redo menu items; extended `updateMenuState`
- `electron/main.js` — added IPC forwarding for `menu-undo`, `menu-redo`
- `electron/preload.js` — exposed `onMenuUndo`, `onMenuRedo`
- `frontend/api-client.js` — added `Undo`, `Redo` API functions
- `frontend/app.js` — `Undo`/`Redo` imports, `applyUndoRedoState`, `performUndo`, `performRedo`, keyboard shortcuts, menu handlers, toolbar buttons, click handlers
- `playwright_tests/test_undo_redo.spec.js` — 11 E2E tests (new file)

### Change Log

- 2026-03-06: Story created
- 2026-03-06: Implemented — all 6 tasks complete, all Go tests pass, Playwright E2E tests written

