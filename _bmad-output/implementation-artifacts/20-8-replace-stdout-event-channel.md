# Story 20.8: Replace stdout Event Channel with SSE

Status: ready-for-dev

## Story

As a developer,
I want Go-to-renderer push events to use SSE (`GET /api/events`),
so that the brittle stdout `EVENT <name>` text-parsing hack is replaced with a standard HTTP transport that works in both Electron and standalone mode.

## Background

The current push mechanism uses stdout as a structured side-channel:

```
Go → fmt.Fprintln(os.Stdout, "EVENT cells_changed")
   → electron/main.js forwardGoOutput() parses "EVENT " prefix
   → win.webContents.send('go:event', eventName)
   → preload onGoEvent bridge
   → frontend refreshAllCells() / refreshAgentStatus()
```

This works but is fragile: any accidental `fmt.Println` in Go corrupts the channel, the protocol has no framing or versioning, and it breaks in standalone HTTP mode (AC4). It was documented as tech debt when added in Story 20.6.

**Transport decision:** SSE is chosen over WebSocket for Story 20.8. The events today (`cells_changed`, `session_changed`) are server→client push-only. SSE requires zero new Go dependencies, the browser `EventSource` handles reconnection natively (no client-side reconnect code needed), and the "SSE not production ready" criticisms apply only to hosted infrastructure (proxy buffering, HTTP/1.1 connection limits) — neither of which applies to a localhost Electron app. WebSocket is the correct future choice if GoSheet adds collaborative editing; see the `EventBroker` interface task below which makes that migration a concrete-type swap.

See full transport evaluation: `_bmad-output/planning-artifacts/research/technical-go-electron-push-transport-2026-03-14.md`

## Acceptance Criteria

1. **Given** a Go server event (cells changed, session changed), **when** it is emitted, **then** the renderer receives it via an SSE connection to `GET /api/events` — no stdout parsing involved.

2. **Given** the new transport is in place, **when** any Go code accidentally writes to stdout, **then** it does NOT affect the event channel.

3. **Given** the replacement is complete, **when** the codebase is inspected, **then** `forwardGoOutput` in `electron/main.js` no longer parses `EVENT ` prefixes, and all four `fmt.Fprintln(os.Stdout, "EVENT ...")` calls are removed from `api/handlers_agent.go`.

4. **Given** the Go server runs in non-Electron mode (standalone HTTP, browser), **when** a client connects to `GET /api/events`, **then** it receives SSE events correctly — no Electron dependency.

5. **Given** the Electron renderer connects to `GET /api/events`, **when** the Go server is restarted or the connection drops, **then** the browser's native `EventSource` reconnects automatically (no manual reconnect code needed).

6. **Given** an `EventBroker` interface is defined, **when** future collaborative WebSocket support is added, **then** the broker implementation can be swapped without touching application handler code.

7. **Given** the Go server shuts down (SIGTERM), **when** shutdown is initiated, **then** all active SSE connections are closed cleanly and no goroutines are leaked.

8. **Given** a slow or dead SSE client, **when** the broker attempts to deliver an event and the client's channel is full, **then** the event is dropped (non-blocking send) without blocking delivery to other clients; if misses exceed a threshold, the client is disconnected.

## Tasks / Subtasks

- [ ] **Task 1**: Define `EventBroker` interface in `controller/event_broker.go` (AC: 6)
  - [ ] Interface with `Broadcast(event Event)` and `Close()` methods
  - [ ] `Event` struct: `Name string`, `Data string` (JSON payload, omitempty)

- [ ] **Task 2**: Implement `SSEBroker` satisfying `EventBroker` in `api/sse_broker.go` (AC: 1, 5, 7, 8)
  - [ ] Broker struct with `clients map[*sseClient]struct{}`, `mu sync.Mutex`, `ch chan Event`, `quit chan struct{}`
  - [ ] `Start()` goroutine: fan-out loop, non-blocking sends, slow-client miss counter → disconnect
  - [ ] `ServeHTTP`: set SSE headers, register client, select on `c.ch` and `r.Context().Done()`
  - [ ] `Close()`: close quit channel, drain clients

