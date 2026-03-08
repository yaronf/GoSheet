# Story 16.8: Unified Logging (BE + FE + Main Process)

Status: done

## Story

As a developer,
I want all log output — Go server, Electron main process, and renderer — to share a consistent format and destination,
So that I can diagnose issues across the full stack from a single log stream.

## Acceptance Criteria

1. **Given** the app is launched with `--verbose`
   **When** any of the three layers (Go server, Electron main, renderer) emits a log
   **Then** all lines share the format: `[ISO-timestamp] [LEVEL] [SOURCE] message`
   **And** all lines appear in the terminal and, if `--log-file=<path>` is set, in the log file

2. **Given** the app is launched without `--verbose`
   **When** a renderer `console.error` or `console.warn` fires
   **Then** it is still forwarded to the main process log (errors/warnings always visible; debug/info gated behind `--verbose`)

3. **Given** `--log-file=<path>` is provided
   **When** the app runs
   **Then** all log output (main process + forwarded Go server + forwarded renderer) is appended to the file with timestamps
   **And** existing `--log-file` behaviour is preserved (append mode, ISO prefix on every line)

4. **Given** Go server output arrives via stdout/stderr pipes in `startGoServer()`
   **When** the Go server emits a log line
   **Then** main.js prefixes it as `[SOURCE:go-server]` (already `[Go Server]` — normalize to match unified format)

5. **Given** the renderer emits a `console-message` event
   **When** `_level` is 2 (warning) or 3 (error)
   **Then** the message is forwarded unconditionally (not gated by DEBUG)
   **When** `_level` is 0 (verbose) or 1 (info)
   **Then** the message is forwarded only when `DEBUG` is true

## Tasks / Subtasks

- [x] Task 1: Normalize `[SOURCE]` tags across Electron main process (AC: 1, 4)
  - [x] Audit all `console.log/warn/error` calls in `electron/main.js` — verify all use `[Electron]` prefix
  - [x] Normalize Go server pipe forwarding: `[Go Server]` kept as-is (consistent, descriptive)

- [x] Task 2: Add ISO timestamp prefix to all console output unconditionally (AC: 1, 3)
  - [x] The `--log-file` wrapper already adds ISO prefix to file output; extend it to also prefix terminal output
  - [x] Move timestamp-wrapping logic to apply regardless of `--log-file` (terminal output also gets timestamps)
  - [x] Preserve existing `--log-file` append behaviour

- [x] Task 3: Forward renderer `console-message` by level (AC: 2, 5)
  - [x] Current code (line 465–467): `if (DEBUG) console.log('[Renderer Console] ${message}')` — gated entirely on DEBUG
  - [x] Refactor: forward errors (`_level === 3`) and warnings (`_level === 2`) unconditionally; forward info/verbose only when DEBUG
  - [x] Use level-appropriate console method: `console.error` for errors, `console.warn` for warnings, `console.log` for info

- [x] Task 4: Normalize Go server log format (AC: 1, 4)
  - [x] Go server currently uses `log.Printf` which outputs `YYYY/MM/DD HH:MM:SS message` (stdlib format)
  - [x] Updated `server/main.go`: set `log.SetFlags(0)` + `log.SetOutput(&logutil.GoWriter{W: os.Stderr})`
  - [x] Updated `logutil/logutil.go`: added `GoWriter` (io.Writer that prepends `[ISO] [INFO ] [go]`); `Debugf`/`Debugln` emit `[DEBUG] [go]` prefix
  - [x] Keep `logutil.Verbose` gate unchanged

- [x] Task 5: Document unified log format in a comment block (AC: 1)
  - [x] Added comment near top of `electron/main.js` describing three-layer log format
  - [x] Added comment in `server/main.go` describing Go log format alignment

- [x] Task 6: Remove `DEBUG=1` env var — use `--verbose` flag exclusively (AC: 1)
  - [x] `electron/main.js`: removed `process.env.DEBUG === '1'` from `DEBUG` definition; kept `--verbose` and `NODE_ENV=development`
  - [x] `electron/preload.js`: removed `process.env.DEBUG === '1'`; window.__DEBUG__ still set via `?debug=1` URL param chain
  - [x] Updated comments on `DEBUG` definition in both files

- [x] Task 7: Playwright test for renderer log forwarding (AC: 2, 5)
  - [x] Added `playwright_tests/test_logging.spec.js` with 3 tests (error, warn, log level forwarding)
  - [x] No sleeps — condition-based waiting with `expect.poll`
  - [x] All 3 tests pass

## Dev Notes

### Current Logging State (as of Story 16.7)

**Electron main process (`electron/main.js`)**:
- `DEBUG` flag: `process.argv.includes('--verbose') || process.env.NODE_ENV === 'development' || process.env.DEBUG === '1'`
- `--log-file=<path>` support (lines 37–51): wraps `console.log/error/warn` to append `[ISO-timestamp] message` to file AND calls original (so terminal also gets the message, but WITHOUT the timestamp prefix in terminal)
- All calls use `[Electron]` source prefix (e.g., `[Electron] Window ready`, `[Go Server] ...`)
- Renderer forwarding (line 465–467): `console-message` event, gated on `DEBUG` — only `console.log`

