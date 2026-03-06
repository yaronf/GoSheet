// Package logutil provides debug logging gated by verbosity.
// When Verbose is false, Debug/Debugf/Debugln are no-ops.
package logutil

import "log"

// Verbose enables debug-level logging when true.
var Verbose bool

// Debugf logs when Verbose is true (like log.Printf).
func Debugf(format string, v ...any) {
	if Verbose {
		log.Printf(format, v...)
	}
}

// Debugln logs when Verbose is true (like log.Println).
func Debugln(v ...any) {
	if Verbose {
		log.Println(v...)
	}
}