- [ ] **Task 3**: Wire SSE broker into `server/main.go` (AC: 4, 7)
  - [ ] Create broker at startup, inject into `api.Server`
  - [ ] Register `GET /api/events` endpoint (auth-required — same `wrap()` as all other API endpoints)
  - [ ] Wire `SIGTERM` → `http.Server.Shutdown(ctx)` → `broker.Close()` (this also fixes `tech-debt-audit-no-graceful-shutdown`: call `ctrl.Agent.Audit.Close()` in the same shutdown sequence)

- [ ] **Task 4**: Replace `fmt.Fprintln(os.Stdout, "EVENT ...")` with `broker.Broadcast(...)` (AC: 1, 2, 3)
  - [ ] `api/handlers_agent.go:186` — `HandleAgentEnd` → `broker.Broadcast(Event{Name: "session_changed"})`
  - [ ] `api/handlers_agent.go:210` — `HandleAgentRollback` → same
  - [ ] `api/handlers_agent.go:235` — `HandleAdminEndSession` → same
  - [ ] `api/handlers_agent.go:465` — `HandleAgentPatch` → `broker.Broadcast(Event{Name: "cells_changed"})`
  - [ ] Remove `"os"` from imports if no longer used

- [ ] **Task 5**: Remove `EVENT ` prefix parsing from `electron/main.js` (AC: 3)
  - [ ] Simplify `forwardGoOutput` — remove the `line.startsWith('EVENT ')` branch entirely
  - [ ] All Go stdout/stderr now flows to `logStream` and `process.stderr` unconditionally

- [ ] **Task 6**: Update frontend event subscription in `frontend/app.js` (AC: 1, 4)
  - [ ] Replace `window.electronAPI?.onGoEvent?.(...)` handler with `new EventSource(...)`
  - [ ] Fetch the port (already available as `window.__GOSHEET_PORT__` or equivalent) to construct the SSE URL
  - [ ] Auth: pass the bootstrap token as a query param `?token=<bootstrapToken>` (ticket pattern — token is already available in the renderer as `window.__GOSHEET_TOKEN__` injected via `additionalArguments` in `electron/main.js`)
  - [ ] Event listeners: `evtSource.addEventListener('cells_changed', ...)` and `evtSource.addEventListener('session_changed', ...)`
  - [ ] Keep the initial `refreshAgentStatus()` call on load

- [ ] **Task 7**: Remove `onGoEvent` bridge from `electron/preload.js` (AC: 3)
  - [ ] Remove `onGoEvent: (callback) => { ipcRenderer.removeAllListeners('go:event'); ipcRenderer.on(...) }` from `contextBridge.exposeInMainWorld`

- [ ] **Task 8**: Write Go unit tests for `SSEBroker` (AC: 1, 5, 7, 8)
  - [ ] `TestSSEBrokerFanOut` — two clients both receive a broadcast event
  - [ ] `TestSSEBrokerHeaders` — verify `Content-Type: text/event-stream`, `Cache-Control: no-cache`
  - [ ] `TestSSEBrokerClientDisconnect` — cancel request context, assert client channel is removed
  - [ ] `TestSSEBrokerSlowClientDrop` — fill client channel, assert non-blocking drop (does not hang)
  - [ ] `TestSSEBrokerGracefulShutdown` — call `Close()`, assert handler goroutine exits via `ctx`

- [ ] **Task 9**: Update design doc §12 in `_bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md`

## Dev Notes

### Transport Decision Summary

**SSE is chosen for Story 20.8.** Full evaluation in `_bmad-output/planning-artifacts/research/technical-go-electron-push-transport-2026-03-14.md`.