**Go server (`server/main.go`, `logutil/logutil.go`)**:
- `log.SetOutput(os.Stderr)` — all Go stdlib log output goes to stderr
- `logutil.Verbose = *verbose || os.Getenv("DEBUG") == "1"` — passed via `--verbose` flag from Electron
- Stdlib `log.Printf` format: `2006/01/02 15:04:05 message` (not ISO 8601)
- No structured fields; no log levels in the format string

**Renderer**:
- Uses `console.log/warn/error` directly
- Forwarded to main process via `console-message` event (DEBUG-gated, info-level only)

### Target Log Format

```
[2026-03-08T10:23:45.123Z] [INFO]  [electron] Window created
[2026-03-08T10:23:45.124Z] [DEBUG] [electron] Creating window, filePath: /tmp/test.sheet
[2026-03-08T10:23:45.130Z] [INFO]  [go]       GoSheet server running at http://localhost:54321
[2026-03-08T10:23:45.200Z] [ERROR] [renderer] Uncaught TypeError: Cannot read properties of undefined
```

Level mapping:
- `console.log` / `log.Printf` (non-verbose) → `[INFO]`
- `logutil.Debugf` / DEBUG-gated `console.log` → `[DEBUG]`
- `console.warn` / Go warnings → `[WARN]`
- `console.error` / `log.Fatalf` → `[ERROR]`

### Implementation Approach

**Electron timestamp wrapping (Task 2):**

The current `--log-file` wrapper adds timestamps only to file output. Extend it to add timestamps in terminal too:

```js
// Replace the current --log-file block with a universal timestamp wrapper:
const addTimestamp = process.argv.includes('--log-file=') || true; // always add timestamps
const logFileArg = process.argv.find((a) => a.startsWith('--log-file='));
let logStream = null;
if (logFileArg) {
  const logFilePath = logFileArg.slice('--log-file='.length);
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
}
const wrap = (orig, level) => (...args) => {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ` + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  if (logStream) logStream.write(line + '\n');
  orig(line);  // terminal output includes timestamp too
};
console.log = wrap(console.log, 'INFO ');
console.error = wrap(console.error, 'ERROR');
console.warn = wrap(console.warn, 'WARN ');
```

Note: This means the `[SOURCE]` prefix in each call site (`[Electron]`, `[Go Server]`, `[Renderer Console]`) becomes the message body after the level tag. The format becomes:
`[ISO] [LEVEL] [Electron] message` — which satisfies AC 1.

**Renderer level-aware forwarding (Task 3):**

```js
win.webContents.on('console-message', (_event, level, message) => {
  // level: 0=verbose, 1=info, 2=warning, 3=error
  if (level === 3) {
    console.error(`[Renderer] ${message}`);
  } else if (level === 2) {
    console.warn(`[Renderer] ${message}`);
  } else if (DEBUG) {
    console.log(`[Renderer] ${message}`);
  }
});
```

**Go log format (Task 4):**

```go
// In server/main.go init():
log.SetFlags(0) // disable stdlib prefix (date/time)
log.SetOutput(&isoWriter{w: os.Stderr}) // custom writer

