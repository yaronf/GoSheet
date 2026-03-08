# Story 16.7: Multi-Window Support

Status: done

## Story

As a user,
I want each file I open from Finder, CLI, or the Recent Files menu to open in its own window,
So that I can work with multiple spreadsheets simultaneously without one replacing the other.

## Acceptance Criteria

1. **Given** a GoSheet window is open with a file
   **When** the user double-clicks a different `.sheet` file in Finder
   **Then** a second GoSheet window opens with that file
   **And** the first window remains open and unaffected

2. **Given** a GoSheet window is open
   **When** the user opens a file via File → Open or File → Open Recent
   **Then** the file opens in a new window
   **And** the existing window remains open (no unsaved-changes prompt for the existing window)

3. **Given** GoSheet is launched from the CLI with a file path argument
   **When** a GoSheet instance is already running
   **Then** a new window opens with the specified file

4. **Given** the user closes all windows
   **When** the last window is closed
   **Then** the app quits (existing macOS behaviour preserved)

5. **Given** a new window is opened
   **When** the window initialises
   **Then** it has its own Go server child process on its own ephemeral port (per Story 16.5)
   **And** closing the window terminates that window's Go server process

## Tasks / Subtasks

- [x] Task 1: Refactor `electron/main.js` — window and server lifecycle per-window (AC: 1, 2, 4, 5)
- [x] Task 2: Fix `menu.js` — replace `mainWindow` singleton with `getTargetWindow()`, thread `onOpenFile` callback (AC: 1, 2)
- [x] Task 3: Fix IPC dialog handlers to target requesting window via `BrowserWindow.fromWebContents(event.sender)` (AC: 5)
- [x] Task 4: Per-window close handler via `attachWindowCloseHandler(win)` (AC: 4, 5)
- [x] Task 5: `open-file` event uses `app.isReady()` guard, calls `createWindow(filePath)` when ready (AC: 1, 3)
- [x] Task 6: `playwright_tests/test_multi_window.spec.js` — 5 tests, all passing (AC: 1–5)
- [x] Task 7: Single-instance lock + `second-instance` handler (AC: 1, 3)
  - [x] `app.requestSingleInstanceLock()` at top of `main.js`, skipped when `NODE_ENV === 'test'`
  - [x] If lock not obtained: `app.quit(); process.exit(0)`
  - [x] `app.on('second-instance', ...)` — extract file from argv, apply dedup check, call `createWindow(filePath)` or focus existing window
  - [x] New tests: `second-instance` opens new window for new file; dedup focuses existing window

## Dev Notes

### Architecture: Per-Window Server Registry

Replace module-level singletons with a registry:

```js
// Remove: let mainWindow; let goServer; let goServerPort = null;
// Add:
const windowRegistry = new Map(); // BrowserWindow → { goServer, goServerPort }
let isQuitting = false; // app-level, shared
```

`createWindow(filePath = null)` — async factory (inline timeout, no helper):
```js
async function createWindow(filePath = null) {
  const { goServer, portReady } = startGoServer();
  let port;
  try {
    port = await Promise.race([
      portReady,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Go server startup timeout')), 10000)
      ),
    ]);
  } catch (err) {
    dialog.showErrorBox('Server Failed to Start', err.message);
    goServer.kill();
    return null;
  }
  const win = new BrowserWindow({ width: 1200, height: 800, title: 'GoSheet', ... });
  windowRegistry.set(win, { goServer, goServerPort: port });
  attachWindowCloseHandler(win);
  win.on('closed', () => {
    const state = windowRegistry.get(win);
    if (state) { state.goServer.kill('SIGTERM'); windowRegistry.delete(win); }
    if (windowRegistry.size === 0 && process.platform !== 'darwin') app.quit();
  });
  // did-finish-load: dispatch filePath if provided, else pendingFileToOpen if set
  const serverUrl = `http://localhost:${port}${DEBUG ? '?debug=1' : ''}`;
  win.loadURL(serverUrl).catch(err => console.error('[Electron] Failed to load URL:', err));
  return win;
}
```

`startGoServer()` returns (no longer sets globals):
```js
function startGoServer() {
  let _resolve, _reject;
  const portReady = new Promise((res, rej) => { _resolve = res; _reject = rej; });
  const goServer = spawn(serverPath, spawnArgs, { cwd: serverCwd, stdio: ['ignore','pipe','pipe','pipe'] });
  goServer.stdio[3].once('data', (data) => {
    const match = data.toString().match(/PORT=(\d+)/);
    if (match) _resolve(parseInt(match[1], 10));
    else _reject(new Error(`Failed to parse port: "${data.toString().trim()}"`));
  });
  goServer.on('error', (err) => _reject(err));
  // ... stdout/stderr logging unchanged ...
  return { goServer, portReady };
}
```

### menu.js: Replace `mainWindow` with `getTargetWindow()`

`menu.js` has **73 references to `mainWindow`** — all must change. The cleanest fix:

```js
// Add to menu.js imports:
const { BrowserWindow } = require('electron');

