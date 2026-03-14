# Story 20.1: Bootstrap Token & Auth Middleware

Status: done

## Story

As the app,
I want all HTTP API calls to require a bearer token,
so that the Go server is protected from local port scanning and unauthorized access.

## Acceptance Criteria

1. **Given** the Go server starts with `NODE_ENV != "test"`, **when** it is ready to accept connections, **then** it generates a 32-byte CSPRNG bootstrap token (base64url encoded) and writes `TOKEN=<token>\n` to fd 3 immediately after `PORT=<n>\n`.

2. **Given** a request arrives at any `/api/*` endpoint without a valid `Authorization: Bearer <token>` header, **when** `NODE_ENV != "test"`, **then** the server returns HTTP 401.

3. **Given** Electron reads `TOKEN=<value>` from fd 3, **when** the renderer makes any API call via `api-client.js`, **then** the request includes `Authorization: Bearer <bootstrap-token>`.

4. **Given** the server is in test mode (`NODE_ENV=test`), **when** any `/api/*` request arrives, **then** auth is bypassed entirely (no token required) so all existing Playwright tests remain unaffected.

5. **Given** a static file route (e.g., `/` serving the frontend), **when** any request arrives, **then** auth is NOT required (static files have no auth).

6. **Given** a request uses the bootstrap token, **when** it targets any `/api/file/*` endpoint, **then** it is allowed through (bootstrap token has full access).

## Tasks / Subtasks

- [x] Task 1: Generate bootstrap token in `server/main.go` (AC: 1)
  - [x] Import `controller.GenerateToken()` (already in `controller/agent.go` — exported)
  - [x] In `main()`, check `os.Getenv("NODE_ENV") != "test"` and call `GenerateToken()` to populate `bootstrapToken`
  - [x] Write `TOKEN=<token>\n` to fd 3 pipe after the existing `PORT=<n>\n` write

- [x] Task 2: Add `AuthMiddleware` to `api/handlers.go` (AC: 2, 4, 5)
  - [x] Add `bootstrapToken string` field to `Server` struct
  - [x] Update `NewServer(ctrl, bootstrapToken string) *Server` signature
  - [x] Implement `AuthMiddleware(next http.HandlerFunc) http.HandlerFunc`

- [x] Task 3: Apply auth middleware to all routes in `server/main.go` (AC: 2, 5)
  - [x] Add `wrap(next http.HandlerFunc, requireAuth bool) http.HandlerFunc` helper
  - [x] Wrap all `/api/*` routes with `wrap(..., true)`
  - [x] Wrap static file route with `wrap(..., false)`
  - [x] Add `Authorization` to `Access-Control-Allow-Headers`

- [x] Task 4: Parse `TOKEN=` from fd 3 in `electron/main.js` (AC: 3)
  - [x] Extend fd 3 regex to match `TOKEN=([^\n]+)`
  - [x] `_resolvePort({ port, token })`
  - [x] `bootstrapToken` stored in `windowRegistry`
  - [x] Token passed as `?token=` URL param to renderer

- [x] Task 5: Inject bootstrap token into all API calls in `frontend/api-client.js` (AC: 3)
  - [x] Token extraction in `frontend/index.html` inline script
  - [x] `fetchUnified` adds `Authorization: Bearer <token>` when `window.__GOSHEET_TOKEN__` present

- [x] Task 6: Update `api/handlers_test.go` to pass empty token to `NewServer` (AC: 4)
  - [x] All `NewServer(ctrl)` calls updated to `NewServer(ctrl, "")`

- [x] Task 7: Playwright tests pass with no regressions (AC: 4)

## Dev Notes

### Token Generation
`GenerateToken()` is already implemented in `controller/agent.go`:
```go
func GenerateToken() (string, error) {
    b := make([]byte, 32)
    if _, err := rand.Read(b); err != nil { return "", err }
    return base64.RawURLEncoding.EncodeToString(b), nil
}
```
Uses `crypto/rand` — cryptographically secure. Output is base64url **without padding** (`RawURLEncoding`), ~43 chars. No `=` characters — safe in URLs without encoding. **Do not invent a new implementation.**

