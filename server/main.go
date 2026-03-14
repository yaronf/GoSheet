// GoSheet HTTP Server - Clean REST API backend
//
// Story 16.8: Unified log format across all three layers (Go, Electron, Renderer):
//
//	[ISO-timestamp] [LEVEL] [go] message
//
// log.SetFlags(0) disables the stdlib date/time prefix. logutil.GoWriter prepends
// [ISO] [INFO ] [go] to every log.Printf line. logutil.Debugf/Debugln emit [DEBUG].
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gosheet/api"
	"gosheet/controller"
	"gosheet/logutil"
)

// bootstrapToken is generated once at startup and used to authenticate all API calls.
// It is written to fd 3 alongside the port so Electron can inject it into the renderer.
var bootstrapToken string

// debugShutdownHandler triggers graceful shutdown. Only registered when --verbose is set.
// Sends SIGINT to self so the signal handler in main() runs the full shutdown sequence
// (http.Server.Shutdown → broker.Close → audit.Close) instead of os.Exit bypassing it.
func debugShutdownHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.(http.Flusher).Flush()
	p, _ := os.FindProcess(os.Getpid())
	_ = p.Signal(os.Interrupt)
}

func main() {
	verbose := flag.Bool("verbose", false, "Enable verbose (debug) logging")
	userDataDir := flag.String("userData", "", "Path to Electron userData directory (for audit log)")
	flag.Parse()

	// Story 16.8: DEBUG=1 env var is no longer supported; use --verbose flag.
	logutil.Verbose = *verbose
	log.SetFlags(0)
	gw := &logutil.GoWriter{W: os.Stderr}
	log.SetOutput(gw)
	logutil.SetWriter(os.Stderr) // Debugf/Debugln write directly to stderr, bypassing GoWriter's [INFO] wrap

	ctrl := controller.NewAppControllerWithUserData(*userDataDir)

	// Story 20.1: Generate bootstrap token for API auth.
	// In test mode auth is bypassed, so we skip generation to keep tests simple.
	var err error
	if os.Getenv("NODE_ENV") != "test" {
		bootstrapToken, err = controller.GenerateToken()
		if err != nil {
			log.Fatalf("failed to generate bootstrap token: %v", err)
		}
	}

	broker := api.NewSSEBroker()
	srv := api.NewServer(ctrl, bootstrapToken)
	srv.Broker = broker

	// cors wraps handlers with permissive CORS headers. The wildcard origin is
	// intentional: this server runs locally and is accessed only by the Electron
	// renderer (or a local browser for development). There is no cross-origin
	// threat model for a localhost-only service.
	// wrap applies CORS headers and (for /api/* routes) bearer token auth.
	// Static file routes skip auth so the frontend loads without a token.
	wrap := func(next http.HandlerFunc, requireAuth bool) http.HandlerFunc {
		h := func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next(w, r)
		}
		if requireAuth {
			return srv.AuthMiddleware(h)
		}
		return h
	}

	http.HandleFunc("/", wrap(srv.ServeStatic, false))
	http.HandleFunc("/api/cell/value", wrap(srv.HandleGetCellValue, true))
	http.HandleFunc("/api/cell/raw", wrap(srv.HandleGetCellRawValue, true))
	http.HandleFunc("/api/cell/set", wrap(srv.HandleSetCellValue, true))
	http.HandleFunc("/api/cell/ref", wrap(srv.HandleGetCellRef, true))
	http.HandleFunc("/api/cells/all", wrap(srv.HandleGetAllCells, true))
	http.HandleFunc("/api/file/save", wrap(srv.HandleSaveFile, true))
	http.HandleFunc("/api/file/load", wrap(srv.HandleLoadFile, true))
	http.HandleFunc("/api/file/new", wrap(srv.HandleNewFile, true))
	http.HandleFunc("/api/file/status", wrap(srv.HandleFileStatus, true))
	http.HandleFunc("/api/file/download", wrap(srv.HandleDownloadFile, true))
	http.HandleFunc("/api/file/upload", wrap(srv.HandleUploadFile, true))
	http.HandleFunc("/api/csv/preview", wrap(srv.HandleCSVPreview, true))
	http.HandleFunc("/api/csv/import", wrap(srv.HandleCSVImport, true))
	http.HandleFunc("/api/csv/export", wrap(srv.HandleCSVExport, true))
	http.HandleFunc("/api/merges", wrap(srv.HandleGetMerges, true))
	http.HandleFunc("/api/merge", wrap(srv.HandleSetMerge, true))
	http.HandleFunc("/api/unmerge", wrap(srv.HandleUnmerge, true))
	http.HandleFunc("/api/cell/style", wrap(srv.HandleApplyCellStyle, true))
	http.HandleFunc("/api/range/style", wrap(srv.HandleApplyRangeStyle, true))
	http.HandleFunc("/api/cell/alignment", wrap(srv.HandleSetCellAlignment, true))
	http.HandleFunc("/api/range/alignment", wrap(srv.HandleSetRangeAlignment, true))
	http.HandleFunc("/api/range/clear", wrap(srv.HandleClearRange, true))
	http.HandleFunc("/api/range/clear-format", wrap(srv.HandleClearRangeFormat, true))
	http.HandleFunc("/api/range/set", wrap(srv.HandleSetRangeValues, true))
	http.HandleFunc("/api/format/cleanup", wrap(srv.HandleFormatCleanup, true))
	http.HandleFunc("/api/row/insert", wrap(srv.HandleInsertRow, true))
	http.HandleFunc("/api/column/insert", wrap(srv.HandleInsertColumn, true))
	http.HandleFunc("/api/row/delete", wrap(srv.HandleDeleteRow, true))
	http.HandleFunc("/api/column/delete", wrap(srv.HandleDeleteColumn, true))
	http.HandleFunc("/api/styles", wrap(srv.HandleStyles, true))
	http.HandleFunc("/api/styles/", wrap(srv.HandleStyleByID, true))
	http.HandleFunc("/api/undo", wrap(srv.HandleUndo, true))
	http.HandleFunc("/api/redo", wrap(srv.HandleRedo, true))
	http.HandleFunc("/api/formula/shift", wrap(srv.HandleShiftFormula, true))
	http.HandleFunc("/api/agent/token", wrap(srv.HandleAgentToken, true))
	http.HandleFunc("/api/agent/bootstrap", wrap(srv.HandleAgentBootstrap, true))
	http.HandleFunc("/api/agent/commit", wrap(srv.HandleAgentCommit, true))
	http.HandleFunc("/api/agent/end", wrap(srv.HandleAgentEnd, true))
	http.HandleFunc("/api/agent/rollback", wrap(srv.HandleAgentRollback, true))
	http.HandleFunc("/api/agent/workbook", wrap(srv.HandleAgentWorkbook, true))
	http.HandleFunc("/api/agent/range", wrap(srv.HandleAgentRange, true))
	http.HandleFunc("/api/agent/patch", wrap(srv.HandleAgentPatch, true))
	http.HandleFunc("/api/agent/session/status", wrap(srv.HandleAgentSessionStatus, true))
	http.HandleFunc("/api/agent/session/end", wrap(srv.HandleAdminEndSession, true))
	http.HandleFunc("/api/events", wrap(broker.ServeHTTP, true))
	if logutil.Verbose {
		http.HandleFunc("/api/debug/shutdown", wrap(debugShutdownHandler, false))
	}

	// Bind to an OS-assigned ephemeral port (Story 16.5)
	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		log.Fatalf("Failed to bind port: %v", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port

	// Announce the bound port (and bootstrap token) to Electron via fd 3.
	// Stdout/stderr remain for human-readable logs — using a separate fd prevents
	// accidental log output from corrupting the port signal.
	portPipe := os.NewFile(3, "port-pipe")
	msg := fmt.Sprintf("PORT=%d\n", port)
	if bootstrapToken != "" {
		msg += fmt.Sprintf("TOKEN=%s\n", bootstrapToken)
	}
	if _, err := fmt.Fprint(portPipe, msg); err != nil {
		logutil.Warnf("failed to write port/token to fd 3: %v (running standalone?)", err)
	}
	_ = portPipe.Close()

	logutil.Debugf("GoSheet server running at http://localhost:%d\n", port)

	httpSrv := &http.Server{}

	// Graceful shutdown: SIGTERM / SIGINT → Shutdown → broker.Close → audit.Close
	// This also fixes tech-debt-audit-no-graceful-shutdown (up to 256 buffered events
	// could be lost on SIGKILL; calling audit.Close() flushes the ring buffer).
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigCh
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(shutCtx) // closes all SSE handler goroutines via ctx.Done()
		broker.Close()
		ctrl.Audit.Close()
	}()

	if err := httpSrv.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