type isoWriter struct{ w io.Writer }
func (iw *isoWriter) Write(p []byte) (n int, err error) {
  ts := time.Now().UTC().Format(time.RFC3339Nano)
  line := fmt.Sprintf("[%s] [INFO ] [go] %s", ts, p)
  return iw.w.Write([]byte(line))
}
```

Simpler alternative (avoids custom writer): just use `log.SetFlags(0)` and prefix manually in each `log.Printf` call — but there are many call sites. The custom `io.Writer` is cleaner.

For `logutil.Debugf/Debugln`, update to use the same prefix:
```go
func Debugf(format string, v ...any) {
  if Verbose {
    ts := time.Now().UTC().Format(time.RFC3339Nano)
    log.Printf("[%s] [DEBUG] [go] "+format, append([]any{ts}, v...)...)
  }
}
```

Wait — if `log.SetFlags(0)` is used with the custom writer that already adds the prefix, then `log.Printf` will route through the writer automatically. `logutil.Debugf` calls `log.Printf` which goes through the writer. So all Go logs get the ISO prefix automatically — just need to distinguish INFO vs DEBUG in the writer (cannot be done at the writer level since `log.Printf` doesn't pass level).

**Simpler Go approach**: set `log.SetFlags(0)`, then manually include level in each call:
```go
log.Printf("[INFO ] [go] GoSheet server running at http://localhost:%d", port)
logutil.Debugf → internally: log.Printf("[DEBUG] [go] "+format, v...)
```

This avoids custom writers and is consistent with the rest of the codebase style.

### Files to Touch

- `electron/main.js` — timestamp wrapping, renderer level-aware forwarding, source prefix normalization
- `logutil/logutil.go` — update Debugf/Debugln to include `[DEBUG] [go]` prefix
- `server/main.go` — `log.SetFlags(0)`, update `log.Printf` calls to include `[INFO ] [go]` or `[ERROR] [go]` prefix

### Env Var Cleanup: `DEBUG=1` vs `NODE_ENV`

**`DEBUG=1` — remove it.** It's redundant with `--verbose`. The only place it's non-trivially needed is `preload.js`, which can't read argv — but preload already gets `window.__DEBUG__` indirectly: main.js appends `?debug=1` to the server URL when `DEBUG` is true, and `index.html` reads `location.search.includes('debug=1')` to set `window.__DEBUG__`. So the chain is: `--verbose` → `DEBUG=true` in main.js → `?debug=1` in URL → `window.__DEBUG__=true` in renderer. `preload.js` can drop `process.env.DEBUG === '1'` safely.

**`NODE_ENV` — keep it.** It is Playwright infrastructure, not developer convenience:
- `NODE_ENV=test` gates the single-instance lock (required — Playwright launches fresh instances per run), clipboard permissions, window visibility, and close-handler behaviour.
- `NODE_ENV=development` contributes to `DEBUG` (harmless after removing `DEBUG=1`).
- `NODE_ENV=production` gates dev tools / cache clearing.

Removing `NODE_ENV` would require replacing all test-mode branching with a different mechanism (e.g., `--test` flag), which is a larger refactor with no benefit.

### Scope Boundaries

**In scope:**
- Consistent format across the three layers
- Renderer error/warn forwarding unconditionally
- Timestamps in terminal output (not just file output)

**Out of scope:**
- Structured logging (JSON format) — overkill for this app
- Log rotation — not needed at this scale
- Centralized log server — not needed
- Changing log destinations (Go already logs to stderr, Electron reads it via pipes)

### References

- `electron/main.js` lines 1–51: DEBUG flag, `--log-file` wrapper, single-instance lock
- `electron/main.js` lines 464–467: `console-message` renderer forwarding (current: DEBUG-gated, info only)
- `electron/main.js` lines 359–376: Go server stdout/stderr pipe handlers
- `logutil/logutil.go`: Verbose flag, Debugf/Debugln
- `server/main.go` lines 29–33: verbose flag, `log.SetOutput(os.Stderr)`
- Story 16.7 Dev Notes: `startGoServer()` pipe setup, `[Go Server]` prefix pattern
- Story 10.8: Original debug logging implementation (DEBUG flag, `[Electron]` prefix pattern)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Universal timestamp wrapper in `electron/main.js` now prefixes all terminal + file output with `[ISO] [LEVEL]` unconditionally. Format: `[2026-03-08T...Z] [INFO ] [Electron] message`.
- Renderer `console-message` forwarding is now level-aware: errors/warnings always forwarded, info/verbose gated by DEBUG.
- Go server uses `logutil.GoWriter` (custom `io.Writer`) + `log.SetFlags(0)` to emit `[ISO] [INFO ] [go]` prefix on all `log.Printf` lines. `logutil.Debugf/Debugln` emit `[DEBUG] [go]` prefix.
- `DEBUG=1` env var removed from both `main.js` and `preload.js`. Only `--verbose` flag enables debug mode (plus `NODE_ENV=development` for local dev).
- `logutil.Verbose` no longer falls back to `os.Getenv("DEBUG")` in `server/main.go`.
- 5 Playwright tests added in `test_logging.spec.js`; all pass (incl. AC5 main-process forwarding + non-forwarding of info-level in non-DEBUG mode).
- All 7 multi-window tests continue to pass (regression check).
- All Go tests pass.
- CR fixes: H1 — `Debugf`/`Debugln` now write directly to `logutil.writer` (bypass GoWriter) eliminating double-prefix. M1 — `GoWriter.W` uses `io.Writer`. M2 — corrected constructor comment. M3 — added 2 AC5 tests. L1 — removed redundant `logFilePath` re-declaration. L2 — added `logutil.Errorf`; replaced all `log.Printf` error call sites in controller/api with `logutil.Errorf`.

### File List

- `electron/main.js` — universal timestamp wrapper, level-aware renderer forwarding, removed `DEBUG=1`, added format comment
- `electron/preload.js` — removed `DEBUG=1`, updated comment
- `logutil/logutil.go` — added `GoWriter` io.Writer, updated `Debugf`/`Debugln` to emit `[DEBUG] [go]` prefix
- `server/main.go` — `log.SetFlags(0)`, `log.SetOutput(&logutil.GoWriter{...})`, removed `DEBUG=1` fallback, added format comment, updated shutdown handler comment
- `playwright_tests/test_logging.spec.js` — new: 5 renderer log forwarding tests (incl. AC5 main-process forwarding)
- `controller/app.go` — replaced 3× `log.Printf` errors with `logutil.Errorf`; removed `log` import
- `api/handlers.go` — replaced 11× `log.Printf` errors with `logutil.Errorf`
- `api/handlers_format.go` — replaced 2× `log.Printf` errors with `logutil.Errorf`; removed `log` import