### fd 3 Protocol
Go server currently writes `PORT=<n>\n` to fd 3 and closes. New format:
```
PORT=49213
TOKEN=abc123...
```
Both on fd 3, token line added only when not in test mode. Electron reads the entire data event (Go closes fd 3 right after writing so it all arrives in one `data` event).

### Auth Middleware Pattern
```go
func (s *Server) AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        if s.bootstrapToken == "" {
            next(w, r) // test mode: no auth
            return
        }
        token := "" // extract from Authorization: Bearer header
        // ... validate ...
        if valid { next(w, r) } else { 401 }
    }
}
```
The middleware runs BEFORE agent-token scope checks (those are in individual handlers).

### CORS Headers
Add `Authorization` to `Access-Control-Allow-Headers`:
```go
w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
```

### Token Injection in Frontend
Token comes via `?token=<value>` URL query param. Extracted in `index.html` before modules load (same pattern as `__DEBUG__`). Stored on `window.__GOSHEET_TOKEN__`. In `fetchUnified`:
```js
const token = typeof window !== 'undefined' && window.__GOSHEET_TOKEN__;
if (token) opts.headers['Authorization'] = `Bearer ${token}`;
```
In test mode `NODE_ENV=test`, Go skips token generation so `params.set('token', ...)` is never called — `window.__GOSHEET_TOKEN__` remains undefined — header is not sent — server bypasses auth. Clean round-trip.

### Key Files
- `server/main.go` — token generation, fd 3 write, `wrap()` helper, route registration
- `api/handlers.go` — `Server` struct, `NewServer`, `AuthMiddleware`
- `api/handlers_test.go` — update `NewServer` calls (2 occurrences)
- `electron/main.js` — fd 3 parsing (~line 372), `createWindow` (~line 428), `windowRegistry` (~line 461), URL params (~line 485)
- `frontend/index.html` — inline script block (~line 18)
- `frontend/api-client.js` — `fetchUnified` (~line 36)
- `controller/agent.go` — `GenerateToken()` already exported (line 244)

### No New Files Needed
All changes are in-place edits. No new Go packages, no new frontend modules.

### Test Mode Invariant
`NODE_ENV=test` is set by Electron in `fixtures.js`. It propagates to the Go server via `env: { ...process.env, NODE_ENV: 'test' }`. When `NODE_ENV=test`, Go skips token generation → `bootstrapToken` is `""` → `AuthMiddleware` passes all requests through. All 200+ existing Playwright tests must continue passing without modification.

### References
- [Source: _bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md#3. Token Model] — bootstrap token design
- [Source: _bmad-output/planning-artifacts/epics.md#Story 20.1] — acceptance criteria
- [Source: controller/agent.go#244] — `GenerateToken()` implementation
- [Source: server/main.go#146] — existing fd 3 PORT write
- [Source: electron/main.js#372] — existing fd 3 parse
- [Source: frontend/index.html#18] — `__DEBUG__` inline script pattern to follow
- [Source: frontend/api-client.js#36] — `fetchUnified` function

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `server/main.go` — bootstrap token generation, fd 3 write, `wrap()` helper, route registration
- `api/handlers.go` — `Server.bootstrapToken`, `NewServer`, `AuthMiddleware`, `isFileEndpoint` (strings.HasPrefix), `writeJSONError` (via handlers_agent.go)
- `api/handlers_agent.go` — `writeJSON`, `writeJSONError` helpers
- `api/handlers_test.go` — updated `NewServer(ctrl, "")` calls
- `api/handlers_agent_test.go` — `TestAuthMiddleware_*` tests incl. `?token=` query param test
- `electron/main.js` — fd 3 TOKEN parsing, `windowRegistry` bootstrapToken, renderer URL params, `forwardGoOutput` EVENT routing
- `electron/preload.js` — `onGoEvent` IPC bridge
- `frontend/index.html` — `__GOSHEET_TOKEN__` inline script
- `frontend/api-client.js` — `fetchUnified` Authorization header injection
