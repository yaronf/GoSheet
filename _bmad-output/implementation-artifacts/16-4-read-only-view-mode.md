# Story 16.4: Read-Only / View Mode

Status: done

## Story

As a user,
I want to open a file in read-only mode,
So that I can view its contents without risk of accidentally modifying it.

## Acceptance Criteria

1. **Given** a user opens a file in read-only mode (via an "Open Read-Only..." option in the File menu)
   **When** the file loads
   **Then** all cell editing is disabled (typing, paste, delete, styling have no effect)
   **And** a visible "Read-Only" indicator is shown in the UI (in the status bar)

2. **Given** the app is in read-only mode
   **When** the user attempts to trigger Save (Cmd+S)
   **Then** no save occurs
   **And** an alert explains the file is read-only

3. **Given** the app is in read-only mode
   **When** the user selects cells or navigates with keyboard/mouse
   **Then** navigation and selection work normally

4. **Given** a file is opened in read-only mode
   **When** the user chooses "Save As" (Cmd+Shift+S)
   **Then** Save As is permitted (creates a new writable copy)
   **And** the new file opens in normal (editable) mode

## Tasks / Subtasks

- [x] Task 1: Add `isReadOnly` state flag and `setReadOnly()` helper (AC: 1, 2, 3, 4)
  - [x] Add `let isReadOnly = false;` near line 49 in `frontend/app.js` (alongside `isEditing`)
  - [x] Add `function setReadOnly(value)` that: sets `isReadOnly`, shows/hides `#readonly-indicator`, disables Save button, calls `window.electronAPI.updateMenuState({ isReadOnly: value })`
  - [x] Expose `window.__testSetReadOnly = setReadOnly;` for Playwright tests (near other `window.*` test hooks)

- [x] Task 2: Add "Open Read-Only..." menu entry and IPC (AC: 1)
  - [x] Add menu item in `electron/menu.js` File submenu after "Open...": id `open-readonly`, label `Open Read-Only...`, accelerator `CmdOrCtrl+Shift+O`, sends `menu-open-readonly`
  - [x] Expose `onMenuOpenReadOnly` in `electron/preload.js` (same pattern as `onMenuOpenCSV`)
  - [x] Add `openFileReadOnly()` function in `frontend/app.js`: check unsaved changes, call `openFileDialog()`, call `loadFileByPath(path)`, then `setReadOnly(true)`
  - [x] Register `onMenuOpenReadOnly` listener in `frontend/app.js` alongside `onMenuOpen` (~line 3043)
  - **Note:** Finder "Open With" and CLI file opens always open in normal (editable) mode — they fire `open-file` / `menu-open-recent` which goes through `loadFileByPath`, which calls `setReadOnly(false)`. Read-only is only accessible via the explicit "Open Read-Only..." menu item.

- [x] Task 3: Add `#readonly-indicator` to toolbar HTML (AC: 1)
  - [x] Add `<span id="readonly-indicator">🔒 Read-Only</span>` near `#file-status` in inline HTML (`app.js:322`)
  - [x] Style: `display:none` by default, `color: var(--color-warning)`, `font-weight: bold`, `margin-left: 8px`

- [x] Task 4: Block editing operations when read-only (AC: 1)
  - [x] `startEditing()` (`app.js:1460`): add `if (isReadOnly) return;` at top
  - [x] Keydown handler that calls `startEditingWithChar` (~`app.js:1910`): guard with `if (isReadOnly) return;`
  - [x] Delete/Backspace keydown handler (~`app.js:1889`): guard with `if (isReadOnly) return;`
  - [x] Paste handler: guard with `if (isReadOnly) return;`
  - [x] Context menu `handleContextMenuAction`: add `if (isReadOnly && !['copy', 'select-all'].includes(action)) { showAlert(...); return; }` at top — this blocks styling, clear, insert/delete, alignment, etc.
  - [x] `applyStyleToSelection` (~`app.js:3278`): add `if (isReadOnly) return;` at top — blocks Format menu style application

