# Story 20.5: Bootstrap Endpoint & Tool Definitions

Status: done

## Story

As an agent,
I want a single URL I can GET to receive everything I need to start working,
so that session setup requires no hardcoded knowledge of the API.

## Acceptance Criteria

1. **Given** `GET /api/agent/bootstrap?token=<agent-token>`, **when** the token is valid, **then** the response is `{ "success": true, "session": { "agentId": "...", "scope": "rw", "baseUrl": "http://localhost:<port>" }, "workbook": { ... }, "tools": [ ... ] }`.

2. **Given** the `tools` array in the response, **when** an LLM agent uses them, **then** it contains definitions for: `get_workbook`, `get_range`, `apply_patch`, `commit`, `end_session`, `rollback` — each with correct `input_schema` in OpenAI function calling format (JSON Schema-based).

3. **Given** the `baseUrl` in the `session` object, **when** the agent uses it for subsequent calls, **then** it correctly reflects `http://localhost:<port>` (the port the Go server is actually listening on, derived from `r.Host`).

4. **Given** `GET /api/agent/bootstrap?token=<invalid-or-missing>`, **when** the request is processed, **then** HTTP 401 is returned with `{ "success": false, "error": "invalid or expired agent token" }`.

5. **Given** the bootstrap endpoint accepts the token as a query parameter (`?token=`), **when** an agent or user pastes the bootstrap URL directly, **then** auth is satisfied without needing to set an `Authorization: Bearer` header (query param fallback is implemented in `agentTokenFromRequest`).

6. **Given** the `workbook` object in the response, **when** examined, **then** it contains: `filePath`, `cellCount`, `dimensions` (with `rows`, `cols`, `usedRange`), `modified`.

## Tasks / Subtasks

- [x] Task 1: Implement `HandleAgentBootstrap` in `api/handlers_agent.go` (AC: 1–6)
  - [x] `GET /api/agent/bootstrap` — validates token via `agentTokenFromRequest` (supports `?token=` query param)
  - [x] Derive `baseUrl` from `r.Host`: `"http://" + r.Host` (if host non-empty), else `"http://localhost"`
  - [x] Build response: `session`, `workbook` (from `buildWorkbookSummary()`), `tools` (from `agentToolDefinitions()`)
  - [x] Return HTTP 200

- [x] Task 2: Implement `agentToolDefinitions() []map[string]any` (AC: 2)
  - [x] Returns 6 tool definitions in OpenAI function calling format
  - [x] All 6 tools present: `get_workbook`, `get_range`, `apply_patch`, `commit`, `end_session`, `rollback`
  - [x] Each tool has `name`, `description`, `input_schema`

- [x] Task 3: Register route in `server/main.go` (AC: 1) — line 124

- [x] Task 4: Write Go unit tests in `api/` (AC: 1–6)
  - [x] Test bootstrap returns correct structure with valid token
  - [x] Test `tools` array has exactly 6 entries with expected names (AC2)
  - [x] Test `session.baseUrl` is correctly set from request host (AC3)
  - [x] Test invalid token → 401 (AC4)
  - [x] Test token in query param is accepted — no Authorization header (AC5)
  - [x] Test `workbook` contains required fields (AC6)
  - [x] Test method-not-allowed returns JSON

## Dev Notes

### Implementation Already Complete

**`HandleAgentBootstrap` and `agentToolDefinitions` are fully implemented** in `api/handlers_agent.go`:
- `HandleAgentBootstrap` at line 88
- `agentToolDefinitions` at line 558 (returns static definitions, accepts `_ string` — baseURL is currently unused in the static definitions)

**Route is registered** in `server/main.go`. The dev agent should write unit tests (Task 4) and verify all AC are satisfied.

### Bootstrap URL Pattern

The UI constructs the bootstrap URL as:
```
http://localhost:<port>/api/agent/bootstrap?token=<agent-token>
```
This URL is displayed in the Agent Session modal with a copy button. The user pastes it into an AI tool. The AI tool GETs the URL and receives everything it needs in one call.

### Token Handling on Bootstrap Endpoint

The bootstrap endpoint is unique: it's the **only** agent endpoint that accepts the token as a `?token=` query param. All other agent endpoints require `Authorization: Bearer <token>`. The `agentTokenFromRequest` helper checks header first, then query param — so the bootstrap URL pattern works without the agent needing to set headers for the initial discovery call.

```go
// agentTokenFromRequest extraction order (api/handlers_agent.go:28):
// 1. Authorization: Bearer <token>  (primary — all endpoints)
// 2. ?token=<token>                  (fallback — bootstrap URL copy-paste UX)
```

### Tool Definitions Format

The tool definitions use OpenAI function calling schema (JSON Schema). This is the closest cross-vendor standard — accepted by Anthropic Claude (tool_use), OpenAI, and most open-weight models. Example:
```json
{
  "name": "apply_patch",
  "description": "Apply a batch of operations atomically...",
  "input_schema": {
    "type": "object",
    "properties": {
      "ops": { "type": "array", "description": "...", "items": { ... } },
      "description": { "type": "string" }
    },
    "required": ["ops"]
  }
}
```

### `baseUrl` in Session

`baseUrl` is derived from `r.Host` (which includes the port for localhost connections). The agent uses this for all subsequent API calls:
```json
{ "session": { "baseUrl": "http://localhost:49213", "agentId": "agt_abc12345", "scope": "rw" } }
```

### No Auth on Bootstrap Endpoint in `AuthMiddleware`

The `AuthMiddleware` passes the request if the token is a valid bootstrap token OR a valid agent token. The bootstrap endpoint itself then calls `agentTokenFromRequest` which further validates that the token is specifically an agent token (not just any valid token). This double-validation ensures the bootstrap endpoint is only callable by actual agent token holders.

In test mode (`bootstrapToken == ""`), `AuthMiddleware` passes everything through, so `agentTokenFromRequest` performs the only validation.

### Project Structure Notes

- `api/handlers_agent.go` — `HandleAgentBootstrap` and `agentToolDefinitions`
- `server/main.go` — route registration

### References

- [Source: api/handlers_agent.go#88] — `HandleAgentBootstrap`
- [Source: api/handlers_agent.go#27] — `agentTokenFromRequest` (query param fallback)
- [Source: api/handlers_agent.go#558] — `agentToolDefinitions`
- [Source: _bmad-output/planning-artifacts/epics.md#Story 20.5]
- [Source: _bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md#4. Bootstrap URL]
- [Source: _bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md#11. Skill / Agent Bootstrapping]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `api/handlers_agent.go` — `HandleAgentBootstrap` (method-not-allowed → `writeJSONError`); `agentToolDefinitions` (removed unused `baseURL` param); `HandleAgentToken`, `HandleAgentCommit`, `HandleAgentEnd`, `HandleAgentRollback`, `HandleAdminEndSession`, `HandleAgentSessionStatus` — all remaining `http.Error` method-not-allowed calls replaced with `writeJSONError`
- `api/handlers_agent_test.go` — `TestHandleAgentBootstrap_ToolNames`, `TestHandleAgentBootstrap_BaseURLFromHost`, `TestHandleAgentBootstrap_WorkbookFields`, `TestHandleAgentBootstrap_MethodNotAllowed`
- `server/main.go` — route already registered at line 124 (no change needed)
