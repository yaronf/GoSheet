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
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	"gosheet/api"
	"gosheet/controller"
	"gosheet/logutil"
)

// debugShutdownHandler cleanly exits the process. Only registered when --verbose is set.
func debugShutdownHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.(http.Flusher).Flush()
	os.Exit(0)
}

func main() {
	verbose := flag.Bool("verbose", false, "Enable verbose (debug) logging")
	flag.Parse()

	// Story 16.8: DEBUG=1 env var is no longer supported; use --verbose flag.
	logutil.Verbose = *verbose
	log.SetFlags(0)
	gw := &logutil.GoWriter{W: os.Stderr}
	log.SetOutput(gw)
	logutil.SetWriter(os.Stderr) // Debugf/Debugln write directly to stderr, bypassing GoWriter's [INFO] wrap

	ctrl := controller.NewAppController()
	srv := api.NewServer(ctrl)

	// cors wraps handlers with permissive CORS headers. The wildcard origin is
	// intentional: this server runs locally and is accessed only by the Electron
	// renderer (or a local browser for development). There is no cross-origin
	// threat model for a localhost-only service.
	cors := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next(w, r)
		}
	}

	http.HandleFunc("/", cors(srv.ServeStatic))
	http.HandleFunc("/api/cell/value", cors(srv.HandleGetCellValue))
	http.HandleFunc("/api/cell/raw", cors(srv.HandleGetCellRawValue))
	http.HandleFunc("/api/cell/set", cors(srv.HandleSetCellValue))
	http.HandleFunc("/api/cell/ref", cors(srv.HandleGetCellRef))
	http.HandleFunc("/api/cells/all", cors(srv.HandleGetAllCells))
	http.HandleFunc("/api/file/save", cors(srv.HandleSaveFile))
	http.HandleFunc("/api/file/load", cors(srv.HandleLoadFile))
	http.HandleFunc("/api/file/new", cors(srv.HandleNewFile))
	http.HandleFunc("/api/file/status", cors(srv.HandleFileStatus))
	http.HandleFunc("/api/file/download", cors(srv.HandleDownloadFile))
	http.HandleFunc("/api/file/upload", cors(srv.HandleUploadFile))
	http.HandleFunc("/api/csv/preview", cors(srv.HandleCSVPreview))
	http.HandleFunc("/api/csv/import", cors(srv.HandleCSVImport))
	http.HandleFunc("/api/csv/export", cors(srv.HandleCSVExport))
	http.HandleFunc("/api/merges", cors(srv.HandleGetMerges))
	http.HandleFunc("/api/merge", cors(srv.HandleSetMerge))
	http.HandleFunc("/api/unmerge", cors(srv.HandleUnmerge))
	http.HandleFunc("/api/cell/style", cors(srv.HandleApplyCellStyle))
	http.HandleFunc("/api/range/style", cors(srv.HandleApplyRangeStyle))
	http.HandleFunc("/api/cell/alignment", cors(srv.HandleSetCellAlignment))
	http.HandleFunc("/api/range/alignment", cors(srv.HandleSetRangeAlignment))
	http.HandleFunc("/api/range/clear", cors(srv.HandleClearRange))
	http.HandleFunc("/api/range/set", cors(srv.HandleSetRangeValues))
	http.HandleFunc("/api/format/cleanup", cors(srv.HandleFormatCleanup))
	http.HandleFunc("/api/row/insert", cors(srv.HandleInsertRow))
	http.HandleFunc("/api/column/insert", cors(srv.HandleInsertColumn))
	http.HandleFunc("/api/row/delete", cors(srv.HandleDeleteRow))
	http.HandleFunc("/api/column/delete", cors(srv.HandleDeleteColumn))
	http.HandleFunc("/api/styles", cors(srv.HandleStyles))
	http.HandleFunc("/api/styles/", cors(srv.HandleStyleByID))
	http.HandleFunc("/api/undo", cors(srv.HandleUndo))
	http.HandleFunc("/api/redo", cors(srv.HandleRedo))
	if logutil.Verbose {
		http.HandleFunc("/api/debug/shutdown", cors(debugShutdownHandler))
	}

	// Bind to an OS-assigned ephemeral port (Story 16.5)
	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		log.Fatalf("Failed to bind port: %v", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port

	// Announce the bound port to Electron via fd 3 (dedicated IPC pipe, not stdout).
	// Stdout/stderr remain for human-readable logs — using a separate fd prevents
	// accidental log output from corrupting the port signal.
	portPipe := os.NewFile(3, "port-pipe")
	if _, err := fmt.Fprintf(portPipe, "PORT=%d\n", port); err != nil {
		log.Printf("Warning: failed to write port to fd 3: %v (running standalone?)", err)
	}
	_ = portPipe.Close()

	log.Printf("GoSheet server running at http://localhost:%d\n", port)
	logutil.Debugf("Open http://localhost:%d in your browser\n", port)

	if err := http.Serve(listener, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
