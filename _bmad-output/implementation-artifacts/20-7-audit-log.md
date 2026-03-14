# Story 20.7: Audit Log

Status: done

## Story

As a user,
I want a persistent record of what agents have done to my spreadsheets,
so that I can review past agent activity.

## Acceptance Criteria

1. **Given** any of the following events occur: session open, patch applied, commit, end, rollback, **when** the event is processed, **then** a JSONL record is appended to `~/Library/Application Support/GoSheet/agent-audit.jsonl` (or the OS user config dir equivalent on other platforms).

2. **Given** a patch audit record, **then** it includes: `ts` (ISO 8601 UTC), `agentId`, `event: "patch"`, `filePath`, `description` (omitted if empty), `opsCount` (omitted if 0), `outcome` (`"applied"` or `"rejected"`).

3. **Given** session lifecycle audit records, **then** each includes: `ts`, `agentId`, `event` (`"session_open"` | `"commit"` | `"end"` | `"rollback"`), `filePath`.

4. **Given** the audit log file does not exist, **when** the first event is recorded, **then** the directory is created automatically and the file is created on first write.

5. **Given** the audit log write fails (e.g. disk full, permission error), **when** the write fails, **then** the failure is logged at WARN level but does not affect the API response or spreadsheet state.

6. **Given** the audit log channel is full (>256 pending events), **when** a new event arrives, **then** the event is dropped and a WARN log is emitted; the caller is never blocked.

7. **Given** the Go server is started by Electron, **when** Electron passes `--userData=<path>` flag, **then** the Go server writes the audit log to `<path>/agent-audit.jsonl` instead of the default OS config dir.

8. **Given** the Go server is started without `--userData` (e.g. standalone, tests), **when** an audit event is written, **then** it falls back to `os.UserConfigDir()/GoSheet/agent-audit.jsonl`.

## Tasks / Subtasks

- [x] Task 1: Implement `AuditLogger` in `controller/audit.go` (AC: 1–6, 8)
- [x] Task 2: Integrate `AuditLogger` into `AgentManager` in `controller/agent.go` (AC: 1–3)
- [x] Task 3: Wire `AuditLogger` into `AppController` in `controller/app.go` (AC: 7, 8)
- [x] Task 4: Pass `--userData` flag from Electron to Go server in `electron/main.js` (AC: 7) — line 358
- [x] Task 5: Accept `--userData` flag in `server/main.go` (AC: 7, 8) — line 41
- [x] Task 6: Write Go unit tests in `controller/` (AC: 1–6)
  - [x] `TestAuditLoggerWritesEvents` — session_open + patch written to file
  - [x] `TestAuditLoggerCreatesDir` — dir created on first write (AC4)
  - [x] `TestAuditLoggerNonBlocking` — 400 events, no hang (AC6)
  - [x] `TestAuditLoggerRollbackEvent` — rollback event written (added in CR)
  - [x] `TestAuditLoggerSessionIntegration` — full lifecycle via AppController

## Dev Notes

### Implementation Already Complete

**`AuditLogger` is fully implemented** in `controller/audit.go`:
- `AuditEvent` struct at line 14
- `AuditLogger` struct at line 25
- `NewAuditLogger` at line 33
- `run` (goroutine) at line 52
- `Log` at line 85
- `Close` at line 97

**`AgentManager.audit` integration** is in `controller/agent.go` — all five events are logged.

**`NewAppControllerWithUserData`** is in `controller/app.go` line 27.

**`--userData` flag** is parsed in `server/main.go` line 41 and passed at line 51.

**MISSING: Electron doesn't pass `--userData` to the Go server yet** (Task 4). The `spawnArgs` array in `electron/main.js` (~line 356) only adds `--verbose` in debug mode. `app.getPath('userData')` is used for `RECENT_FILES_PATH` (line 89) but not forwarded to the Go server. This is the **only outstanding implementation task** — everything else is already done.

### JSONL Format

Each line is a complete JSON object, newline-terminated:
```json
{"ts":"2026-03-14T14:23:01Z","agentId":"agt_abc12345","event":"patch","filePath":"/Users/alice/budget.sheet","description":"Fill column B","opsCount":6,"outcome":"applied"}
{"ts":"2026-03-14T14:25:00Z","agentId":"agt_abc12345","event":"end","filePath":"/Users/alice/budget.sheet"}
```
`description`, `opsCount`, `outcome` are `omitempty` — they don't appear in lifecycle events.

### Non-Blocking Design

The `Log()` method uses a buffered channel (capacity 256) with a `select`/`default` to avoid blocking the caller under any circumstances:
```go
select {
case al.ch <- ev:
default:
    logutil.Warnf("audit: channel full, dropping event ...")
}
```
The background goroutine drains the channel; write errors are logged at WARN but don't propagate.

### Fallback Path

When `--userData` is not provided:
```go
cfg, err := os.UserConfigDir()  // ~/Library/Application Support on macOS
dir = filepath.Join(cfg, "GoSheet")
```
File path: `~/Library/Application Support/GoSheet/agent-audit.jsonl`

### `--userData` in Electron

The correct location to add it is in `electron/main.js` in the `createGoServer()` (or equivalent) function where `spawnArgs` is built:
```js
const spawnArgs = [];
if (DEBUG) spawnArgs.push('--verbose');
spawnArgs.push(`--userData=${app.getPath('userData')}`);  // Story 20.7
```
This runs before `spawn(serverPath, spawnArgs, ...)`.

### No Rotation in v1

The audit log grows unbounded. For a local single-user app this is acceptable. File size concerns are a v2 problem.

### Close on Server Shutdown

`AuditLogger.Close()` should be called when the Go server exits to flush pending events. Currently it's not called on server shutdown — events in the channel buffer may be lost if the process is killed. This is an acceptable v1 tradeoff for a local app.

### Project Structure Notes

- `controller/audit.go` — `AuditLogger`, `AuditEvent`, `NewAuditLogger`, `Log`, `Close`
- `controller/agent.go` — `AgentManager.audit`, all event logging calls
- `controller/app.go` — `NewAppControllerWithUserData`
- `server/main.go` — `--userData` flag, `NewAppControllerWithUserData` call
- `electron/main.js` — needs `--userData` added to `spawnArgs` (~line 356)

### References

- [Source: controller/audit.go] — complete `AuditLogger` implementation
- [Source: controller/agent.go#34] — `AgentManager.audit` field and usage
- [Source: controller/app.go#27] — `NewAppControllerWithUserData`
- [Source: server/main.go#41] — `--userData` flag
- [Source: electron/main.js#356] — `spawnArgs` (missing `--userData` call)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 20.7]
- [Source: _bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md#9. Audit Log]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `controller/audit.go` — `AuditEvent`, `AuditLogger`, `NewAuditLogger`, `Log`, `Close`
- `controller/agent.go` — `AgentManager.audit`, all five event log calls (session_open, commit, end, rollback, patch via LogPatch)
- `controller/app.go` — `NewAppController`, `NewAppControllerWithUserData`
- `controller/agent_test.go` — `TestAuditLoggerWritesEvents`, `TestAuditLoggerCreatesDir`, `TestAuditLoggerNonBlocking`, `TestAuditLoggerRollbackEvent` (added), `TestAuditLoggerSessionIntegration`; file paths fixed to use `filepath.Join`
- `server/main.go` — `--userData` flag (line 41), `NewAppControllerWithUserData` call (line 51)
- `electron/main.js` — `--userData=${app.getPath('userData')}` added to spawnArgs (line 358)
