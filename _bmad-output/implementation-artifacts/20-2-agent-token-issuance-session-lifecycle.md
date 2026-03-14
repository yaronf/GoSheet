# Story 20.2: Agent Token Issuance & Session Lifecycle

Status: done

## Story

As the Go server,
I want to issue scoped agent tokens and manage session state,
so that agents have controlled, attributable access with enforced scope and a clean lifecycle.

## Acceptance Criteria

1. **Given** `POST /api/agent/token` with a valid bootstrap token and `{"scope": "rw"}`, **when** no agent session is active, **then** the server returns `{"success": true, "agentToken": "...", "agentId": "agt_<8chars>"}` and opens a session.

2. **Given** `POST /api/agent/token`, **when** an agent session is already active, **then** HTTP 409 is returned with `{"success": false, "error": "agent session already active"}`.

3. **Given** an agent token used on any `/api/file/*` endpoint, **when** the request is processed, **then** HTTP 403 is returned regardless of scope.

4. **Given** `POST /api/agent/commit` with a valid agent token, **when** the request is processed, **then** all agent history since the last commit (or session open) is collapsed into a single `AgentCommitCommand` transferred to user history; the agent's History is reset; the token remains active; `"commit"` is written to the audit log.

5. **Given** `POST /api/agent/end` with a valid agent token (or via `POST /api/agent/session/end` with bootstrap token), **when** the request is processed, **then** any uncommitted agent history is collapsed into user history; the token is revoked; `"end"` is written to the audit log.

6. **Given** `POST /api/agent/rollback` with a valid agent token, **when** the request is processed, **then** the agent history stack is drained in reverse via `Undo()` calls; the token is revoked; the spreadsheet is restored to the state at session open (or last commit); `"rollback"` is written to the audit log.

7. **Given** a revoked or invalid agent token, **when** used on any endpoint, **then** HTTP 401 is returned.

8. **Given** `GET /api/agent/session/status` with a bootstrap token, **when** a session is active, **then** `{"success": true, "active": true, "agentId": "...", "scope": "..."}` is returned; when inactive, `{"active": false}`.

## Tasks / Subtasks

- [x] Task 1: Implement `controller/agent.go` — `AgentSession`, `AgentManager` (AC: 1, 2, 4, 5, 6, 7)
- [x] Task 2: Implement `collapseAgentHistory` and `AgentCommitCommand` (AC: 4, 5)
- [x] Task 3: Add `History.PushDone(cmd Command)` to `controller/command.go` (AC: 4)
- [x] Task 4: Add `Agent *AgentManager` to `AppController`, lock helpers (AC: 3)
- [x] Task 5: Implement session handlers in `api/handlers_agent.go` (AC: 1–8)
- [x] Task 6: Add `agentTokenFromRequest` helper (AC: 7)
- [x] Task 7: Enforce agent token scope — block `/api/file/*` (AC: 3)
- [x] Task 8: Register all lifecycle routes in `server/main.go` (AC: 1–8)
- [x] Task 9: Write Go unit tests in `controller/` (AC: 1–8)

## Dev Notes

### One Session Per Controller Instance
`AppController` holds exactly one `*AgentManager`. Since each window gets its own Go server process, this naturally provides one-session-per-file semantics. No distributed locking needed.

### Agent History Architecture
The agent's `History` instance is completely separate from `c.History` (the user's history). The agent's operations are applied directly to the spreadsheet model (they modify `c.Sheet`) but are tracked in `sess.History`, not `c.History`. On `Commit`/`End`, `collapseAgentHistory` takes the entire agent `undoStack`, wraps it in `AgentCommitCommand`, and appends to `c.History`. This gives the user a single undo entry ("Agent (N operation(s))") to revert everything.

### Lock Discipline
- `AgentManager` has its own internal `mu sync.Mutex` for protecting `session` pointer reads/writes
- `ctrl.mu` (the main controller lock) is held by callers of `Commit`, `End`, `Rollback` (passed `ctrl.History` while it's held)
- Handlers use `s.Ctrl.LockForAgent()` / `defer s.Ctrl.UnlockForAgent()` before calling these methods
- `Validate` and `ActiveSession` acquire only `AgentManager.mu` — they do not need `ctrl.mu`

### `agentTokenFromRequest` Extraction Order
1. `Authorization: Bearer <token>` header (primary — for all agent endpoints)
2. `?token=<token>` query param (only for bootstrap endpoint copy-paste UX)

### `GenerateToken()` — Already Exported
`controller/agent.go` line 244. Used both for bootstrap token (in `server/main.go`) and agent token (in `OpenSession`). Do not duplicate.

### Key Files
- `controller/agent.go` — `AgentSession`, `AgentManager`, `AgentCommitCommand`, `collapseAgentHistory`, `GenerateToken`
- `controller/app.go` — add `Agent` field, lock helpers, update constructors
- `controller/command.go` — add `PushDone` to `History`
- `api/handlers_agent.go` — all agent HTTP handlers
- `api/handlers.go` — `AuthMiddleware` scope/file-block enforcement
- `server/main.go` — route registration

### References
- [Source: _bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md#5. Agent Session Lifecycle]
- [Source: _bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md#6. Undo Architecture]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 20.2]
- [Source: controller/command.go#39] — `History.Push()` pattern for `PushDone`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `controller/agent.go` — `AgentScope`, `AgentSession`, `AgentManager` (RWMutex), `OpenSession`, `Validate`, `ActiveSession`, `Commit`, `End`, `Rollback`, `LogPatch`, `collapseAgentHistory`, `AgentCommitCommand`, `AgentPatchCommand`, factory functions
- `controller/app.go` — `Agent *AgentManager`, `NewAppController`, `NewAppControllerWithUserData`, `LockForAgent`/`UnlockForAgent`/`RLockForAgent`/`RUnlockForAgent`
- `controller/command.go` — `History.PushDone`
- `controller/agent_test.go` — full test suite for all lifecycle operations
- `api/handlers_agent.go` — `HandleAgentToken` (with bootstrap-only guard), `HandleAgentCommit`, `HandleAgentEnd`, `HandleAdminEndSession`, `HandleAgentRollback`, `HandleAgentSessionStatus`, `agentTokenFromRequest`
- `api/handlers_agent_test.go` — `TestHandleAgentToken_AgentTokenRejected` added
- `server/main.go` — all lifecycle routes registered
