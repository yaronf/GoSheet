# Story 20.4: Agent Patch Endpoint

Status: done

## Story

As an agent,
I want to submit a batch of operations that are applied atomically,
so that I can make multi-cell changes in a single call that is either fully applied or fully rejected.

## Acceptance Criteria

1. **Given** `POST /api/agent/patch` with a valid rw token and a well-formed ops array, **when** all ops are valid, **then** all ops are applied in order, recorded as a single `AgentPatchCommand` in `sess.History`, the spreadsheet is marked modified, HTTP 200 is returned with `{ "success": true, "opsCount": N }`, and the audit log records the patch with `outcome: "applied"`.

2. **Given** a patch where one op is invalid (e.g. unknown op type, reversed range), **when** the request is processed, **then** no ops are applied (atomic rejection), HTTP 400 is returned with `{ "success": false, "error": "...", "failingOpIdx": N }`, and the audit log records the patch with `outcome: "rejected"`.

3. **Given** a read-only token (`scope: "ro"`), **when** `POST /api/agent/patch` is called, **then** HTTP 403 is returned with `{ "success": false, "error": "agent token is read-only" }`.

4. **Given** an empty ops array, **when** `POST /api/agent/patch` is called, **then** HTTP 400 is returned with `{ "success": false, "error": "ops array is empty" }`.

5. **Given** the following op types, **then** each is supported and maps to an existing Command:
   - `SetCell`: `{ "op": "SetCell", "row": N, "col": N, "value": "..." }` → `NewAgentSetCellCommand`
   - `ClearRange`: `{ "op": "ClearRange", "startRow": N, "startCol": N, "endRow": N, "endCol": N }` → `NewAgentClearRangeCommand`
   - `InsertRow`: `{ "op": "InsertRow", "row": N }` → `NewAgentInsertRowCommand`
   - `DeleteRow`: `{ "op": "DeleteRow", "row": N }` → `NewAgentDeleteRowCommand`
   - `InsertColumn`: `{ "op": "InsertColumn", "col": N }` → `NewAgentInsertColumnCommand`
   - `DeleteColumn`: `{ "op": "DeleteColumn", "col": N }` → `NewAgentDeleteColumnCommand`
   - `SetStyle`: `{ "op": "SetStyle", "row": N, "col": N, "styleId": N, "alignment": "..." }` → `NewAgentSetStyleCommand`
   - `AddStyle`: `{ "op": "AddStyle", "name": "...", "fontColor": "...", "fillColor": "..." }` → `NewAgentAddStyleCommand`
   - `ClearFormat`: `{ "op": "ClearFormat", "startRow": N, "startCol": N, "endRow": N, "endCol": N }` → `NewAgentClearFormatCommand`

6. **Given** a patch `description` field, **when** the patch is applied, **then** the description is recorded in the audit log but does not appear in the user's undo stack or the `AgentPatchCommand.Description()`.

7. **Given** the agent calls `POST /api/agent/rollback` after applying patches, **then** all ops from all patches since session open (or last commit) are reversed via `AgentPatchCommand.Undo()` which reverses its constituent commands in reverse order.

## Tasks / Subtasks

- [x] Task 1: Implement `HandleAgentPatch` in `api/handlers_agent.go` (AC: 1–6)
  - [x] Validate agent token via `agentTokenFromRequest`; check `sess.Scope != ScopeReadOnly`
  - [x] Decode `patchRequest` body (`description string`, `ops []patchOp`)
  - [x] Guard: empty ops array → 400
  - [x] **First pass**: call `validatePatchOp(op)` for each op — return 400 with `failingOpIdx` on first failure; log `outcome: "rejected"`
  - [x] Acquire `s.Ctrl.LockForAgent()` / defer `s.Ctrl.UnlockForAgent()`
  - [x] **Second pass**: call `s.buildPatchCommand(op)` + `cmd.Do()` for each op
  - [x] Wrap all cmds in `controller.NewAgentPatchCommand(cmds, req.Description)`
  - [x] Call `sess.History.PushDone(patch)` — records already-executed command without re-running `Do()`
  - [x] Set `s.Ctrl.Sheet.Modified = true` (AC1 — explicit mark regardless of op type)
  - [x] Call `s.Ctrl.Agent.LogPatch(agentID, filePath, description, opsCount, "applied")`
  - [x] Return `{ "success": true, "opsCount": len(req.Ops) }`

- [x] Task 2: Implement `validatePatchOp` helper (AC: 2, 5)
- [x] Task 3: Implement `buildPatchCommand` helper (AC: 5)
- [x] Task 4: Implement `patchOp` and `patchRequest` structs (AC: 5)
- [x] Task 5: Register route in `server/main.go` (AC: 1)
- [x] Task 6: Write Go unit tests in `api/` (AC: 1–7)
  - [x] Test each supported op type (SetCell, ClearRange, InsertRow/Col, DeleteRow/Col, SetStyle, AddStyle, ClearFormat)
  - [x] Test unknown op → 400, atomic rejection (no first op applied), Modified=false
  - [x] Test `ro` token → 403
  - [x] Test empty ops → 400
  - [x] Test invalid ClearRange (reversed bounds) → 400 with failingOpIdx
  - [x] Test Modified=true after successful patch (AC1)
  - [x] Test method-not-allowed returns JSON

