# Story 20.3: Agent Read Endpoints

Status: done

## Story

As an agent,
I want to read the workbook structure and cell data,
so that I can understand what I'm working with before proposing changes.

## Acceptance Criteria

1. **Given** `GET /api/agent/workbook` with a valid agent token (ro or rw), **when** the request is processed, **then** the response includes: `{ "success": true, "workbook": { "filePath": "...", "cellCount": N, "dimensions": { "rows": N, "cols": N, "usedRange": "A1:D10" }, "modified": bool } }`.

2. **Given** `GET /api/agent/range?range=A1:D10` with a valid agent token, **when** the request is processed, **then** the response includes for each cell in the range: `row`, `col`, `ref` (A1 notation), `raw` (formula or value), `computed`, `isFormula`, `styleId`, `alignment`.

3. **Given** a range query that exceeds 10,000 cells (e.g. `A1:CV200` = 200×100 = 20,000 cells), **when** the request is processed, **then** HTTP 400 is returned with `{ "success": false, "error": "range too large (max 10000 cells, requested N)" }`.

4. **Given** an invalid A1 range (e.g. `ZZZZZ1:A1`, reversed range `D10:A1`), **when** the request is processed, **then** HTTP 400 is returned with a descriptive error.

5. **Given** a missing `range` query parameter on `GET /api/agent/range`, **when** the request is processed, **then** HTTP 400 is returned with `{ "success": false, "error": "range parameter required" }`.

6. **Given** a read-only token (`scope: "ro"`), **when** `POST /api/agent/patch` is attempted, **then** HTTP 403 is returned with `{ "success": false, "error": "agent token is read-only" }`. (Scope enforcement belongs to the patch handler — covered here as the ro token is issued in this story's test context.)

7. **Given** a revoked or missing agent token on any read endpoint, **when** the request is processed, **then** HTTP 401 is returned.

## Tasks / Subtasks

- [x] Task 1: `HandleAgentWorkbook` implemented and tested
- [x] Task 2: `HandleAgentRange` implemented and tested (incl. count field, computed fallback)
- [x] Task 3: `parseA1Range` implemented and tested
- [x] Task 4: Routes registered in `server/main.go`
- [x] Task 5: Go unit tests written (`TestHandleAgentWorkbook_*`, `TestHandleAgentRange_*`, `TestParseA1Range_*`, `TestBuildWorkbookSummary_*`)

## Dev Notes

### Implementation Already Complete

**Both handlers are already fully implemented** in `api/handlers_agent.go` (written in a prior Epic 20 implementation session):
- `HandleAgentWorkbook` at line 239
- `HandleAgentRange` at line 256
- `buildWorkbookSummary()` helper at line 489
- `parseA1Range()` helper at line 538

**Routes are registered** in `server/main.go`. This story is primarily a documentation/testing story — the dev agent should focus on writing the Go unit tests (Task 5) and verifying the implementation matches all AC.

### Key Types and Functions

- `model.RefToCoords(ref string) (row, col int, err error)` — parses A1 → row/col (`model/coords.go:36`)
- `model.CoordsToRef(row, col int) string` — row/col → A1 (`model/coords.go:73`)
- `s.Ctrl.Sheet.GetCell(row, col) *model.Cell` — returns nil for empty cells
- `cell.DisplayFormula()` — returns formula string or raw value
- `cell.Computed` — the evaluated string value
- `cell.IsFormula`, `cell.StyleId`, `cell.Alignment` — direct fields

### Cell Response Format

Each cell in the range response:
```json
{
  "row": 0, "col": 0, "ref": "A1",
  "raw": "=A2+1",
  "computed": "42",
  "isFormula": true,
  "styleId": 0,
  "alignment": ""
}
```
Empty cells are included with empty string values and `isFormula: false` for predictable array length.

### Scope Enforcement

Read-only scope enforcement is in `HandleAgentPatch` (Story 20.4), not the read endpoints. Both `ro` and `rw` tokens can access workbook and range endpoints. The `agentTokenFromRequest` helper validates the token is active; no scope check is needed in these handlers.

### Lock Discipline

- `buildWorkbookSummary()` acquires `RLockForAgent` internally — do NOT acquire again in the handler
- `HandleAgentRange` acquires `RLockForAgent` around the cell iteration loop
- `agentTokenFromRequest` uses only `AgentManager.mu` (not `ctrl.mu`) — safe to call without holding `ctrl.mu`

### Test Setup Pattern

Tests in `api/` package can create a `Server` with `NewServer(ctrl, "")` (empty bootstrap token = test mode, no auth). Then:
```go
req := httptest.NewRequest("GET", "/api/agent/workbook", nil)
req.Header.Set("Authorization", "Bearer "+agentToken)
rr := httptest.NewRecorder()
s.HandleAgentWorkbook(rr, req)
```

### References

- [Source: api/handlers_agent.go#239] — `HandleAgentWorkbook` implementation
- [Source: api/handlers_agent.go#256] — `HandleAgentRange` implementation
- [Source: api/handlers_agent.go#489] — `buildWorkbookSummary` helper
- [Source: api/handlers_agent.go#538] — `parseA1Range` helper
- [Source: model/coords.go#36] — `RefToCoords`
- [Source: model/coords.go#73] — `CoordsToRef`
- [Source: _bmad-output/planning-artifacts/epics.md#Story 20.3]
- [Source: _bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md#7. API Surface]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `api/handlers_agent.go` — `HandleAgentWorkbook`, `HandleAgentRange`, `buildWorkbookSummary`, `parseA1Range`; method-not-allowed responses use `writeJSONError`; range response includes `count`; computed falls back to raw value
- `api/handlers_agent_test.go` — `TestHandleAgentWorkbook_*`, `TestHandleAgentRange_*`, `TestParseA1Range_*`, `TestBuildWorkbookSummary_*`
- `server/main.go` — routes registered
