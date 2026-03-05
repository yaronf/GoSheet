# Story 13.10: RTL Support

**Epic:** 13 - Spreadsheet UX & Polish
**Story:** 13.10
**Estimated Effort:** 4–6 hours
**Status:** done
**Source:** epics.md, todo-2026-03-01.md

---

## Story

As a user,
I want right-to-left spreadsheet layout for RTL languages (e.g. Hebrew),
so that I can work in my language naturally.

## Acceptance Criteria

1. **Given** RTL mode is enabled (via a setting or toggle)
   **When** the grid renders
   **Then** columns flow right-to-left (column A is on the right side)

2. **Given** RTL mode is enabled
   **When** text is entered in cells
   **Then** text alignment defaults to right (RTL natural direction)

3. **Given** RTL mode is enabled
   **When** the formula bar and UI elements render
   **Then** they adapt to RTL layout (formula bar text direction is RTL, UI labels flow right-to-left)

4. **Given** RTL mode has been enabled
   **When** the app is restarted
   **Then** RTL mode preference is remembered (persisted)

5. **Given** RTL mode is enabled
   **When** the user navigates with arrow keys
   **Then** Left arrow moves to the next column to the right (RTL logical direction), Right arrow moves left

## Tasks / Subtasks

- [x] Task 1: RTL toggle setting — persist and expose (AC: 1, 4)
  - [x] `electron/settings.js` created with `getSettings()`/`setSetting()` using userData JSON
  - [x] IPC handlers added to `electron/main.js`: `get-settings`, `set-setting`
  - [x] Preload bridge added to `electron/preload.js`: `getSettings`, `setSetting`
  - [x] `frontend/api-client.js`: added `GetSettings()` and `SetSetting()` using Electron IPC

- [x] Task 2: Apply RTL to DOM (AC: 1, 2, 3)
  - [x] `let isRTL = false` global added to `frontend/app.js`
  - [x] Startup async block reads persisted setting and sets `document.documentElement.dir = 'rtl'` if true
  - [x] `frontend/spreadsheet.css`: added `[dir="rtl"]` rules for grid, cells, formula bar

- [x] Task 3: Keyboard navigation RTL fix (AC: 5)
  - [x] `handleKeydownCellNavigation` in `frontend/app.js`: ArrowLeft/Right swap direction when `isRTL`

- [x] Task 4: RTL toggle UI in toolbar (AC: 1, 4)
  - [x] Added `#rtl-toggle-btn` toolbar button with SVG icon
  - [x] Click handler: toggles `isRTL`, sets/removes `dir="rtl"`, persists via `SetSetting('rtl', isRTL)`
  - [x] `aria-pressed` attribute updated on toggle

- [x] Task 5: Playwright tests (AC: 1, 2, 3, 5)
  - [x] Created `playwright_tests/test_rtl.spec.js` — 5 tests, all pass
  - [x] Test: RTL toggle sets `dir="rtl"` on html element
  - [x] Test: toggling again removes `dir` attribute
  - [x] Test: cell computed text-align is `right` in RTL mode
  - [x] Test: formula bar `direction` is `rtl`
  - [x] Test: `aria-pressed` reflects toggle state

## Dev Notes

### Simplest RTL Implementation

The simplest approach is CSS-driven: setting `dir="rtl"` on `<html>` or the spreadsheet table makes browsers natively reverse horizontal layout including table column order. This is a well-supported CSS/HTML mechanism.

```css
/* When dir="rtl" is set on html element */
[dir="rtl"] #spreadsheet {
  direction: rtl;
}
[dir="rtl"] .cell {
  text-align: right; /* Default text direction for RTL */
}
[dir="rtl"] #formula-bar {
  direction: rtl;
  text-align: right;
}
```

This means column A appears on the right side — columns flow right-to-left — without any JavaScript column reordering.

### Setting Persistence

**Option A: Electron store via IPC** (recommended)
- `electron/settings.js` with `electron-store` (already in use if other settings are persisted) or `app.getPath('userData')` JSON file
- IPC: `ipcMain.handle('get-settings', ...)` and `ipcMain.handle('set-setting', ...)`
- `electronAPI.getSettings()` and `electronAPI.setSetting(key, value)` in preload

