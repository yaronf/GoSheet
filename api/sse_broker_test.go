package api

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gosheet/controller"
)

// readSSEEvent reads one non-comment SSE event block (terminated by blank line)
// from the reader, skipping SSE comment lines (":...") and keepalives.
// Timeout is enforced by the request context: when the context expires, the
// underlying HTTP connection is closed, causing ReadString to return an error.
func readSSEEvent(t *testing.T, r *bufio.Reader) string {
	t.Helper()
	var lines []string
	for {
		line, err := r.ReadString('\n')
		require.NoError(t, err, "reading SSE stream")
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			if len(lines) > 0 {
				return strings.Join(lines, "\n")
			}
			continue
		}
		if strings.HasPrefix(line, ":") {
			continue
		}
		lines = append(lines, line)
	}
}

// TestSSEBrokerHeaders verifies SSE headers are set on connection.
func TestSSEBrokerHeaders(t *testing.T) {
	broker := NewSSEBroker()
	ts := httptest.NewServer(broker)
	defer ts.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL, nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, "text/event-stream", resp.Header.Get("Content-Type"))
	assert.Equal(t, "no-cache", resp.Header.Get("Cache-Control"))
}

// TestSSEBrokerFanOut verifies that a broadcast reaches all connected clients.
func TestSSEBrokerFanOut(t *testing.T) {
	broker := NewSSEBroker()
	ts := httptest.NewServer(broker)
	defer ts.Close()

	// Connect two clients with independent timeouts
	ctx1, cancel1 := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel1()
	ctx2, cancel2 := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel2()

	makeClient := func(ctx context.Context) *bufio.Reader {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL, nil)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		t.Cleanup(func() { resp.Body.Close() })
		return bufio.NewReader(resp.Body)
	}

	r1 := makeClient(ctx1)
	r2 := makeClient(ctx2)

	// Wait for both clients to register
	require.Eventually(t, func() bool {
		broker.mu.Lock()
		defer broker.mu.Unlock()
		return len(broker.clients) == 2
	}, time.Second, 5*time.Millisecond, "both clients should register")

	broker.Broadcast(controller.Event{Name: "cells_changed"})

	ev1 := readSSEEvent(t, r1)
	ev2 := readSSEEvent(t, r2)

	assert.Contains(t, ev1, "event: cells_changed")
	assert.Contains(t, ev2, "event: cells_changed")
}

// TestSSEBrokerClientDisconnect verifies that cancelling the request context
// removes the client from the broker's registry.
func TestSSEBrokerClientDisconnect(t *testing.T) {
	broker := NewSSEBroker()
	ts := httptest.NewServer(broker)
	defer ts.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL, nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)

	// Wait for client to register
	require.Eventually(t, func() bool {
		broker.mu.Lock()
		defer broker.mu.Unlock()
		return len(broker.clients) == 1
	}, time.Second, 5*time.Millisecond, "one client should be registered")

	// Cancel the context → ServeHTTP exits → client deregistered
	cancel()
	resp.Body.Close()

	// Wait for deregistration
	require.Eventually(t, func() bool {
		broker.mu.Lock()
		defer broker.mu.Unlock()
		return len(broker.clients) == 0
	}, time.Second, 10*time.Millisecond, "client should be deregistered after disconnect")
}

// TestSSEBrokerSlowClientDrop verifies that a slow client (full channel) does not
// block delivery to other clients and is eventually force-disconnected.
func TestSSEBrokerSlowClientDrop(t *testing.T) {
	broker := NewSSEBroker()

	// Insert a synthetic slow client with a full channel (capacity 16)
	slow := &sseClient{ch: make(chan controller.Event, 16), misses: 0}
	broker.mu.Lock()
	broker.clients[slow] = struct{}{}
	broker.mu.Unlock()

	// Fill the channel
	for range 16 {
		slow.ch <- controller.Event{Name: "x"}
	}

	// Broadcast (sseMissThreshold+1) more times — slow client should be dropped
	done := make(chan struct{})
	go func() {
		for range sseMissThreshold + 1 {
			broker.Broadcast(controller.Event{Name: "test"})
		}
		close(done)
	}()

	select {
	case <-done:
		// non-blocking Broadcast completed without hanging
	case <-time.After(time.Second):
		t.Fatal("Broadcast blocked on slow client")
	}

	broker.mu.Lock()
	_, stillPresent := broker.clients[slow]
	broker.mu.Unlock()
	assert.False(t, stillPresent, "slow client should have been force-disconnected")
}

// TestSSEBrokerGracefulShutdown verifies Close() empties the client map.
func TestSSEBrokerGracefulShutdown(t *testing.T) {
	broker := NewSSEBroker()
	ts := httptest.NewServer(broker)
	defer ts.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL, nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Wait for the client to register
	require.Eventually(t, func() bool {
		broker.mu.Lock()
		defer broker.mu.Unlock()
		return len(broker.clients) == 1
	}, time.Second, 5*time.Millisecond)

	broker.Close()

	broker.mu.Lock()
	count := len(broker.clients)
	broker.mu.Unlock()
	assert.Equal(t, 0, count, "Close() should drain the client map")
}
