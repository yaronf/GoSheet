# Story 21.4: Create debugging.md

Status: done

## Story

As a developer working on GoSheet,
I want a `docs/debugging.md` reference document,
so that I can quickly find and apply the correct debugging workflow without reading through old story notes.

## Acceptance Criteria

1. **Given** the file `docs/debugging.md` does not exist
   **When** this story is implemented
   **Then** `docs/debugging.md` exists and covers all topics in the Tasks section

2. **Given** a developer wants to see renderer (frontend JS) logs in the terminal
   **When** they read the document
   **Then** they understand that `console.error` and `console.warn` are forwarded unconditionally, while `console.log` requires `--verbose`

3. **Given** a developer wants to capture all logs to a file
   **When** they read the document
   **Then** they understand how to use `npm start -- --log-file=/tmp/gosheet-debug.log` and `--verbose` together

4. **Given** a developer wants to add temporary diagnostics
   **When** they read the document
   **Then** they understand to use `console.error` for unconditional output and `console.log` for verbose-only output in renderer code

5. **Given** a developer wants to understand the log format
   **When** they read the document
   **Then** they see example output showing `[ISO-timestamp] [LEVEL] [SOURCE] message` with all three sources

## Tasks / Subtasks

- [ ] Task 1: Create `docs/debugging.md` covering:
  - [ ] Overview: three-layer log architecture ([Electron], [go], [Renderer])
  - [ ] Log format: `[ISO-timestamp] [LEVEL] [SOURCE] message` with example output
  - [ ] Log levels: DEBUG, INFO, WARN, ERROR — which are gated vs unconditional
  - [ ] Starting with verbose: `npm start -- --verbose`
  - [ ] Capturing to file: `npm start -- --log-file=/tmp/gosheet-debug.log` and combined with `--verbose`
  - [ ] Renderer log forwarding rules: `console.error`/`console.warn` always forwarded; `console.log` only with `--verbose`
  - [ ] Adding temporary diagnostics: use `console.error('[Debug] ...')` for unconditional output in renderer
  - [ ] Go server logs: `logutil.Debugf` (verbose only), `logutil.Warnf`/`logutil.Errorf` (unconditional)
  - [ ] Quick reference table: log function → level → gated?

- [ ] Task 2: Update sprint status to done

## Dev Notes

### Log Architecture (Story 16.8)

**Format:** `[2026-03-13T10:00:00Z] [LEVEL] [SOURCE] message`

**Sources:**
- `[go]` — Go HTTP server (via `logutil` package + `GoWriter`)
- `[Electron]` — Electron main process (`electron/main.js`)
- `[Renderer]` — Frontend JS forwarded via `win.webContents.on('console-message')`

**Levels and gating:**
| Function | Level | Gated by |
|---|---|---|
| `logutil.Debugf/Debugln` | `[DEBUG]` | `--verbose` flag |
| `log.Printf` via GoWriter | `[INFO ]` | unconditional (avoid — use Debugf instead) |
| `logutil.Warnf` | `[WARN ]` | unconditional |
| `logutil.Errorf` | `[ERROR]` | unconditional |
| `console.log` in renderer | `[INFO ]` | `--verbose` (via `console-message` level 0/1) |
| `console.warn` in renderer | `[WARN ]` | unconditional (level 2) |
| `console.error` in renderer | `[ERROR]` | unconditional (level 3) |

**Renderer forwarding (electron/main.js ~line 505):**
```js
win.webContents.on('console-message', (_event, level, message) => {
  if (level === 3)      console.error(`[Renderer] ${message}`);
  else if (level === 2) console.warn(`[Renderer] ${message}`);
  else if (DEBUG)       console.log(`[Renderer] ${message}`);
});
```

### Run Commands

```sh
# Default (WARN+ERROR only after Story 21.3):
npm start

# Verbose (all levels):
npm start -- --verbose

# Log to file:
npm start -- --log-file=/tmp/gosheet-debug.log

# Combined:
npm start -- --verbose --log-file=/tmp/gosheet-debug.log

# Tail the log file:
tail -f /tmp/gosheet-debug.log
```

### Files to Touch
- `docs/debugging.md` — new file

### References
- [Source: logutil/logutil.go] Debugf, Warnf, Errorf, GoWriter
- [Source: electron/main.js#~13] DEBUG flag definition
- [Source: electron/main.js#~505-513] Renderer console-message forwarding
- [Source: server/main.go#~36] `--verbose` flag registration

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `docs/debugging.md` covering log format, levels, run commands, renderer forwarding rules, temporary diagnostic patterns, Go logging reference, and common scenarios

### File List

- docs/debugging.md — new file