// Replace: let mainWindow = null;
// With:
function getTargetWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}
```

Then global-replace `mainWindow` → `getTargetWindow()` in `menu.js`. This is ~5 lines of actual change (import + function def + remove the `let mainWindow = null` and the `mainWindow = window` assignment in `initializeMenu`).

For "Open Recent" items only — replace `getTargetWindow().webContents.send('menu-open-recent', filePath)` with `onOpenFile(filePath)` callback. Thread `onOpenFile` via `initializeMenu` options:
```js
// main.js:
initializeMenu(win, loadRecentFiles(), { onOpenFile: (fp) => createWindow(fp) });

// menu.js buildRecentFilesSubmenu:
click: () => options?.onOpenFile ? options.onOpenFile(filePath) : getTargetWindow()?.webContents.send('menu-open-recent', filePath)
```

### `nativeTheme` Listener — Module Level Only

```js
// OUTSIDE createWindow(), at module level:
nativeTheme.on('updated', () => {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) win.webContents.send('theme-changed', theme);
  });
});
```

If left inside `createWindow()`, 3 windows = 3 listeners = each window gets 3 theme events on each system change.

### `setupIpcHandlers()` — Called Once, Event Sender Pattern

```js
// Called ONCE in app.whenReady(). ipcMain.handle() throws on double-registration.
// All dialog handlers: use event.sender to find the requesting window.
ipcMain.handle('dialog:openFile', async (event) => {  // event already exists, was unused
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, { ... });
  ...
});
```

### Single-Instance Lock — Required for Finder/CLI Forwarding

In dev mode (and when `.sheet` file association is not registered), Finder spawns a new process on double-click instead of sending `open-file` to the running instance. `requestSingleInstanceLock` causes the new process to quit and emit `second-instance` on the running instance with the forwarded argv.

Must be skipped in `NODE_ENV=test` — Playwright launches a fresh instance per test run:

```js
if (process.env.NODE_ENV !== 'test') {
  const gotLock = app.requestSingleInstanceLock({ argv: process.argv });
  if (!gotLock) { app.quit(); process.exit(0); }
}