- [x] Task 5: Block Save, allow Save As (AC: 2, 4)
  - [x] `onMenuSave` handler extracted to `handleMenuSave`, exposed as `window.__testMenuSave`; guard: `if (isReadOnly) { showAlert(...); return; }`
  - [x] `save-btn` click handler: add `if (isReadOnly) return;` guard
  - [x] `electron/menu.js` `updateMenuState`: update Save `enabled` to `menuState.hasUnsavedChanges && !menuState.isReadOnly`; add `isReadOnly: false` to initial `menuState`

- [x] Task 6: Exit read-only on Save As and on any new file open (AC: 4)
  - [x] In `onMenuSaveAs` after successful `SaveFile(...)`: call `setReadOnly(false)`
  - [x] In `loadFileByPath` at start of try block: call `setReadOnly(false)` (covers normal open, open recent, CLI/Finder open)
  - [x] In `handleImportCSVByPath` after `showSpreadsheet()`: call `setReadOnly(false)`
  - [x] In new spreadsheet handler: call `setReadOnly(false)`

- [x] Task 7: Playwright test coverage (AC: 1, 2, 3, 4)
  - [x] New file `playwright_tests/test_readonly.spec.js`
  - [x] Test: set read-only via `window.__testSetReadOnly(true)` — verify `#readonly-indicator` visible, typing into a cell has no effect
  - [x] Test: menu save handler blocked in read-only — alert shown, `#modal-ok` clicked (save-btn disabled tested separately)
  - [x] Test: cell navigation works in read-only (arrow keys, click-to-select)
  - [x] Test: `setReadOnly(false)` — verify indicator hidden, editing re-enabled
  - **Note:** `openFileReadOnly()` full IPC flow not tested (requires dialog stub); AC 4 (Save As exits read-only) covered by `setReadOnly(false)` unit-level test

## Dev Notes

### Architecture: Frontend-Only (for now)

Read-only is **a frontend concern in this story** — no backend API changes. The Go server has no concept of read-only; the frontend simply blocks mutation calls.

**Known limitation:** When Epic 19 (Agentic API Access) adds direct HTTP API access for agents, the backend will also need to enforce read-only mode — an agent bypassing the frontend would be able to mutate cells regardless of the frontend flag. That enforcement is deferred to Epic 19. For this story, frontend-only is sufficient for the interactive user use case.

### isReadOnly Flag

Add near `isEditing` at `app.js:49`:
```js
let isEditing = false;
let isReadOnly = false; // Story 16.4
```

### setReadOnly Helper

```js
function setReadOnly(value) {
  isReadOnly = value;
  const indicator = document.getElementById('readonly-indicator');
  if (indicator) indicator.style.display = value ? 'inline' : 'none';
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) saveBtn.disabled = value || !window.currentHasUnsavedChanges;
  if (window.electronAPI?.updateMenuState) {
    window.electronAPI.updateMenuState({ isReadOnly: value });
  }
}
```

### openFileReadOnly Function

```js
async function openFileReadOnly() {
  const status = await GetFileStatus();
  if (status.hasUnsavedChanges) {
    const confirmed = await showConfirmDialog(
      'You have unsaved changes! Open read-only file anyway? All unsaved changes will be lost.'
    );
    if (!confirmed) return;
  }
  const filePath = await window.electronAPI.openFileDialog();
  if (!filePath) return;
  await loadFileByPath(filePath);
  setReadOnly(true);
}
```

Note: `loadFileByPath` internally calls `setReadOnly(false)` (Task 6), so `setReadOnly(true)` here runs after and correctly overrides it.

### menu.js Changes

Add to File submenu after the `open` item (~line 207):
```js
{ type: 'separator' },
{
  id: 'open-readonly',
  label: 'Open Read-Only...',
  accelerator: 'CmdOrCtrl+Shift+O',
  click: () => {
    if (mainWindow) mainWindow.webContents.send('menu-open-readonly');
  },
},
```

Update `menuState` initial value to include `isReadOnly: false`.

Update Save enabled logic in `updateMenuState`:
```js
saveItem.enabled = menuState.hasUnsavedChanges && !menuState.isReadOnly;
```

