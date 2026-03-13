# Story 21.3: Logging Cleanup

Status: done

## Story

As a developer running GoSheet,
I want `npm start` (no flags) to produce only WARN/ERROR output,
so that real problems are easy to spot without wading through routine startup noise.

## Acceptance Criteria

1. **Given** the app is started with `npm start` (no `--verbose`)
   **When** the Go server starts
   **Then** the two startup `log.Printf` messages (`"GoSheet server running..."` and the port-write warning) are suppressed at INFO level — they should only appear with `--verbose`

2. **Given** the app is started with `npm start` (no `--verbose`)
   **When** Electron main process initializes
   **Then** unconditional `console.log` calls in `main.js` that are routine startup noise (not errors) are suppressed — either moved behind `if (DEBUG)` or removed if redundant

3. **Given** the app is started with any mode
   **When** the Electron renderer initializes
   **Then** the CSP security warning is silenced by adding a Content-Security-Policy `<meta>` tag to `frontend/index.html`

4. **Given** `--verbose` is passed
   **When** the app starts
   **Then** all previously suppressed INFO/DEBUG messages still appear (no regression)

5. **Given** WARN and ERROR level messages
   **When** the app runs in any mode
   **Then** they still appear unconditionally (no regression)

## Tasks / Subtasks

- [ ] Task 1: Suppress Go server startup INFO logs behind `--verbose` (AC: 1, 4)
  - [ ] In `server/main.go`: change `log.Printf("GoSheet server running at ...")` → `logutil.Debugf("GoSheet server running at ...")`
  - [ ] Change `log.Printf("Warning: failed to write port to fd 3: ...")` → `logutil.Warnf(...)` (it's a warning, keep unconditional but use WARN level)
  - [ ] In `api/handlers.go`: change `log.Println("Warning: Could not find frontend directory...")` → `logutil.Warnf(...)`

- [ ] Task 2: Gate noisy Electron console.log calls behind DEBUG (AC: 2, 4)
  - [ ] In `electron/main.js`: audit all unconditional `console.log` calls (not already behind `if (DEBUG)`) and move routine ones behind `if (DEBUG)`:
    - Line ~101: `console.log('[Electron] loadRecentFiles: ...')` → already conditional? confirm
    - Line ~109: `console.log('[Electron] loadRecentFiles: no JSON at ...')` → `if (DEBUG)`
    - Line ~143: `console.log(...)` → check if routine startup
    - Line ~160: `console.log(...)` → check if routine startup
    - Line ~256: `console.log(...)` → check if routine startup
    - Line ~316: `console.log('[Electron] Starting Go HTTP server...')` → `if (DEBUG)`
    - Line ~327-328: server path/mode logs → `if (DEBUG)` (already should be)
    - Line ~401: `console.log('[Electron] Go server exited with code ...')` → keep as WARN if non-zero exit, DEBUG if zero
    - Line ~404: `console.log('[Electron] Go server started with PID: ...')` → `if (DEBUG)`
    - Line ~529: `console.log('[Electron] Window ready, opening file: ...')` → `if (DEBUG)`
    - Line ~550: `console.log('[Electron] Sending initial theme ...')` → `if (DEBUG)`
  - [ ] Keep `console.error` and `console.warn` calls unconditional

- [ ] Task 3: Add CSP meta tag to suppress Electron security warning (AC: 3)
  - [ ] In `frontend/index.html`: add `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src http://localhost:* ws://localhost:*">` in the `<head>` section
  - [ ] Verify the app still loads correctly (frontend fetches from `http://localhost:<port>` — must be allowed by CSP)
  - [ ] Verify no inline scripts are blocked (GoSheet uses `type="module"` imports, no inline `<script>` bodies)

- [ ] Task 4: Verify no regression (AC: 4, 5)
  - [ ] Run `npx playwright test test_clear_formatting.spec.js` (or any targeted test) to confirm app still works
  - [ ] Manually start with `--verbose` and confirm DEBUG/INFO messages appear

## Dev Notes

### Current Logging Architecture (Story 16.8)

**Three layers, three sources:**
- `[go]` source: Go server via `logutil` package
- `[Electron]` source: `electron/main.js` via wrapped `console.*`
- `[Renderer]` source: renderer process forwarded via `win.webContents.on('console-message')`

**Level routing:**
- `logutil.Debugf/Debugln` → `[DEBUG]`, gated by `logutil.Verbose` (set from `--verbose`)
- `log.Printf` → `[INFO ]` unconditionally via `GoWriter` wrapper
- `logutil.Warnf` → `[WARN ]` unconditionally
- `logutil.Errorf` → `[ERROR]` unconditionally
- Renderer `console.log` → `[INFO ]` via `console-message`, gated by `DEBUG` in main.js
- Renderer `console.error/warn` → forwarded unconditionally

**Goal:** After this story, `npm start` produces ZERO output except genuine warnings/errors.

### Go Changes

`server/main.go` currently has:
```go
log.Printf("Warning: failed to write port to fd 3: %v (running standalone?)", err)
log.Printf("GoSheet server running at http://localhost:%d\n", port)
```

Change to:
```go
logutil.Warnf("failed to write port to fd 3: %v (running standalone?)", err)
logutil.Debugf("GoSheet server running at http://localhost:%d\n", port)
```

`api/handlers.go` has:
```go
log.Println("Warning: Could not find frontend directory, using ../frontend")
```
Change to:
```go
logutil.Warnf("Could not find frontend directory, using ../frontend")
```

### CSP Policy for GoSheet

GoSheet's frontend:
- Loads from `file://` (Electron) or `http://localhost:<port>`
- Fetches API from `http://localhost:<port>`
- Uses ES modules (`type="module"`) — no inline scripts
- Uses inline CSS via style attributes (needs `unsafe-inline` for styles)
- No external CDN resources

Recommended CSP:
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
connect-src http://localhost:* ws://localhost:*;
img-src 'self' data:;
```

**Important**: The `connect-src` must allow `http://localhost:*` because the port is ephemeral (Story 16.5).

### Electron console.log Audit

Read `electron/main.js` fully and categorize each unconditional `console.log` as:
- **Keep as WARN**: unexpected conditions (server exit with non-zero code)
- **Move to DEBUG**: routine startup, lifecycle, file paths
- **Keep unconditional**: `console.error` and `console.warn` are already correct

### Files to Touch
- `server/main.go` — 2 `log.Printf` → `logutil.Debugf`/`logutil.Warnf`
- `api/handlers.go` — 1 `log.Println` → `logutil.Warnf`
- `electron/main.js` — gate ~8-10 unconditional `console.log` calls behind `if (DEBUG)`
- `frontend/index.html` — add CSP `<meta>` tag

### Testing Notes
- Build binary after Go changes: `go build -o bin/gosheet-server ./server`
- No new Playwright tests needed — this is pure logging behavior, not user-visible functionality
- Manual verification: `npm start` → should see zero INFO output
- Manual verification: `npm start -- --verbose` → should see DEBUG+INFO output

### References
- [Source: logutil/logutil.go] Full logging package — Verbose, Debugf, Warnf, Errorf, GoWriter
- [Source: server/main.go#~36-122] verbose flag, GoWriter setup, startup log.Printf calls
- [Source: electron/main.js#~13-76] DEBUG flag, console.* wrapping
- [Source: electron/main.js#~505-513] Renderer console-message forwarding (already correct)
- [Source: api/handlers.go#~65] log.Println warning

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Go: `log.Printf("GoSheet server running...")` → `logutil.Debugf` (suppressed without --verbose)
- Go: `log.Printf("Warning: failed to write port...")` → `logutil.Warnf` (keeps unconditional WARN)
- Go: `log.Println("Warning: Could not find frontend directory...")` → `logutil.Warnf` in handlers.go
- Go: removed unused `"log"` import from `api/handlers.go`
- Electron: `startGoServer` startup message → `if (DEBUG)`
- Electron: Go server PID log → `if (DEBUG)`
- Electron: Go server exit log → `console.error` on non-zero, `if (DEBUG)` on zero exit
- CSP: added meta tag to `frontend/index.html` — allows CDN (Pico.css), localhost connect, unsafe-inline for existing inline script

### File List

- server/main.go — 2 log.Printf → logutil.Debugf / logutil.Warnf
- api/handlers.go — log.Println → logutil.Warnf; removed "log" import
- electron/main.js — 3 unconditional console.log → if (DEBUG) or console.error
- frontend/index.html — added CSP meta tag