- Unix socket and Electron IPC ruled out: both break standalone HTTP mode (AC4).
- WebSocket deferred: correct for future collaborative editing, but overkill for push-only events today. The `EventBroker` interface (Task 1) makes the future WebSocket migration a concrete-type swap.
- SSE: zero new dependencies, browser-native reconnect, works in Electron 40.x (`EventSource` regression from v32 was fully fixed in v34+, confirmed in Electron issue #44458 and PR #44475).

### Current Event Emitters — All 4 Must Be Migrated

```
api/handlers_agent.go:186   HandleAgentEnd          → EVENT session_changed
api/handlers_agent.go:210   HandleAgentRollback     → EVENT session_changed
api/handlers_agent.go:235   HandleAdminEndSession   → EVENT session_changed
api/handlers_agent.go:465   HandleAgentPatch        → EVENT cells_changed
```

### Current Consumers — All Must Be Removed/Replaced

```
electron/main.js:399-419    forwardGoOutput()       → parse "EVENT " prefix, relay via IPC
electron/preload.js:252-254 onGoEvent bridge        → ipcRenderer.on('go:event', ...)
frontend/app.js:1093-1099   onGoEvent handler       → cells_changed / session_changed
```

### SSE Broker Implementation Pattern

**Critical:** `httptest.ResponseRecorder` does NOT implement `http.Flusher` — SSE tests require `httptest.NewServer` with a real HTTP client. The handler must assert `http.Flusher` and fail fast if not supported (middleware can strip it).

```go
// controller/event_broker.go
type Event struct {
    Name string
    Data string // JSON payload, empty for simple notifications
}

type EventBroker interface {
    Broadcast(e Event)
    Close()
}
```

```go
// api/sse_broker.go
type sseClient struct {
    ch     chan Event
    misses int
}

type SSEBroker struct {
    mu      sync.Mutex
    clients map[*sseClient]struct{}
    quit    chan struct{}
}

func (b *SSEBroker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "streaming unsupported", http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.Header().Set("X-Accel-Buffering", "no") // nginx: disable response buffering

    c := &sseClient{ch: make(chan Event, 16)}
    b.mu.Lock(); b.clients[c] = struct{}{}; b.mu.Unlock()
    defer func() { b.mu.Lock(); delete(b.clients, c); b.mu.Unlock() }()

    ctx := r.Context()
    for {
        select {
        case <-ctx.Done():
            return
        case ev := <-c.ch:
            if ev.Data != "" {
                fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Name, ev.Data)
            } else {
                fmt.Fprintf(w, "event: %s\ndata: {}\n\n", ev.Name)
            }
            flusher.Flush()
        }
    }
}

func (b *SSEBroker) Broadcast(ev Event) {
    b.mu.Lock()
    defer b.mu.Unlock()
    for c := range b.clients {
        select {
        case c.ch <- ev:
            c.misses = 0
        default:
            c.misses++
            // Force-disconnect after 10 consecutive drops (client reconnects via EventSource)
            if c.misses > 10 {
                delete(b.clients, c)
            }
        }
    }
}
```

**Never block in `Broadcast`.** Always use `select { case ch <- ev: default: }`. A blocking send in the lock region would stall all other clients.

### Auth on `GET /api/events`

The SSE endpoint is registered with `requireAuth: true` — same `wrap()` as all other `/api/*` routes. The bootstrap token is the credential.

The renderer already has the token injected via `additionalArguments` in `electron/main.js` (Story 20.1). Use it as a query param:

```js
const evtSource = new EventSource(`http://127.0.0.1:${port}/api/events?token=${token}`);
```

The existing `authMiddleware` in `api/handlers.go` already accepts `?token=` query param (see `agentTokenFromRequest` pattern — the bootstrap token middleware uses the same logic). Verify this works for the bootstrap token specifically; if not, extend `authMiddleware` to also read `r.URL.Query().Get("token")`.

**Note:** `EventSource` cannot set `Authorization: Bearer` headers — query param is the correct auth pattern for SSE (the token is short-lived relative to the session, and this is localhost).

### Shutdown Safety — Simultaneous Fix for `tech-debt-audit-no-graceful-shutdown`

Story 20.8 Task 3 wires graceful shutdown. In the same change, call `ctrl.Agent.Audit.Close()`:

```go
// server/main.go — add after existing server setup
sigCh := make(chan os.Signal, 1)
signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
go func() {
    <-sigCh
    shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    _ = httpSrv.Shutdown(shutCtx)  // closes all SSE handler goroutines via ctx.Done()
    broker.Close()
    ctrl.Agent.Audit.Close()       // flush pending audit log events
}()
```

This requires changing from `http.Serve(listener, nil)` to `httpSrv.ListenAndServe()` with an `http.Server` struct. The listener is already created; use `httpSrv.Serve(listener)` instead.

### Frontend Port/Token Access

Verify how the renderer currently accesses `port` and `token`. From Story 20.1 / existing code:
- Port is passed via `additionalArguments` in `electron/main.js` as `--gosheet-port=<n>` or similar, then read in the renderer.
- Token is similarly injected.

Check `electron/main.js` around the `BrowserWindow` creation and `preload.js` to confirm the exact variable names (`window.__GOSHEET_PORT__`, `window.__GOSHEET_TOKEN__`, or other). The frontend `api-client.js` already uses both — follow that pattern exactly.

### Electron IPC Cleanup

After removing `onGoEvent` from `preload.js`, also remove `win.webContents.send('go:event', eventName)` from `electron/main.js` if it's no longer needed. The `forwardGoOutput` function itself can be simplified to unconditionally forward all output to `logStream` and `process.stderr`.

### `EventSource` in Electron 40.x

Confirmed working. The `EventSource` global was broken in Electron 32 (issue #44458) but was fixed in PR #44475 and backported to v32–33. Electron 40.7.0 is well past the fix. With `contextIsolation: true` (GoSheet's current config), the renderer uses Blink's `EventSource` as a standard browser API — no polyfill or preload bridging needed.

### Testing Pattern for SSE

```go
// In tests — use httptest.NewServer, NOT httptest.NewRecorder
func TestSSEBrokerFanOut(t *testing.T) {
    broker := NewSSEBroker()
    ts := httptest.NewServer(broker)
    defer ts.Close()

    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
    defer cancel()
    req, _ := http.NewRequestWithContext(ctx, "GET", ts.URL, nil)
    resp, err := http.DefaultClient.Do(req)
    require.NoError(t, err)
    defer resp.Body.Close()

    assert.Equal(t, "text/event-stream", resp.Header.Get("Content-Type"))

    broker.Broadcast(Event{Name: "cells_changed"})
    // Read one event from resp.Body and assert content
    ...
}
```

### Project Structure Notes

- New files: `controller/event_broker.go` (interface + Event struct), `api/sse_broker.go` (SSEBroker implementation)
- Modified files: `api/handlers_agent.go` (remove 4 `fmt.Fprintln` EVENT calls, add broker calls), `server/main.go` (create broker, register endpoint, wire shutdown), `electron/main.js` (simplify `forwardGoOutput`), `electron/preload.js` (remove `onGoEvent`), `frontend/app.js` (replace `onGoEvent` handler with `EventSource`)
- New test file: `api/sse_broker_test.go`

### References

- [Source: _bmad-output/planning-artifacts/research/technical-go-electron-push-transport-2026-03-14.md] — Full transport evaluation; SSE vs WebSocket; EventBroker interface rationale; auth patterns; Playwright testing notes
- [Source: api/handlers_agent.go:186,210,235,465] — Current `fmt.Fprintln(os.Stdout, "EVENT ...")` emitters
- [Source: electron/main.js:399-421] — `forwardGoOutput` EVENT parsing
- [Source: electron/preload.js:251-255] — `onGoEvent` bridge
- [Source: frontend/app.js:1093-1099] — Current `onGoEvent` handler
- [Source: server/main.go] — `http.Serve(listener, nil)` to be replaced with `http.Server.Serve(listener)` for graceful shutdown
- [Source: controller/audit.go] — `AuditLogger.Close()` — call in shutdown sequence
- [Source: _bmad-output/implementation-artifacts/20-7-audit-log.md] — `tech-debt-audit-no-graceful-shutdown` note
- [Source: _bmad-output/planning-artifacts/research/technical-epic20-agentic-api-design-2026-03-14.md#12] — Design gap §12 this story resolves

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `controller/event_broker.go` — `Event` struct, `EventBroker` interface
- `api/sse_broker.go` — `SSEBroker` implementation
- `api/sse_broker_test.go` — unit tests
- `api/handlers_agent.go` — remove 4 stdout EVENT calls, add broker.Broadcast calls
- `server/main.go` — create broker, register /api/events, wire SIGTERM shutdown
- `electron/main.js` — simplify forwardGoOutput (remove EVENT branch)
- `electron/preload.js` — remove onGoEvent bridge
- `frontend/app.js` — replace onGoEvent handler with EventSource subscription
