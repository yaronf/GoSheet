package api

import (
	"fmt"
	"net/http"
	"sync"

	"gosheet/controller"
)

const sseMissThreshold = 10 // consecutive drops before force-disconnect

type sseClient struct {
	ch     chan controller.Event
	misses int
}

// SSEBroker implements controller.EventBroker using HTTP Server-Sent Events.
// It satisfies http.Handler so it can be registered directly as a route.
//
// Design notes:
//   - Broadcast holds the mutex only long enough to iterate and attempt non-blocking sends.
//     It never blocks inside the critical section, so a stalled client cannot stall others.
//   - Slow clients accumulate a miss counter; after sseMissThreshold consecutive drops
//     their channel is closed and they are removed. The ServeHTTP goroutine detects the
//     closed channel and exits.
//   - Close() closes all client channels and drains the map.
type SSEBroker struct {
	mu      sync.Mutex
	clients map[*sseClient]struct{}
}

// NewSSEBroker creates a ready-to-use SSEBroker.
func NewSSEBroker() *SSEBroker {
	return &SSEBroker{
		clients: make(map[*sseClient]struct{}),
	}
}

// Broadcast sends ev to all connected clients without blocking.
// Slow clients that miss more than sseMissThreshold events are force-disconnected.
func (b *SSEBroker) Broadcast(ev controller.Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for c := range b.clients {
		select {
		case c.ch <- ev:
			c.misses = 0
		default:
			c.misses++
			if c.misses > sseMissThreshold {
				close(c.ch)
				delete(b.clients, c)
			}
		}
	}
}

// Close closes all client channels and removes them from the map.
func (b *SSEBroker) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	for c := range b.clients {
		close(c.ch)
	}
	b.clients = make(map[*sseClient]struct{})
}

// ServeHTTP handles GET /api/events — SSE long-poll handler.
// Auth is enforced by the wrap() middleware in server/main.go; this handler
// only needs to set the correct SSE headers and stream events.
func (b *SSEBroker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "GET only", http.StatusMethodNotAllowed)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx/proxy response buffering

	// Send an SSE comment as a keepalive to flush the response headers immediately.
	// Without a first write, the HTTP client won't receive the 200 status until
	// the first event is broadcast, causing long hangs in low-traffic scenarios.
	_, _ = fmt.Fprintf(w, ": connected\n\n")
	flusher.Flush()

	c := &sseClient{ch: make(chan controller.Event, 16)}
	b.mu.Lock()
	b.clients[c] = struct{}{}
	b.mu.Unlock()

	defer func() {
		b.mu.Lock()
		delete(b.clients, c)
		b.mu.Unlock()
	}()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case ev, ok := <-c.ch:
			if !ok {
				return // channel closed by Broadcast (slow client) or Close()
			}
			data := ev.Data
			if data == "" {
				data = "{}"
			}
			_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Name, data)
			flusher.Flush()
		}
	}
}
