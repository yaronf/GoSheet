package controller

// Event represents a server-sent event to be pushed to connected clients.
type Event struct {
	Name string // SSE event name (e.g. "cells_changed", "session_changed")
	Data string // JSON payload; empty means send "{}"
}

// EventBroker is the abstraction for server→client push events.
// The concrete implementation is SSEBroker (api/sse_broker.go).
// Replacing it with a WebSocket broker in the future only requires
// changing the concrete type in server/main.go — no handler code changes.
type EventBroker interface {
	Broadcast(e Event)
	Close()
}
