# Story 20.6: Agent Session UI

Status: done

## Story

As a user,
I want to create and manage agent sessions from the app UI,
so that I can hand an agent access to my spreadsheet and revoke it when done.

## Acceptance Criteria

1. **Given** the app is open with a bootstrap token present (`window.__GOSHEET_TOKEN__`), **when** the toolbar is rendered, **then** an "Agent" button (key icon + status dot) appears in the toolbar.

2. **Given** the user clicks the "Agent" toolbar button, **when** no session is active, **then** a modal opens showing "No active agent session." and an "Issue Token (rw)" button.

3. **Given** the user clicks "Issue Token (rw)", **when** the token is issued, **then** the modal updates to show the session active state, displays the bootstrap URL in a readonly input field, and shows "Copy" and "End Session" buttons.

4. **Given** an agent session is active, **when** the user opens the modal, **then** the status dot on the toolbar button is green (`.agent-status-active`), the modal shows the agentId and scope, and the bootstrap URL `http://localhost:<port>/api/agent/bootstrap?token=<agent-token>` is displayed.

5. **Given** the user clicks "Copy", **when** the copy completes, **then** the button text changes to "Copied!" for 1.5s then reverts to "Copy".

6. **Given** the user clicks "End Session", **when** `POST /api/agent/session/end` completes, **then** the modal shows the inactive state, the status dot returns to idle (gray), and the session is cleared.

7. **Given** the agent calls `POST /api/agent/end` autonomously, **when** the 5-second poll detects the session is gone, **then** the toolbar status dot updates to idle without user action.

8. **Given** no bootstrap token in the page (`window.__GOSHEET_TOKEN__` undefined), **when** the toolbar renders, **then** the Agent button is hidden (never rendered for non-Electron environments or test mode).

9. **Given** `GET /api/agent/session/status` is called with the bootstrap token, **when** a session is active, **then** it returns `{ "active": true, "agentId": "...", "scope": "..." }`; when inactive, `{ "active": false }`.

## Tasks / Subtasks

- [x] Task 1: Add Agent toolbar button to `frontend/app.js` (AC: 1, 8) — line 126
- [x] Task 2: Add Agent session modal to `frontend/app.js` (AC: 2–6) — line 360
- [x] Task 3: Implement agent UI JS in `frontend/app.js` (AC: 2–7) — line 975
  - [x] State: `agentSessionState = { active: false, agentId: null, scope: null, token: null }`
  - [x] All button handlers, status dot, modal render, 5s poll
  - [x] Clipboard error handling added (M2 fix)
- [x] Task 4: Add agent API functions to `frontend/api-client.js` (AC: 3, 6, 9) — line 497
- [x] Task 5: Add CSS styles to `frontend/spreadsheet.css` (AC: 1, 4) — line 1503
- [x] Task 6: Implement `GET /api/agent/session/status` handler — `handlers_agent.go:216`
- [x] Task 7: Routes registered in `server/main.go` — lines 131–132
- [x] Task 8a: Live cell refresh via Electron IPC after agent patch
- [x] Task 8b: Playwright tests — API-level coverage in `playwright_tests/test_agent_api.spec.js` (UI tests omitted: Agent button hidden in test mode — `window.__GOSHEET_TOKEN__` undefined)

## Dev Notes

### Implementation Already Complete

**The majority of Story 20.6 is already implemented** from a prior session:

**`frontend/app.js`:**
- Agent toolbar button at line ~126
- Agent modal HTML at line ~360
- Agent UI JavaScript at lines ~971–1073 (including state, poll, all button handlers)
- Imports `AgentIssueToken`, `AgentSessionStatus`, `AgentEndSession` from `api-client.js`

**`frontend/api-client.js`:**
- `AgentIssueToken`, `AgentSessionStatus`, `AgentEndSession` at lines 497–549

**`frontend/spreadsheet.css`:**
- Agent status dot styles at lines 1503–1527

**`api/handlers_agent.go`:**
- `HandleAgentSessionStatus` at line 216
- `HandleAdminEndSession` at line 193

**Routes registered** in `server/main.go`.

The dev agent should write Playwright tests (Task 8) and verify the implementation matches all AC.

### Separate Modal Element

The agent modal uses `id="agent-modal"` and `class="modal-overlay"` — it is a **separate DOM element** from the app's main `#modal-overlay`. This avoids interference with existing confirm dialogs. The agent modal is shown/hidden with `style.display = 'flex'` / `'none'` directly.