**Option B: Backend Go setting** — Not recommended (RTL is a pure UI preference, not spreadsheet data)

**Option C: `localStorage`** — Simple but doesn't survive Electron restarts reliably. Use Option A.

Check `electron/main.js` and `electron/preload.js` for existing IPC patterns. RTL setting should use the same `ipcMain.handle` + `contextBridge` pattern.

### Arrow Key Navigation

Find arrow key handler in `app.js` — look for `case 'ArrowLeft'` and `case 'ArrowRight'` in the keyboard event handler. When `isRTL`:
- `ArrowLeft` → `getNextCell(row, col, 'right')` (RTL: visual left = logical right)
- `ArrowRight` → `getNextCell(row, col, 'left')` (RTL: visual right = logical left)

### Column Header Visual Order

When `dir="rtl"` is set on the table, browsers render `<td>` elements right-to-left. Column A (`col=0`) will appear on the right. No JavaScript needed for this — it's pure HTML/CSS behavior.

### Formula Bar

`#formula-bar` is an `<input>` element. Setting `direction: rtl` on it makes text cursor start from the right and renders RTL text naturally.

### Electron Settings Pattern

Check if `electron/settings.js` already exists:
```
find /Users/ysheffer/misc/spreadsheet/electron -name "*.js"
```
If no settings module exists, create a minimal one:
```javascript
// electron/settings.js
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function getSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch { return {}; }
}

function setSetting(key, value) {
  const settings = getSettings();
  settings[key] = value;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

module.exports = { getSettings, setSetting };
```

### Preload IPC (existing pattern from electron/preload.js)

Follow the existing `contextBridge.exposeInMainWorld('electronAPI', { ... })` pattern to add:
- `getSettings: () => ipcRenderer.invoke('get-settings')`
- `setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value)`

### Testing Standards (Actual Practice)

- **Playwright tests**: `playwright_tests/test_rtl.spec.js`
- Use `window.evaluate()` to check `document.documentElement.dir` and `getComputedStyle`
- Toggle RTL via the UI button/menu or directly via API: `window.electronAPI.setSetting('rtl', true)` + reload
- `test.beforeEach` with `ensureSpreadsheetView(window)`, `test.afterEach` reset RTL to false
- ~164+ tests currently passing — all must remain green (RTL toggle must default to false / LTR)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.10]
- [Source: electron/preload.js] — IPC bridge pattern for `contextBridge.exposeInMainWorld`
- [Source: electron/main.js] — `ipcMain.handle` pattern for new IPC handlers
- [Source: frontend/app.js] — arrow key handler, startup init, `isRTL` global flag location
- [Source: frontend/spreadsheet.css] — where to add `[dir="rtl"]` CSS rules
- [Source: frontend/index.html] — `<html>` element where `dir="rtl"` is set
- [Source: _bmad-output/implementation-artifacts/13-8-alignment-left-right-center.md] — alignment story (RTL default alignment ties in)
- [Source: _bmad-output/implementation-artifacts/13-7-quote-prefix-for-text.md] — previous story patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- CSS-driven RTL: `[dir="rtl"]` on `<html>` flips table column order natively; no JS column reordering needed
- Settings persisted via `electron/settings.js` JSON file in `app.getPath('userData')`
- `afterEach` in tests uses DOM class check (not IPC) to avoid hanging inside `evaluate()`
- Arrow key swap: `isRTL ? 'right' : 'left'` for ArrowLeft and vice versa

### File List

- `electron/settings.js` — New: `getSettings()`/`setSetting()` JSON persistence
- `electron/main.js` — Added `require('./settings')`, `get-settings`/`set-setting` IPC handlers
- `electron/preload.js` — Added `getSettings`/`setSetting` to contextBridge
- `frontend/api-client.js` — Added `GetSettings`/`SetSetting`, exported both
- `frontend/app.js` — `isRTL` global, startup settings load, RTL toggle button, arrow key fix, `GetSettings`/`SetSetting` imports
- `frontend/spreadsheet.css` — Added `[dir="rtl"]` CSS rules
- `playwright_tests/test_rtl.spec.js` — New: 5 E2E tests

