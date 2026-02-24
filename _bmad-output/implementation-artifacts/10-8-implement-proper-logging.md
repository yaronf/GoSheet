# Story 10.8: Implement Proper Logging

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.8  
**Estimated Effort:** 3-4 hours  
**Status:** ready-for-dev  
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
   - [ ] Introduce log levels (INFO, DEBUG, ERROR) or a `--verbose` / `DEBUG=1` flag
   - [ ] Startup message: INFO (always)
   - [ ] Request tracing (SetCellValue, Loading file, etc.): DEBUG only
   - [ ] CSV export step-by-step logs: DEBUG only
   - [ ] Errors: ERROR (always)
   - [ ] Replace `fmt.Printf` with log package

2. **Electron: gate debug output**
   - [ ] Debug logs (menu triggers, file dialogs, recent files) only when `NODE_ENV=development` or `DEBUG=1`
   - [ ] Critical logs (app ready, server started, errors) always
   - [ ] Preload: gate IPC call logs behind debug flag

3. **Frontend: gate debug output**
   - [ ] Debug logs (app.js init, cell edits, theme) only when `window.__DEBUG__` or URL param `?debug=1`
   - [ ] Error logs always
   - [ ] api-client.js: gate mode detection log behind debug

4. **Verification**
   - [ ] Default run: minimal logs (startup, errors only)
   - [ ] With debug flag: verbose logs
   - [ ] All tests pass
   - [ ] App builds and runs

---

## Tasks / Subtasks

- [ ] Task 1: Go server log levels (AC: #1)
  - [ ] Add `--verbose` flag or check `DEBUG` env var
  - [ ] Create helper: `logDebug(format, args...)` that no-ops when not verbose
  - [ ] Move request/CSV step logs to logDebug
  - [ ] Keep errors and startup as log.Printf
  - [ ] Replace fmt.Printf with log.Printf
- [ ] Task 2: Electron debug gate (AC: #2)
  - [ ] Add `const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG === '1'`
  - [ ] Wrap debug console.log in `if (DEBUG)`
  - [ ] Keep critical logs (app ready, server started, quit) unconditional
  - [ ] Update preload.js and menu.js
- [ ] Task 3: Frontend debug gate (AC: #3)
  - [ ] Set `window.__DEBUG__ = location.search.includes('debug=1')` or from Electron preload in dev
  - [ ] Wrap debug console.log in `if (window.__DEBUG__)`
  - [ ] Keep error logs unconditional
- [ ] Task 4: Verify (AC: #4)
  - [ ] Run app: verify minimal default output
  - [ ] Run with DEBUG=1 or --verbose: verify verbose output
  - [ ] Run `npm run test:all`

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
*(To be filled when implemented)*

### Change Log
*(To be filled when implemented)*

---

## Change Log

- 2026-02-24: Story created

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-24

Implement structured logging with configurable verbosity.
