# Story 10.8: Implement Proper Logging

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.8  
**Estimated Effort:** 3-4 hours  
**Status:** in-progress  
**Created:** 2026-02-24

---

## Story

As a developer,  
I want structured logging with configurable verbosity,  
So that production logs are clean and debug output is available when needed.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron implementation
- Epic 5 complete: Playwright testing

**Current State:**
- **Go server:** Uses `log.Printf` / `log.Println` for everything—no levels. Verbose CSV export logs on every request. `fmt.Printf` for startup message.
- **Electron:** ~60 `console.log` calls in main.js, preload.js, menu.js—all unconditional.
- **Frontend:** ~75 `console.log` in app.js, api-client.js—all unconditional.
- No way to reduce log noise in production or when debugging.

**Why This Story:**
Bare prints and unconditional console.log clutter output, make debugging harder, and can leak internal details. Structured logging with levels (or a debug flag) keeps production quiet while enabling verbose output when needed.

**Reference:** [Story 7-5](7-5-implement-recent-files-list.md) - "Added Story 10-8 to implement proper logging package in the future"

---

## Acceptance Criteria

1. **Go server: log levels**
   - [x] Introduce log levels (INFO, DEBUG, ERROR) or a `--verbose` / `DEBUG=1` flag
   - [x] Startup message: INFO (always)
   - [x] Request tracing (SetCellValue, Loading file, etc.): DEBUG only
   - [x] CSV export step-by-step logs: DEBUG only
   - [x] Errors: ERROR (always)
   - [x] Replace `fmt.Printf` with log package

2. **Electron: gate debug output**
   - [x] Debug logs (menu triggers, file dialogs, recent files) only when `NODE_ENV=development` or `DEBUG=1`
   - [x] Critical logs (app ready, server started, errors) always
   - [x] Preload: gate IPC call logs behind debug flag

3. **Frontend: gate debug output**
   - [x] Debug logs (app.js init, cell edits, theme) only when `window.__DEBUG__` or URL param `?debug=1`
   - [x] Error logs always
   - [x] api-client.js: gate mode detection log behind debug

4. **Verification**
   - [x] Default run: minimal logs (startup, errors only)
   - [x] With debug flag: verbose logs
   - [x] Go tests pass
   - [x] App builds and runs

---

## Tasks / Subtasks

- [x] Task 1: Go server log levels (AC: #1)
  - [x] Add `--verbose` flag or check `DEBUG` env var
  - [x] Create helper: `logutil.Debugf`/`logutil.Debugln` that no-ops when not verbose
  - [x] Move request/CSV step logs to logutil
  - [x] Keep errors and startup as log.Printf
  - [x] Replace fmt.Printf with log.Printf
- [x] Task 2: Electron debug gate (AC: #2)
  - [x] Add `const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG === '1'`
  - [x] Wrap debug console.log in `if (DEBUG)`
  - [x] Keep critical logs (app ready, server started, quit) unconditional
  - [x] Update preload.js and menu.js
- [x] Task 3: Frontend debug gate (AC: #3)
  - [x] Set `window.__DEBUG__` via index.html (preload in Electron, URL param for web)
  - [x] Wrap debug console.log in `if (window.__DEBUG__)`
  - [x] Keep error logs unconditional
- [x] Task 4: Verify (AC: #4)
  - [x] Run app: verify minimal default output
  - [x] Run with DEBUG=1 or --verbose: verify verbose output
  - [x] Go tests pass

---

## Dev Notes

### Scope

- **In scope:** Log level/verbosity control; remove unconditional debug prints
- **Out of scope:** Full structured logging (JSON, log aggregation); file logging; external log service

### Go Options

- **Simple:** `if verbose { log.Printf(...) }` with flag
- **Library:** `slog` (Go 1.21+) or `zerolog`—adds dependency
- **Recommendation:** Start with flag + helper; avoid new deps

### Electron/Frontend

- Tests run with `NODE_ENV=test`—ensure test logs don't break assertions
- Playwright tests may rely on console output; verify no regressions

### Architecture Compliance
- **Go server**: server/main.go — add `--verbose` flag via `flag` package
- **Electron**: electron/main.js, electron/menu.js, electron/preload.js
- **Frontend**: frontend/app.js, frontend/api-client.js
- **No new deps**: Use flag + helper; avoid slog/zerolog for now

### File Structure
- **Modify**: server/main.go, electron/*.js, frontend/app.js, frontend/api-client.js
- **Pattern**: `if (verbose) { log.Printf(...) }` for Go; `if (DEBUG) { console.log(...) }` for JS

---

## References

- [Story 7-5](7-5-implement-recent-files-list.md) - Recent files (references 10-8)
- [Go log package](https://pkg.go.dev/log)
- [Go slog](https://pkg.go.dev/log/slog) - Structured logging (Go 1.21+)

---

## Dev Agent Record

### File List
- logutil/logutil.go (new)
- server/main.go
- controller/app.go
- model/dependencies.go
- electron/main.js
- electron/preload.js
- electron/menu.js
- frontend/index.html
- frontend/api-client.js
- frontend/app.js

### Change Log
- 2026-02-24: Implemented logutil with Verbose flag; Go server --verbose, Electron DEBUG, frontend __DEBUG__

---

## Change Log

- 2026-02-24: Story created

---

## Status

**Current Status:** in-progress (pending full test pass)  
**Last Updated:** 2026-02-24

Implement structured logging with configurable verbosity.
