// Package logutil provides debug logging gated by verbosity.
// When Verbose is false, Debug/Debugf/Debugln are no-ops.
//
// Story 16.8: Unified log format — all output uses:
//
//	[ISO-timestamp] [LEVEL] [go] message
//
// GoWriter is attached via log.SetOutput in server/main.go so that log.Printf
// lines get [INFO ] prefix automatically.
// Debugf/Debugln write directly to GoWriter.W (bypassing stdlib log) to emit
// [DEBUG] without being double-prefixed by GoWriter's [INFO ] wrapper.
package logutil

import (
	"fmt"
	"io"
	"time"
)

// Verbose enables debug-level logging when true.
var Verbose bool

// isoNow returns the current UTC time in RFC3339 format (second precision).
func isoNow() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// writer is the destination used by Debugf/Debugln.
// Set to GoWriter.W when GoWriter is attached; falls back to nil (no-op when not Verbose).
var writer io.Writer

// Debugf logs at DEBUG level when Verbose is true (like log.Printf).
func Debugf(format string, v ...any) {
	if Verbose && writer != nil {
		line := fmt.Sprintf("[%s] [DEBUG] [go] "+format+"\n", append([]any{isoNow()}, v...)...)
		writer.Write([]byte(line)) //nolint:errcheck
	}
}

// Debugln logs at DEBUG level when Verbose is true (like log.Println).
func Debugln(v ...any) {
	if Verbose && writer != nil {
		line := fmt.Sprintf("[%s] [DEBUG] [go] %s\n", isoNow(), fmt.Sprint(v...))
		writer.Write([]byte(line)) //nolint:errcheck
	}
}

// GoWriter is an io.Writer that prepends [ISO] [INFO ] [go] to every line.
// Attach via log.SetOutput(&logutil.GoWriter{W: os.Stderr}).
// Also sets logutil.writer so Debugf/Debugln write directly to W, avoiding
// the double-prefix that would result from routing through the stdlib log package.
type GoWriter struct {
	W io.Writer
}

func (gw *GoWriter) Write(p []byte) (n int, err error) {
	ts := isoNow()
	line := fmt.Sprintf("[%s] [INFO ] [go] %s", ts, p)
	return gw.W.Write([]byte(line))
}

// Warnf logs at WARN level unconditionally (not gated by Verbose).
// Use for expected error conditions: user input errors, validation failures,
// formula evaluation errors — things that are handled and returned to the client.
func Warnf(format string, v ...any) {
	if writer != nil {
		line := fmt.Sprintf("[%s] [WARN ] [go] "+format+"\n", append([]any{isoNow()}, v...)...)
		writer.Write([]byte(line)) //nolint:errcheck
	}
}

// Errorf logs at ERROR level unconditionally (not gated by Verbose).
// Use for unexpected failures: I/O errors, system errors, internal invariant
// violations — things the server cannot handle normally.
func Errorf(format string, v ...any) {
	if writer != nil {
		line := fmt.Sprintf("[%s] [ERROR] [go] "+format+"\n", append([]any{isoNow()}, v...)...)
		writer.Write([]byte(line)) //nolint:errcheck
	}
}

// SetWriter configures the writer used by Debugf/Debugln/Errorf.
// Called by server/main.go after attaching GoWriter to the stdlib log package.
func SetWriter(w io.Writer) {
	writer = w
}
