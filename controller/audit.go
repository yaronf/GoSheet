package controller

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"gosheet/logutil"
)

// AuditEvent is one line in the append-only audit log.
type AuditEvent struct {
	Ts          string `json:"ts"`
	AgentID     string `json:"agentId"`
	Event       string `json:"event"` // session_open | patch | commit | end | rollback
	FilePath    string `json:"filePath"`
	Description string `json:"description,omitempty"`
	OpsCount    int    `json:"opsCount,omitempty"`
	Outcome     string `json:"outcome,omitempty"` // applied | rejected
}

// AuditLogger appends JSONL records to a file non-blocking via a buffered channel.
type AuditLogger struct {
	ch   chan AuditEvent
	once sync.Once
	wg   sync.WaitGroup
}

// NewAuditLogger creates an AuditLogger that writes to dir/agent-audit.jsonl.
// If dir is empty, os.UserConfigDir()/GoSheet is used.
func NewAuditLogger(dir string) *AuditLogger {
	if dir == "" {
		cfg, err := os.UserConfigDir()
		if err != nil {
			cfg = os.TempDir()
		}
		dir = filepath.Join(cfg, "GoSheet")
	}

	al := &AuditLogger{
		ch: make(chan AuditEvent, 256),
	}

	logPath := filepath.Join(dir, "agent-audit.jsonl")
	al.wg.Add(1)
	go al.run(logPath)
	return al
}

func (al *AuditLogger) run(logPath string) {
	defer al.wg.Done()

	if err := os.MkdirAll(filepath.Dir(logPath), 0o755); err != nil {
		logutil.Warnf("audit: cannot create log dir: %v", err)
		// drain channel without writing
		for range al.ch {
		}
		return
	}

	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		logutil.Warnf("audit: cannot open %s: %v", logPath, err)
		for range al.ch {
		}
		return
	}
	defer f.Close()

	for ev := range al.ch {
		line, err := json.Marshal(ev)
		if err != nil {
			logutil.Warnf("audit: marshal error: %v", err)
			continue
		}
		if _, err := f.Write(append(line, '\n')); err != nil {
			logutil.Warnf("audit: write error: %v", err)
		}
	}
}

// Log enqueues an audit event. Never blocks the caller.
func (al *AuditLogger) Log(ev AuditEvent) {
	if ev.Ts == "" {
		ev.Ts = time.Now().UTC().Format(time.RFC3339)
	}
	select {
	case al.ch <- ev:
	default:
		logutil.Warnf("audit: channel full, dropping event %s for agent %s", ev.Event, ev.AgentID)
	}
}

// Close flushes all pending events and stops the background goroutine.
func (al *AuditLogger) Close() {
	al.once.Do(func() {
		close(al.ch)
	})
	al.wg.Wait()
}
