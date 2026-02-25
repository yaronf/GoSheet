// GoSheet HTTP Server - Clean REST API backend
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"gosheet/api"
	"gosheet/api/generated"
	"gosheet/controller"
	"gosheet/logutil"
)

var ctrl *controller.AppController

func main() {
	// Parse command line flags
	port := flag.String("port", "3000", "Port to run the server on")
	verbose := flag.Bool("verbose", false, "Enable verbose (debug) logging")
	flag.Parse()

	// Enable verbose logging from flag or DEBUG=1 env
	logutil.Verbose = *verbose || os.Getenv("DEBUG") == "1"

	// Log to stdout so Electron shows [Go Server] not [Go Server Error] for info messages
	log.SetOutput(os.Stdout)

	// Create controller with empty spreadsheet
	ctrl = controller.NewAppController()

	// Enable CORS for development
	http.HandleFunc("/", corsMiddleware(serveStatic))
	http.HandleFunc("/api/cell/value", corsMiddleware(handleGetCellValue))
	http.HandleFunc("/api/cell/raw", corsMiddleware(handleGetCellRawValue))
	http.HandleFunc("/api/cell/set", corsMiddleware(handleSetCellValue))
	http.HandleFunc("/api/cell/ref", corsMiddleware(handleGetCellRef))
	http.HandleFunc("/api/cells/all", corsMiddleware(handleGetAllCells))
	http.HandleFunc("/api/file/save", corsMiddleware(handleSaveFile))
	http.HandleFunc("/api/file/load", corsMiddleware(handleLoadFile))
	http.HandleFunc("/api/file/new", corsMiddleware(handleNewFile))
	http.HandleFunc("/api/file/status", corsMiddleware(handleFileStatus))
	http.HandleFunc("/api/file/download", corsMiddleware(handleDownloadFile))
	http.HandleFunc("/api/file/upload", corsMiddleware(handleUploadFile))
	http.HandleFunc("/api/csv/preview", corsMiddleware(handleCSVPreview))
	http.HandleFunc("/api/csv/import", corsMiddleware(handleCSVImport))
	http.HandleFunc("/api/csv/export", corsMiddleware(handleCSVExport))

	log.Printf("GoSheet server running at http://localhost:%s\n", *port)
	logutil.Debugf("Open http://localhost:%s in your browser\n", *port)

	if err := http.ListenAndServe(":"+*port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// CORS middleware for development
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
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

// Serve static files from frontend directory
func serveStatic(w http.ResponseWriter, r *http.Request) {
	// Determine frontend directory path
	// When run from Electron, cwd is the project root
	// When run standalone, cwd might be server/ directory
	frontendDir := getFrontendDir()

	// Disable caching in development mode
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	if r.URL.Path == "/" {
		http.ServeFile(w, r, frontendDir+"/index.html")
		return
	}
	http.ServeFile(w, r, frontendDir+r.URL.Path)
}

// Get frontend directory path (handles both Electron and standalone modes)
func getFrontendDir() string {
	// Log current working directory for debugging
	if cwd, err := os.Getwd(); err == nil {
		logutil.Debugf("Current working directory: %s", cwd)
	}

	// Try current directory first (Electron dev mode: cwd is project root)
	if _, err := os.Stat("frontend/index.html"); err == nil {
		logutil.Debugln("Found frontend at: frontend/")
		return "frontend"
	}

	// Try Resources/frontend (Electron packaged app: cwd is Resources/)
	if _, err := os.Stat("Resources/frontend/index.html"); err == nil {
		logutil.Debugln("Found frontend at: Resources/frontend/")
		return "Resources/frontend"
	}

	// Try ../Resources/frontend (if cwd is Resources/server/)
	if _, err := os.Stat("../Resources/frontend/index.html"); err == nil {
		logutil.Debugln("Found frontend at: ../Resources/frontend/")
		return "../Resources/frontend"
	}

	// Try parent directory (standalone mode: cwd is server/)
	if _, err := os.Stat("../frontend/index.html"); err == nil {
		logutil.Debugln("Found frontend at: ../frontend/")
		return "../frontend"
	}

	// Fallback to relative path
	log.Println("Warning: Could not find frontend directory, using ../frontend")
	return "../frontend"
}

// API Handlers

func handleGetCellValue(w http.ResponseWriter, r *http.Request) {
	row, _ := strconv.Atoi(r.URL.Query().Get("row"))
	col, _ := strconv.Atoi(r.URL.Query().Get("col"))

	value := ctrl.GetCellValue(row, col)

	response := map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"computed": value,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

func handleGetCellRawValue(w http.ResponseWriter, r *http.Request) {
	row, _ := strconv.Atoi(r.URL.Query().Get("row"))
	col, _ := strconv.Atoi(r.URL.Query().Get("col"))

	value := ctrl.GetCellRawValue(row, col)

	response := map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"value": value,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

func handleSetCellValue(w http.ResponseWriter, r *http.Request) {
	var req generated.SetCellRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	logutil.Debugf("SetCellValue: row=%d, col=%d, value=%q", req.Row, req.Col, req.Value)
	err := ctrl.SetCellValue(req.Row, req.Col, req.Value)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Get the cell data after setting it
	cell := ctrl.Sheet.GetCell(req.Row, req.Col)
	var value, displayValue string
	var isFormula bool
	if cell != nil {
		value = cell.Value
		displayValue = cell.Computed
		isFormula = cell.IsFormula
	}

	// Include the updated file status in the response
	response := map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"value":             value,
			"displayValue":      displayValue,
			"isFormula":         isFormula,
			"hasUnsavedChanges": ctrl.HasUnsavedChanges(),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

func handleGetCellRef(w http.ResponseWriter, r *http.Request) {
	row, _ := strconv.Atoi(r.URL.Query().Get("row"))
	col, _ := strconv.Atoi(r.URL.Query().Get("col"))

	ref := ctrl.GetCellRef(row, col)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ref)
}

func handleGetAllCells(w http.ResponseWriter, r *http.Request) {
	// Build array of cell data
	cells := []map[string]interface{}{}

	// Iterate through reasonable range
	for row := 0; row < 100; row++ {
		for col := 0; col < 26; col++ {
			value := ctrl.GetCellValue(row, col)
			if value != "" {
				cells = append(cells, map[string]interface{}{
					"row":      row,
					"col":      col,
					"computed": value,
					"value":    ctrl.GetCellRawValue(row, col),
				})
			}
		}
	}

	response := map[string]interface{}{
		"success": true,
		"data":    cells,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

func handleSaveFile(w http.ResponseWriter, r *http.Request) {
	var req generated.PathRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}

	logutil.Debugf("Saving file: %s", req.Path)
	if err := ctrl.SaveFile(req.Path); err != nil {
		log.Printf("Save error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"path":    req.Path,
	})
}

func handleLoadFile(w http.ResponseWriter, r *http.Request) {
	var req generated.PathRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}

	logutil.Debugf("Loading file: %s", req.Path)
	if err := ctrl.LoadFile(req.Path); err != nil {
		log.Printf("Load error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"path":    req.Path,
	})
}

func handleNewFile(w http.ResponseWriter, r *http.Request) {
	logutil.Debugln("Creating new file")
	ctrl.NewFile()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

func handleFileStatus(w http.ResponseWriter, r *http.Request) {
	filePath := ctrl.GetFilePath()
	filename := "Untitled"
	if filePath != "" {
		// Extract filename from path
		parts := strings.Split(filePath, "/")
		if len(parts) > 0 {
			filename = parts[len(parts)-1]
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"path":              filePath,
			"saved":             !ctrl.HasUnsavedChanges(),
			"modified":          ctrl.HasUnsavedChanges(),
			"hasUnsavedChanges": ctrl.HasUnsavedChanges(),
			"filename":          filename,
		},
	})
}

func handleDownloadFile(w http.ResponseWriter, r *http.Request) {
	logutil.Debugln("Downloading file")

	// Save to temporary file - this writes the data to disk
	tmpFile := "/tmp/gosheet_download.gosheet"
	if err := ctrl.SaveFile(tmpFile); err != nil {
		log.Printf("Download error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// SaveFile() clears Modified flag because we successfully wrote to a file
	// The model's job is done - data is persisted to disk

	// Serve the file
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=spreadsheet.gosheet")
	http.ServeFile(w, r, tmpFile)
}

func handleUploadFile(w http.ResponseWriter, r *http.Request) {
	logutil.Debugln("Uploading file")

	// Read the uploaded file data
	data, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Upload read error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Save to temporary file
	tmpFile := "/tmp/gosheet_upload.gosheet"
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		log.Printf("Upload write error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Load the file
	if err := ctrl.LoadFile(tmpFile); err != nil {
		log.Printf("Upload load error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

func handleCSVPreview(w http.ResponseWriter, r *http.Request) {
	api.HandleCSVPreview(w, r)
}

func handleCSVImport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Parse request
	var req generated.PathRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		_ = json.NewEncoder(w).Encode(api.CSVImportResponse{
			Success: false,
			Error:   "Invalid request format",
			Code:    "INVALID_REQUEST",
		})
		return
	}

	if req.Path == "" {
		_ = json.NewEncoder(w).Encode(api.CSVImportResponse{
			Success: false,
			Error:   "File path is required",
			Code:    "INVALID_REQUEST",
		})
		return
	}

	// Parse CSV file
	records, err := api.ParseCSVFile(req.Path)
	if err != nil {
		_ = json.NewEncoder(w).Encode(api.CSVImportResponse{
			Success: false,
			Error:   err.Error(),
			Code:    "PARSE_ERROR",
		})
		return
	}

	// Determine column count (max columns in any row)
	maxCols := 0
	for _, row := range records {
		if len(row) > maxCols {
			maxCols = len(row)
		}
	}

	// Clear existing spreadsheet and import CSV data
	ctrl.NewFile()

	// Import CSV data into spreadsheet
	for rowIdx, row := range records {
		for colIdx, value := range row {
			// Import all values as plain text (no formula interpretation)
			if err := ctrl.SetCellValue(rowIdx, colIdx, value); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}
	}

	// Return success
	_ = json.NewEncoder(w).Encode(api.CSVImportResponse{
		Success: true,
		Rows:    len(records),
		Cols:    maxCols,
		Message: fmt.Sprintf("Imported %d rows, %d columns", len(records), maxCols),
	})
}

func handleCSVExport(w http.ResponseWriter, r *http.Request) {
	logutil.Debugln("[handleCSVExport] Starting CSV export...")
	w.Header().Set("Content-Type", "application/json")

	// Parse request
	var req generated.PathRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[handleCSVExport] Failed to parse request: %v\n", err)
		_ = json.NewEncoder(w).Encode(api.CSVExportResponse{
			Success: false,
			Error:   "Invalid request format",
			Code:    "INVALID_REQUEST",
		})
		return
	}

	logutil.Debugf("[handleCSVExport] Export path: %s\n", req.Path)

	if req.Path == "" {
		logutil.Debugln("[handleCSVExport] No path provided")
		_ = json.NewEncoder(w).Encode(api.CSVExportResponse{
			Success: false,
			Error:   "File path is required",
			Code:    "INVALID_REQUEST",
		})
		return
	}

	// Collect all non-empty cells
	logutil.Debugln("[handleCSVExport] Scanning cells...")
	type cellData struct {
		row      int
		col      int
		computed string
	}
	var cells []cellData
	maxRow, maxCol := -1, -1

	// Scan a reasonable range for non-empty cells
	for row := 0; row < 1000; row++ {
		for col := 0; col < 100; col++ {
			value := ctrl.GetCellValue(row, col)
			if value != "" {
				cells = append(cells, cellData{row: row, col: col, computed: value})
				if row > maxRow {
					maxRow = row
				}
				if col > maxCol {
					maxCol = col
				}
			}
		}
	}

	logutil.Debugf("[handleCSVExport] Found %d non-empty cells, maxRow=%d, maxCol=%d\n", len(cells), maxRow, maxCol)

	// If no cells, export empty CSV
	if len(cells) == 0 {
		logutil.Debugln("[handleCSVExport] No cells found, exporting empty file")
		// Write empty file
		if err := os.WriteFile(req.Path, []byte(""), 0644); err != nil {
			log.Printf("[handleCSVExport] Failed to write empty file: %v\n", err)
			_ = json.NewEncoder(w).Encode(api.CSVExportResponse{
				Success: false,
				Error:   fmt.Sprintf("Failed to write file: %v", err),
				Code:    "FILE_WRITE_ERROR",
			})
			return
		}

		logutil.Debugln("[handleCSVExport] Empty file written successfully")
		_ = json.NewEncoder(w).Encode(api.CSVExportResponse{
			Success: true,
			Rows:    0,
			Cols:    0,
			Message: "Exported empty spreadsheet",
		})
		return
	}

	// Build 2D array for CSV export
	logutil.Debugln("[handleCSVExport] Building 2D array...")
	records := make([][]string, maxRow+1)
	for i := range records {
		records[i] = make([]string, maxCol+1)
	}

	// Fill in cell values (computed values, not formulas)
	for _, cell := range cells {
		records[cell.row][cell.col] = cell.computed
	}

	logutil.Debugln("[handleCSVExport] Generating CSV content...")
	// Generate CSV
	csvContent, err := api.GenerateCSV(records)
	if err != nil {
		log.Printf("[handleCSVExport] CSV generation failed: %v\n", err)
		_ = json.NewEncoder(w).Encode(api.CSVExportResponse{
			Success: false,
			Error:   err.Error(),
			Code:    "CSV_GENERATION_ERROR",
		})
		return
	}

	logutil.Debugf("[handleCSVExport] Writing %d bytes to file: %s\n", len(csvContent), req.Path)
	// Write to file
	if err := os.WriteFile(req.Path, []byte(csvContent), 0644); err != nil {
		log.Printf("[handleCSVExport] File write failed: %v\n", err)
		_ = json.NewEncoder(w).Encode(api.CSVExportResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to write file: %v", err),
			Code:    "FILE_WRITE_ERROR",
		})
		return
	}

	logutil.Debugln("[handleCSVExport] File written successfully")

	// Return success
	logutil.Debugf("[handleCSVExport] Sending success response: %d rows, %d cols\n", maxRow+1, maxCol+1)
	_ = json.NewEncoder(w).Encode(api.CSVExportResponse{
		Success: true,
		Rows:    maxRow + 1,
		Cols:    maxCol + 1,
		Message: fmt.Sprintf("Exported %d rows, %d columns to %s", maxRow+1, maxCol+1, req.Path),
	})
	logutil.Debugln("[handleCSVExport] Complete")
}
