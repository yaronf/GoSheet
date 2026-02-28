// GoSheet HTTP Server - Clean REST API backend
package main

import (
	"flag"
	"log"
	"net/http"
	"os"

	"gosheet/api"
	"gosheet/controller"
	"gosheet/logutil"
)

func main() {
	port := flag.String("port", "3000", "Port to run the server on")
	verbose := flag.Bool("verbose", false, "Enable verbose (debug) logging")
	flag.Parse()

	logutil.Verbose = *verbose || os.Getenv("DEBUG") == "1"
	log.SetOutput(os.Stdout)

	ctrl := controller.NewAppController()
	srv := api.NewServer(ctrl)

	cors := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

	log.Printf("GoSheet server running at http://localhost:%s\n", *port)
	logutil.Debugf("Open http://localhost:%s in your browser\n", *port)

	if err := http.ListenAndServe(":"+*port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