### Token Not Returned by Status Endpoint

`GET /api/agent/session/status` returns `agentId` and `scope` but NOT the agent token (by design — token is secret, status is public to bootstrap token holders). The frontend stores the token in `agentSessionState.token` only from the issuance response. The `refreshAgentStatus()` function preserves the existing token:
```js
agentSessionState = {
  active: data.active,
  agentId: data.agentId || null,
  scope: data.scope || null,
  token: agentSessionState.token,  // preserve from issuance
};
```

### Bootstrap URL Construction

The bootstrap URL is constructed client-side:
```js
const url = `${location.origin}/api/agent/bootstrap?token=${agentSessionState.token || ''}`;
```
`location.origin` in the Electron renderer is `http://localhost:<port>` — correct for the agent to use.

### Agent Button Visibility

The agent button is only rendered when `window.__GOSHEET_TOKEN__` is truthy:
```js
${window.__GOSHEET_TOKEN__ ? `<button id="agent-btn" ...>` : ''}
```
In test mode (`NODE_ENV=test`), `window.__GOSHEET_TOKEN__` is undefined, so the button is hidden. The Playwright tests call the agent API directly via `apiFetch` without going through the UI button.

### End Session vs Rollback

The modal currently only has "End Session" (calls `POST /api/agent/session/end` via `AgentEndSession()`). This is the admin endpoint that uses the bootstrap token. A "Discard Session" button (which would call `POST /api/agent/rollback` using the agent token) is not in the current implementation — the user can rollback from the agent side, or use "End Session" which collapses agent history.

### Polling & Live Cell Refresh

`setInterval(refreshAgentStatus, 5000)` runs continuously while the page is open. On status change (active → inactive), `updateAgentStatusDot()` updates the dot. The modal only re-renders when explicitly opened.

**Live cell refresh** (Story 20.6 gap fix): After a successful `POST /api/agent/patch`, the Go server emits `EVENT cells_changed\n` to stdout. Electron's main process detects this in `forwardGoOutput`, looks up the window that owns the server via `windowRegistry`, and calls `win.webContents.send('go:event', 'cells_changed')`. The preload exposes `electronAPI.onGoEvent(callback)`. The frontend registers a listener inside the `window.__GOSHEET_TOKEN__` block and calls `refreshAllCells()` immediately — no polling lag, no wasted requests. See design doc §12 for full rationale and SSE alternative for future remote deployment.

### Project Structure Notes

- `frontend/app.js` — toolbar button HTML (~line 126), modal HTML (~line 360), UI JS (~line 971)
- `frontend/api-client.js` — `AgentIssueToken`, `AgentSessionStatus`, `AgentEndSession` (~line 497)
- `frontend/spreadsheet.css` — agent status dot CSS (~line 1503)
- `api/handlers_agent.go` — `HandleAgentSessionStatus` (line 216), `HandleAdminEndSession` (line 193)
- `server/main.go` — route registration

### References

- [Source: frontend/app.js#126] — Agent toolbar button
- [Source: frontend/app.js#360] — Agent modal HTML
- [Source: frontend/app.js#971] — Agent UI JavaScript
- [Source: frontend/api-client.js#497] — `AgentIssueToken`, `AgentSessionStatus`, `AgentEndSession`
- [Source: frontend/spreadsheet.css#1503] — agent status dot CSS
- [Source: api/handlers_agent.go#193] — `HandleAdminEndSession`
- [Source: api/handlers_agent.go#216] — `HandleAgentSessionStatus`
- [Source: _bmad-output/planning-artifacts/epics.md#Story 20.6]
- [Source: _bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md#10. UI]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `frontend/app.js` — Agent toolbar button (line 126), agent modal HTML (line 360), agent UI JS (line 975); `agentSessionState` now includes `token: null` in initial declaration; clipboard `.catch` handler added; dead `_agentPollInterval` variable removed with explanatory comment
- `frontend/api-client.js` — `AgentIssueToken`, `AgentSessionStatus`, `AgentEndSession` (line 497)
- `frontend/spreadsheet.css` — agent status dot + danger button styles (line 1503)
- `api/handlers_agent.go` — `HandleAgentSessionStatus` (line 216), `HandleAdminEndSession` (line 193)
- `server/main.go` — routes registered (lines 131–132)
- `playwright_tests/test_agent_api.spec.js` — `session status reflects active/inactive correctly` covers AC9; UI tests omitted (button hidden in test mode)
