# Story 16.5: Remove Fixed Port Dependency

Status: done

## Story

As a developer,
I want the Go server to bind to an OS-assigned ephemeral TCP port instead of a hardcoded port 3000,
So that multiple GoSheet instances can run simultaneously without port conflicts, and external clients can discover the actual port without guessing.

## Acceptance Criteria

1. **Given** the app is launched normally
   **When** the Go server starts
   **Then** it binds to an OS-assigned ephemeral TCP port (not 3000)
   **And** the Electron main process receives the actual bound port (via a dedicated fd 3 pipe) and passes it to the renderer via `loadURL`

2. **Given** two GoSheet instances are launched at the same time
   **When** both are running
   **Then** each uses a different port with no conflict

3. **Given** the existing Playwright test suite
   **When** tests run
   **Then** all tests pass with no changes to test logic (tests discover the port automatically through the Electron renderer's origin)

4. **Given** the single-instance lock (`app.requestSingleInstanceLock`) in `electron/main.js`
   **When** removed
   **Then** multiple app instances launch independently without focusing each other

## Tasks / Subtasks

- [x] Task 1: Go server — bind to ephemeral port and announce it via fd 3 (AC: 1, 2)
  - [x] In `server/main.go`: replace `flag.String("port", "3000", ...)` + `http.ListenAndServe` with `net.Listen("tcp", ":0")` + `http.Serve`
  - [x] Extract the bound port from `listener.Addr()` and write `PORT=<n>\n` to fd 3 (the dedicated port pipe), then close it
  - [x] Keep `--verbose` flag; remove `--port` flag
  - [x] Update the startup log line (stderr/log) to use the actual bound port

- [x] Task 2: Electron main process — read port from fd 3 and pass to renderer (AC: 1)
  - [x] In `electron/main.js`: remove `const GO_SERVER_PORT = 3000` constant
  - [x] Add `let goServerPort = null` and `let goServerPortReady` (a Promise that resolves when the port is known)
  - [x] In `spawn()`: change `stdio` to `['ignore', 'pipe', 'pipe', 'pipe']` to open fd 3
  - [x] Add a `goServer.stdio[3].once('data', ...)` handler: parse `PORT=<n>`, set `goServerPort`, resolve `goServerPortReady`
  - [x] In `createWindow()` (called after `startGoServer()`): await `goServerPortReady` before calling `mainWindow.webContents.loadURL(...)`
  - [x] Update `serverUrl` construction: `http://localhost:${port}${DEBUG ? '?debug=1' : ''}`
  - [x] Remove `spawnArgs` `--port` argument

- [x] Task 3: Remove single-instance lock (AC: 4)
  - [x] In `electron/main.js`: remove `const gotTheLock = app.requestSingleInstanceLock()` block
  - [x] Remove `app.on('second-instance', ...)` handler
  - [x] Comment in code: the single-instance lock existed solely to prevent port conflicts; now unnecessary with per-instance ephemeral ports

- [x] Task 4: Sequencing — ensure window creation waits for server ready (AC: 1, 3)
  - [x] Replaced `setTimeout(() => createWindow(), 1000)` with `Promise.race([goServerPortReady, 10s timeout])` → `createWindow(port)`
  - [x] Added user-visible error dialog if server fails to start within 10s
  - [x] `app.on('activate', ...)` uses `goServerPort` (already resolved) directly

- [x] Task 5: Update tests if needed (AC: 3)
  - [x] All `3000` references in playwright_tests/ are timeout values in ms, not port numbers — no changes needed
  - [x] 254/255 tests pass; 1 pre-existing failure in `test_open_from_cli.spec.js` confirmed broken on `main` before this story

- [x] Task 6: Cleanup and documentation
  - [x] Removed `--port 3000` from Makefile `run` target
  - [x] Updated `_bmad-output/planning-artifacts/architecture.md` pseudocode and narrative to reflect ephemeral port + fd 3 approach
  - [x] `log.SetOutput` changed from `os.Stdout` to `os.Stderr` in `server/main.go` (stdout stays clean)

## Dev Notes

### Approach: Ephemeral TCP port (not Unix socket)

For this stack, **ephemeral TCP port** is the correct implementation:

- Go's `net/http` and `net.Listen` natively support TCP `:0` (OS-assigned port)
- The Electron renderer uses `fetch` with relative URLs (`API_BASE = ''` in `api-client.js`) — it automatically uses the same origin as the loaded page, so passing the correct port via `loadURL` is the only change needed in the frontend
- Unix domain sockets require a custom protocol handler in Electron or a proxy layer to bridge `fetch` — significantly more complex with no benefit on macOS
- Ephemeral TCP ports work cross-platform if Windows support is ever added

### IPC mechanism: fd 3 pipe (not stdout parsing)

Port announcement uses a **dedicated stdio pipe on fd 3**, not stdout. This is the correct approach for structured parent↔child IPC:

- Stdout and stderr remain purely for human-readable logs — accidental `fmt.Println` or `log.Print` can never corrupt the port signal
- No log discipline required from future contributors
- One-shot: Go writes `PORT=<n>\n` to fd 3 and closes it; Electron reads it exactly once
- This is the same mechanism Node.js uses internally for `child_process.fork()` IPC
- Electron's `spawn` natively supports extra stdio fds: `stdio: ['ignore', 'pipe', 'pipe', 'pipe']`

### Key implementation pattern (server/main.go)

```go
// Replace:
//   port := flag.String("port", "3000", "Port to run the server on")
//   http.ListenAndServe(":"+*port, nil)

// With:
listener, err := net.Listen("tcp", ":0")
if err != nil {
    log.Fatalf("Failed to bind port: %v", err)
}
port := listener.Addr().(*net.TCPAddr).Port

// Announce port to Electron via dedicated fd 3 pipe (not stdout)
portPipe := os.NewFile(3, "port-pipe")
fmt.Fprintf(portPipe, "PORT=%d\n", port)
portPipe.Close()

log.Printf("GoSheet server running at http://localhost:%d\n", port)
http.Serve(listener, nil)
```

Import `net`, `fmt`, and `os` in addition to existing imports.

### Key implementation pattern (electron/main.js)

```js
// Remove:
// const GO_SERVER_PORT = 3000;

// Add:
let goServerPort = null;
let _resolvePort;
const goServerPortReady = new Promise(resolve => { _resolvePort = resolve; });

// In spawn() call — add fd 3:
goServer = spawn(serverPath, spawnArgs, {
  cwd: serverCwd,
  stdio: ['ignore', 'pipe', 'pipe', 'pipe'],  // fd 3 = dedicated port channel
});

// Read port from fd 3 (once, then it closes):
goServer.stdio[3].once('data', (data) => {
  const match = data.toString().match(/PORT=(\d+)/);
  if (match) {
    goServerPort = parseInt(match[1], 10);
    _resolvePort(goServerPort);
  }
});

// In app.whenReady() / createWindow flow:
async function initApp() {
  startGoServer();
  // Timeout guard: fail fast if server doesn't announce port within 10s
  const port = await Promise.race([
    goServerPortReady,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Go server timeout')), 10000)),
  ]);
  createWindow(port);
}
```

Pass `port` as a parameter to `createWindow(port)` rather than reading a global.

### Sequencing concern

Currently in `electron/main.js`, `app.whenReady()` likely calls both `startGoServer()` and `createWindow()` synchronously. After this change, `createWindow` must only be called after `goServerPortReady` resolves. Verify the startup flow at lines ~340–420.

Also check: `createWindow()` is called again in the dock-click path (`app.on('activate', ...)`) — this must also await port-ready, but since the server is already running at that point, the port is already known and `goServerPortReady` resolves immediately.

### Single-instance lock removal

The comment at `main.js:18–19` says: "Story 7.6: Single instance lock - when user 'Keeps in Dock' and clicks, macOS may launch raw Electron (no app path) which shows the default splash. We quit that instance and focus ours." This behavior was an incidental benefit. With ephemeral ports, the port conflict reason is gone. The dock splash case should be verified after removal — the fix may no longer be needed since GoSheet is now a proper `.app` bundle.

### Playwright tests

Playwright tests use `playwright._electron.launch()` → `electronApp.firstWindow()` → the window's `fetch` calls use relative URLs against the loaded page origin. Since the loaded URL will be `http://localhost:<ephemeral-port>`, fetch calls automatically go to the correct backend. **No test changes expected.**

However, check `playwright_tests/test_open_from_cli.spec.js` — it has a `saveSheetToFile` helper that calls `/api/file/save` via `window.evaluate(fetch(...))`. This uses `fetch('/api/file/save', ...)` with a relative path, so it works automatically.

Check for any hardcoded `localhost:3000` in test files:
```bash
grep -r "3000\|localhost" playwright_tests/
```

### Project Structure Notes

- `server/main.go` — replace `ListenAndServe` with `Listen`+`Serve`, write `PORT=<n>` to fd 3
- `electron/main.js` — remove `GO_SERVER_PORT`, add `stdio[3]` port reader, add port promise, await before `loadURL`; remove single-instance lock
- No changes to `frontend/api-client.js`, `frontend/app.js`, or any Go model/controller/api files
- No changes to `electron/preload.js`, `electron/menu.js`, or `playwright_tests/`

### References

- Epics file: Story 16.5 description and implementation note [Source: _bmad-output/planning-artifacts/epics.md#Story 16.5]
- Port usage: `electron/main.js:229` (`GO_SERVER_PORT = 3000`), `main.js:313` (`spawnArgs`), `main.js:362` (`serverUrl`)
- Server listen: `server/main.go:27,93` (`--port` flag, `ListenAndServe`)
- Single-instance lock: `electron/main.js:20–30`
- API base URL: `frontend/api-client.js:21` (`API_BASE = ''`) — no change needed
- Architecture doc port reference: `_bmad-output/planning-artifacts/architecture.md` line containing `['--port', '3000']`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `server/main.go`: removed `--port` flag, replaced `http.ListenAndServe` with `net.Listen(":0")` + `http.Serve`; writes `PORT=<n>\n` to fd 3 then closes it; `log.SetOutput` moved to `os.Stderr`
- `electron/main.js`: removed `GO_SERVER_PORT` constant and single-instance lock; added `goServerPortReady` promise resolved from fd 3 data; `spawn` now uses `stdio: ['ignore','pipe','pipe','pipe']`; replaced `setTimeout` hack with `Promise.race` + 10s timeout + error dialog; `createWindow(port)` receives port as parameter
- `Makefile`: updated `run` target — removed hardcoded `--port 3000`
- `architecture.md`: updated pseudocode and narrative to reflect ephemeral port + fd 3 IPC
- Pre-existing test failure: `test_open_from_cli.spec.js:222` ("shows welcome screen when open-file-error IPC fires") was failing on `main` before this story (timeout); root cause was `showWelcome()` called before `showAlert()` — fixed by reordering in `frontend/app.js`
- CR findings fixed: `_rejectPort` added to port promise; `goServer.on('error')` rejects promise; dock menu `createWindow()` calls now pass `goServerPort`; `app.on('activate')` guards against null port; `loadURL()` sleep-retry removed; `fmt.Fprintf` fd 3 error checked in `server/main.go`

### File List

- server/main.go
- electron/main.js
- frontend/app.js
- Makefile
- playwright_tests/test_open_from_cli.spec.js
- playwright_tests/test_readonly.spec.js
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/implementation-artifacts/16-5-remove-fixed-port-dependency.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