app.on('second-instance', (event, argv) => {
  const fp = argv.find(a => !a.startsWith('-') && (a.endsWith('.sheet') || a.endsWith('.csv')));
  if (fp && fs.existsSync(fp)) {
    const resolved = path.resolve(fp);
    for (const [win, state] of windowRegistry) {
      if (state.currentFilePath && path.resolve(state.currentFilePath) === resolved) {
        if (!win.isDestroyed()) { win.show(); win.focus(); }
        return;
      }
    }
    createWindow(fp);
  } else {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length && !wins[0].isDestroyed()) { wins[0].show(); wins[0].focus(); }
  }
});
```

### `open-file` Timing Guard

```js
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (!app.isReady()) {
    // Too early — initial createWindow() will dispatch via pendingFileToOpen
    pendingFileToOpen = filePath;
    return;
  }
  // App ready: open in a new window (spawns its own server)
  createWindow(filePath);
});
```

### `before-quit` Multi-Window Safety Net

```js
app.on('before-quit', (event) => {
  const isTestMode = process.env.NODE_ENV === 'test';
  if (!isQuitting && !isTestMode) {
    event.preventDefault();
    isQuitting = true;
    // Trigger close on focused window (unsaved-changes dialog runs per-window)
    const focused = BrowserWindow.getFocusedWindow();
    if (focused && !focused.isDestroyed()) { focused.close(); return; }
    // No focused window — close all
    BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) w.close(); });
    return;
  }
  // Kill any remaining servers (safety net — normally handled in win.on('closed'))
  windowRegistry.forEach(state => { if (state.goServer) state.goServer.kill('SIGTERM'); });
  ensureRecentFilesSaved();
  cleanupTempFiles();
});
```

### Playwright: Detect Second Window

```js
// In test_multi_window.spec.js — condition-based, no sleeps:
const secondWindow = await electronApp.waitForEvent('window');
await secondWindow.waitForLoadState('domcontentloaded');
```

`electronApp.firstWindow()` still works for all existing tests — they launch one window, `firstWindow()` returns it, no change needed in `fixtures.js`.

### Project Structure Notes

- `electron/main.js` — core refactor: `windowRegistry`, per-window `startGoServer`/`createWindow`, `attachWindowCloseHandler`, move `nativeTheme` listener, fix `before-quit`
- `electron/menu.js` — add `BrowserWindow` import, replace `let mainWindow` + 73 references with `getTargetWindow()`, thread `onOpenFile` callback for Recent Files
- `playwright_tests/test_multi_window.spec.js` — new file
- No changes to: `electron/preload.js`, `frontend/`, `server/main.go`, `api/`, `controller/`, `model/`

### References

- Story 16.7 epic description [Source: _bmad-output/planning-artifacts/epics.md#Story 16.7]
- Story 16.5 implementation: ephemeral ports, fd 3 pipe [Source: _bmad-output/implementation-artifacts/16-5-remove-fixed-port-dependency.md]
- `electron/main.js` — `startGoServer()` (line 271), `createWindow(port)` (line 358), `setupIpcHandlers()` (line 633), `app.whenReady()` (line 800), `open-file` handler (line 877), `nativeTheme.on('updated')` (line 496)
- `electron/menu.js` — `let mainWindow` (line 30), `initializeMenu()` (line 58), `buildRecentFilesSubmenu()` (line 69), `buildMenu()` (line 100) — 73 total `mainWindow` references
- `playwright_tests/fixtures.js` — `electronApp.firstWindow()` (line 47) — safe for existing tests

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Full multi-window refactor: `windowRegistry`, per-window `startGoServer`, `createWindow(filePath)`, `attachWindowCloseHandler`, `before-quit` iterates registry.
- Post-review bug fixes (packaged app):
  1. **IPC listener accumulation**: all `ipcRenderer.on(channel, callback)` calls in `preload.js` now call `ipcRenderer.removeAllListeners(channel)` first, preventing ghost handlers from accumulating across hot reloads or multiple registrations — which caused `menu-open-recent` to fire `loadFileByPath` multiple times, triggering spurious unsaved-changes dialogs.
  2. **`currentFilePath` race**: `windowRegistry.set(win, { ..., currentFilePath: filePath })` now sets the path immediately at window creation (not waiting for `did-finish-load`), closing a race where `open-file` dedup could fail if the second Finder click arrived before the first window finished loading.

### File List

- `electron/main.js` — full refactor: `windowRegistry`, `startGoServer()` returns `{goServer, portReady}`, `createWindow(filePath)` async factory, `attachWindowCloseHandler(win)`, `nativeTheme` at module level, `before-quit` iterates registry, `open-file` uses `app.isReady()` guard; bug fix: set `currentFilePath` in registry immediately at window creation
- `electron/menu.js` — added `BrowserWindow` import, replaced `let mainWindow` singleton with `getTargetWindow()`, threaded `_onOpenFile` callback for Recent Files items
- `electron/preload.js` — bug fix: all `onMenu*` / `onOpenFileError` / `onThemeChanged` registration functions now call `ipcRenderer.removeAllListeners(channel)` before `ipcRenderer.on(channel, callback)`
- `playwright_tests/test_multi_window.spec.js` — new: 7 multi-window tests (all passing)
