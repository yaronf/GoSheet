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

	"gosheet/controller"
)

var ctrl *controller.AppController

func main() {
	// Parse command line flags
	port := flag.String("port", "3000", "Port to run the server on")
	flag.Parse()
	
	// Create controller
	ctrl = controller.NewAppController()
	
	// Add sample data
	log.Println("Loading sample data...")
	ctrl.SetCellValue(0, 0, "10")
	ctrl.SetCellValue(1, 0, "20")
	ctrl.SetCellValue(2, 0, "30")
	ctrl.SetCellValue(3, 0, "=SUM(A1:A3)")
	ctrl.SetCellValue(0, 1, "=A1*2")
	// Clear Modified flag - sample data is the initial state, not "unsaved changes"
	ctrl.Sheet.Modified = false
	log.Println("Sample data loaded")
	
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
	
	log.Printf("GoSheet server running at http://localhost:%s\n", *port)
	fmt.Printf("Open http://localhost:%s in your browser\n", *port)
	
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
	
	if r.URL.Path == "/" {
		http.ServeFile(w, r, frontendDir+"/index.html")
		return
	}
	http.ServeFile(w, r, frontendDir+r.URL.Path)
}

// Get frontend directory path (handles both Electron and standalone modes)
func getFrontendDir() string {
	// Try current directory first (Electron mode: cwd is project root)
	if _, err := os.Stat("frontend/index.html"); err == nil {
		return "frontend"
	}
	
	// Try parent directory (standalone mode: cwd is server/)
	if _, err := os.Stat("../frontend/index.html"); err == nil {
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
	json.NewEncoder(w).Encode(response)
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
	json.NewEncoder(w).Encode(response)
}

func handleSetCellValue(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Row   int    `json:"row"`
		Col   int    `json:"col"`
		Value string `json:"value"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	log.Printf("SetCellValue: row=%d, col=%d, value=%q", req.Row, req.Col, req.Value)
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
	json.NewEncoder(w).Encode(response)
}

func handleGetCellRef(w http.ResponseWriter, r *http.Request) {
	row, _ := strconv.Atoi(r.URL.Query().Get("row"))
	col, _ := strconv.Atoi(r.URL.Query().Get("col"))
	
	ref := ctrl.GetCellRef(row, col)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ref)
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
	json.NewEncoder(w).Encode(response)
}

func handleSaveFile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	if req.Path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}
	
	log.Printf("Saving file: %s", req.Path)
	if err := ctrl.SaveFile(req.Path); err != nil {
		log.Printf("Save error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"path":    req.Path,
	})
}

func handleLoadFile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	if req.Path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}
	
	log.Printf("Loading file: %s", req.Path)
	if err := ctrl.LoadFile(req.Path); err != nil {
		log.Printf("Load error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"path":    req.Path,
	})
}

func handleNewFile(w http.ResponseWriter, r *http.Request) {
	log.Println("Creating new file")
	ctrl.NewFile()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
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
	json.NewEncoder(w).Encode(map[string]interface{}{
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
	log.Println("Downloading file")
	
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
	log.Println("Uploading file")
	
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
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}