### preload.js Pattern

Follow the same pattern as `onMenuOpenCSV` (added in Story 16.3):
```js
onMenuOpenReadOnly: (callback) => {
  ipcRenderer.on('menu-open-readonly', callback);
},
```

### Readonly Indicator HTML

The status bar HTML is in `app.js` around line 322:
```html
<div class="file-status-wrapper" ...>
  <span id="file-status" class="file-status"></span>
  <span id="readonly-indicator" style="display:none; color: var(--color-warning); font-weight: bold; margin-left: 8px;">🔒 Read-Only</span>
</div>
```

### Blocking Keydown Events

The keydown handler is around `app.js:670–730`. The relevant branches:
- Typing characters → calls `startEditingWithChar` or `startEditing`
- Delete/Backspace → calls `ClearCell` or similar

Since `startEditing` is guarded, typing will be blocked. Also guard the direct `ClearCell` / bulk-delete path explicitly.

### Context Menu

`handleContextMenuAction` is around `app.js:880`. Only `copy` (and possibly `select-all`) should work in read-only. All others (clear, style, insert, delete) should be blocked:
```js
async function handleContextMenuAction(action, ...) {
  if (isReadOnly && !['copy', 'select-all'].includes(action)) {
    await showAlert('File is read-only. Cannot modify cells.');
    return;
  }
  ...
}
```

### Test Pattern

Use `window.__testSetReadOnly` hook (exposed alongside `window.displayFileStatus` etc. at `app.js:2229`):
```js
// In test:
await testWindow.evaluate(() => window.__testSetReadOnly(true));
await expect(testWindow.locator('#readonly-indicator')).toBeVisible();

// Try to type in a cell — should have no effect
await testWindow.locator('#cell-0-0').click();
await testWindow.keyboard.type('X');
await expect(testWindow.locator('#cell-0-0')).not.toHaveText('X');
```

For Save blocked test: trigger `save-btn` click, check for modal alert, dismiss, verify file status unchanged.

### Previous Story Intelligence (16.3)

- `applyUndoRedoState` now calls `displayFileStatus` internally — don't double-call
- `loadFileByPath` now calls `showWelcome()` on error and `showSpreadsheet()` only on success — place `setReadOnly(false)` at the start of the try block, before `LoadFile`, so it resets regardless of success/failure
- Test hooks pattern: `window.__testOpenFileError` was added in 16.3 — use same `window.__testSetReadOnly` pattern
- All IPC `on*` listeners in `preload.js` use `ipcRenderer.on(channel, (event, ...args) => callback(...args))` — match that

### Key Files

| File | Change |
|------|--------|
| `electron/menu.js` | Add "Open Read-Only..." menu item; add `isReadOnly` to `menuState`; update Save enabled logic |
| `electron/preload.js` | Expose `onMenuOpenReadOnly` |
| `frontend/app.js` | Add `isReadOnly` flag, `setReadOnly()`, `openFileReadOnly()`; `#readonly-indicator` HTML; guards in `startEditing`, keydown, context menu, save handlers; reset in load/import/new paths |
| `playwright_tests/test_readonly.spec.js` | New test file |

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

1. `onMenuSave` callback extracted to named `handleMenuSave` and exposed as `window.__testMenuSave` — enables testing the read-only alert path without needing Electron menu IPC in tests.
2. All 8 Playwright tests pass.
3. Architecture note: `loadFileByPath` calls `setReadOnly(false)` before `LoadFile`, so normal opens always exit read-only regardless of success/failure. `openFileReadOnly()` calls `setReadOnly(true)` after `loadFileByPath` to override.
4. CR fixes: Undo/Redo keyboard shortcuts and menu IPC handlers now guarded with `isReadOnly`; Insert/Delete row/column menu IPC handlers similarly guarded; `onMenuOpenReadOnly` preload pattern corrected to `(_event) => callback()`.

### File List

- `frontend/app.js`
- `electron/menu.js`
- `electron/preload.js`
- `playwright_tests/test_readonly.spec.js`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