## Dev Notes

### Implementation Already Complete

**The entire patch handler is already implemented** in `api/handlers_agent.go`:
- `HandleAgentPatch` at line 353
- `validatePatchOp` at line 432
- `buildPatchCommand` at line 464
- `patchOp` struct at line 330
- `patchRequest` struct at line 346

**Route is registered** in `server/main.go`. The dev agent should write unit tests (Task 6) and verify all AC are satisfied.

### Two-Pass Validation Model

The patch handler uses a strict two-pass approach:
1. **Validation pass**: all ops validated before any are executed — ensures atomic rejection
2. **Execution pass**: `cmd.Do()` called in sequence while holding `ctrl.mu`

If `Do()` fails (e.g. model returns error for out-of-bounds row), the partial state is not rolled back. The validation pass should catch all structural errors to prevent mid-apply failures.

### Agent History vs User History

The patch is recorded in `sess.History` (the agent's private `*History` instance), NOT in `ctrl.History` (the user's history). The user cannot `Cmd+Z` individual patches while the session is active. Agent changes become undoable only after `Commit` or `End` collapses `sess.History` into `ctrl.History` as a single `AgentCommitCommand`.

```
sess.History.PushDone(patch)  ← agent history
ctrl.History.Push(cmd)        ← user history (NOT used for agent patches)
```

### `PushDone` vs `Push`

`History.PushDone(cmd)` pushes an already-executed command without calling `cmd.Do()` again. This is the correct method for the patch handler because `cmd.Do()` was already called explicitly. `History.Push(cmd)` calls `Do()` — using it here would double-apply the operation. See `controller/command.go` for implementation.

### Command Factory Functions

All factory functions are in `controller/agent.go` (line 257 onwards):
- `NewAgentSetCellCommand(ctrl, row, col, value)` — snapshots `prevCell` at construction time
- `NewAgentClearRangeCommand(ctrl, startRow, startCol, endRow, endCol)` — captures cell snapshot at construction
- `NewAgentInsertRowCommand`, `NewAgentDeleteRowCommand` — delegate to existing command types
- `NewAgentInsertColumnCommand`, `NewAgentDeleteColumnCommand` — delegate to existing command types
- `NewAgentSetStyleCommand(ctrl, row, col, styleID, alignment)` — applies style + alignment, captures prev in `Do()`
- `NewAgentAddStyleCommand(ctrl, name, fontColor, fillColor)` — creates new named style; `Undo()` deletes it
- `NewAgentClearFormatCommand(ctrl, startRow, startCol, endRow, endCol)` — delegates to `ClearRangeFormatCommand`

### Lock Discipline

The handler acquires `s.Ctrl.LockForAgent()` (write lock) before the execution pass. `validatePatchOp` runs without a lock (reads only op fields, not the model). `agentTokenFromRequest` uses only `AgentManager.mu`.

### Audit Log

`s.Ctrl.Agent.LogPatch(agentID, filePath, description, opsCount, outcome)` — non-blocking (writes via goroutine channel). Log both `"applied"` and `"rejected"` outcomes. The patch `description` goes only to the audit log, not to the `AgentPatchCommand.Description()` which returns a generic `"Agent patch (N op(s))"`.

### Project Structure Notes

- `api/handlers_agent.go` — all agent HTTP handlers (single file, ~650 lines)
- `controller/agent.go` — `AgentManager`, `AgentSession`, factory functions
- `server/main.go` — route registration

### References

- [Source: api/handlers_agent.go#353] — `HandleAgentPatch`
- [Source: api/handlers_agent.go#432] — `validatePatchOp`
- [Source: api/handlers_agent.go#464] — `buildPatchCommand`
- [Source: controller/agent.go#257] — command factory functions
- [Source: controller/command.go] — `History.PushDone`, `History.Push`
- [Source: _bmad-output/planning-artifacts/epics.md#Story 20.4]
- [Source: _bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md#8. Patch Format]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `api/handlers_agent.go` — `HandleAgentPatch`, `validatePatchOp`, `buildPatchCommand`, `patchOp`, `patchRequest`; method-not-allowed uses `writeJSONError`; `s.Ctrl.Sheet.Modified = true` explicitly set after successful execution
- `api/handlers_agent_test.go` — `TestHandleAgentPatch_MarksSheetModified`, `TestHandleAgentPatch_AtomicRejectionDoesNotModify`, `TestHandleAgentPatch_InsertAndDeleteRow`, `TestHandleAgentPatch_InsertAndDeleteColumn`, `TestHandleAgentPatch_SetStyleAlignment`, `TestHandleAgentPatch_ClearFormat`, `TestHandleAgentPatch_InvalidClearRangeBounds`, `TestHandleAgentPatch_MethodNotAllowed`
- `frontend/app.js` — `cells_changed` event handler now calls `updateFileStatus()` in addition to `refreshAllCells()` so the status bar reflects unsaved changes after an agent patch
