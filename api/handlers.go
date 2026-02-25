package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"gosheet/api/generated"
	"gosheet/controller"
	"gosheet/logutil"
)

// Server holds HTTP handler dependencies and implements all API handlers.
// Testable: inject a controller (or mock) for unit tests.
type Server struct {
	Ctrl *controller.AppController
}

// NewServer creates a Server with the given controller.
func NewServer(ctrl *controller.AppController) *Server {
	return &Server{Ctrl: ctrl}
}

// ServeStatic serves frontend files (index.html, JS, CSS).
func (s *Server) ServeStatic(w http.ResponseWriter, r *http.Request) {
	frontendDir := GetFrontendDir()
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	if r.URL.Path == "/" {
		http.ServeFile(w, r, frontendDir+"/index.html")
		return
	}
	http.ServeFile(w, r, frontendDir+r.URL.Path)
}

// GetFrontendDir returns the frontend directory path for Electron and standalone modes.
func GetFrontendDir() string {
	if cwd, err := os.Getwd(); err == nil {
		logutil.Debugf("Current working directory: %s", cwd)
	}
	if _, err := os.Stat("frontend/index.html"); err == nil {
		logutil.Debugln("Found frontend at: frontend/")
		return "frontend"
	}
	if _, err := os.Stat("Resources/frontend/index.html"); err == nil {
		logutil.Debugln("Found frontend at: Resources/frontend/")
		return "Resources/frontend"
	}
	if _, err := os.Stat("../Resources/frontend/index.html"); err == nil {
		logutil.Debugln("Found frontend at: ../Resources/frontend/")
		return "../Resources/frontend"
	}
	if _, err := os.Stat("../frontend/index.html"); err == nil {
		logutil.Debugln("Found frontend at: ../frontend/")
		return "../frontend"
	}
	log.Println("Warning: Could not find frontend directory, using ../frontend")
	return "../frontend"
}

func (s *Server) HandleGetCellValue(w http.ResponseWriter, r *http.Request) {
	row, _ := strconv.Atoi(r.URL.Query().Get("row"))
	col, _ := strconv.Atoi(r.URL.Query().Get("col"))
	value := s.Ctrl.GetCellValue(row, col)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    map[string]interface{}{"computed": value},
	})
}

func (s *Server) HandleGetCellRawValue(w http.ResponseWriter, r *http.Request) {
	row, _ := strconv.Atoi(r.URL.Query().Get("row"))
	col, _ := strconv.Atoi(r.URL.Query().Get("col"))
	value := s.Ctrl.GetCellRawValue(row, col)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    map[string]interface{}{"value": value},
	})
}

func (s *Server) HandleSetCellValue(w http.ResponseWriter, r *http.Request) {
	var req generated.SetCellRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logutil.Debugf("SetCellValue: row=%d, col=%d, value=%q", req.Row, req.Col, req.Value)
	if err := s.Ctrl.SetCellValue(req.Row, req.Col, req.Value); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	cell := s.Ctrl.Sheet.GetCell(req.Row, req.Col)
	var value, displayValue string
	var isFormula bool
	if cell != nil {
		value, displayValue, isFormula = cell.Value, cell.Computed, cell.IsFormula
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"value":             value,
			"displayValue":      displayValue,
			"isFormula":         isFormula,
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
		},
	})
}

func (s *Server) HandleGetCellRef(w http.ResponseWriter, r *http.Request) {
	row, _ := strconv.Atoi(r.URL.Query().Get("row"))
	col, _ := strconv.Atoi(r.URL.Query().Get("col"))
	ref := s.Ctrl.GetCellRef(row, col)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ref)
}

func (s *Server) HandleGetAllCells(w http.ResponseWriter, r *http.Request) {
	var cells []map[string]interface{}
	for row := 0; row < 100; row++ {
		for col := 0; col < 26; col++ {
			value := s.Ctrl.GetCellValue(row, col)
			if value != "" {
				cells = append(cells, map[string]interface{}{
					"row": row, "col": col,
					"computed": value,
					"value":    s.Ctrl.GetCellRawValue(row, col),
				})
			}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": cells})
}

func (s *Server) HandleSaveFile(w http.ResponseWriter, r *http.Request) {
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
	if err := s.Ctrl.SaveFile(req.Path); err != nil {
		log.Printf("Save error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "path": req.Path})
}

func (s *Server) HandleLoadFile(w http.ResponseWriter, r *http.Request) {
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
	if err := s.Ctrl.LoadFile(req.Path); err != nil {
		log.Printf("Load error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "path": req.Path})
}

func (s *Server) HandleNewFile(w http.ResponseWriter, r *http.Request) {
	logutil.Debugln("Creating new file")
	s.Ctrl.NewFile()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

func (s *Server) HandleFileStatus(w http.ResponseWriter, r *http.Request) {
	filePath := s.Ctrl.GetFilePath()
	filename := "Untitled"
	if filePath != "" {
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
			"saved":             !s.Ctrl.HasUnsavedChanges(),
			"modified":          s.Ctrl.HasUnsavedChanges(),
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
			"filename":          filename,
		},
	})
}

func (s *Server) HandleDownloadFile(w http.ResponseWriter, r *http.Request) {
	logutil.Debugln("Downloading file")
	tmpFile := "/tmp/gosheet_download.gosheet"
	if err := s.Ctrl.SaveFile(tmpFile); err != nil {
		log.Printf("Download error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=spreadsheet.gosheet")
	http.ServeFile(w, r, tmpFile)
}

func (s *Server) HandleUploadFile(w http.ResponseWriter, r *http.Request) {
	logutil.Debugln("Uploading file")
	data, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Upload read error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	tmpFile := "/tmp/gosheet_upload.gosheet"
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		log.Printf("Upload write error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := s.Ctrl.LoadFile(tmpFile); err != nil {
		log.Printf("Upload load error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

func (s *Server) HandleCSVPreview(w http.ResponseWriter, r *http.Request) {
	HandleCSVPreview(w, r)
}

func (s *Server) HandleCSVImport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req generated.PathRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		_ = json.NewEncoder(w).Encode(CSVImportResponse{Success: false, Error: "Invalid request format", Code: "INVALID_REQUEST"})
		return
	}
	if req.Path == "" {
		_ = json.NewEncoder(w).Encode(CSVImportResponse{Success: false, Error: "File path is required", Code: "INVALID_REQUEST"})
		return
	}
	records, err := ParseCSVFile(req.Path)
	if err != nil {
		_ = json.NewEncoder(w).Encode(CSVImportResponse{Success: false, Error: err.Error(), Code: "PARSE_ERROR"})
		return
	}
	maxCols := 0
	for _, row := range records {
		if len(row) > maxCols {
			maxCols = len(row)
		}
	}
	s.Ctrl.NewFile()
	for rowIdx, row := range records {
		for colIdx, value := range row {
			if err := s.Ctrl.SetCellValue(rowIdx, colIdx, value); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}
	}
	_ = json.NewEncoder(w).Encode(CSVImportResponse{
		Success: true,
		Rows:    len(records),
		Cols:    maxCols,
		Message: fmt.Sprintf("Imported %d rows, %d columns", len(records), maxCols),
	})
}

func (s *Server) HandleCSVExport(w http.ResponseWriter, r *http.Request) {
	logutil.Debugln("[handleCSVExport] Starting CSV export...")
	w.Header().Set("Content-Type", "application/json")
	var req generated.PathRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[handleCSVExport] Failed to parse request: %v\n", err)
		_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: false, Error: "Invalid request format", Code: "INVALID_REQUEST"})
		return
	}
	logutil.Debugf("[handleCSVExport] Export path: %s\n", req.Path)
	if req.Path == "" {
		logutil.Debugln("[handleCSVExport] No path provided")
		_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: false, Error: "File path is required", Code: "INVALID_REQUEST"})
		return
	}
	type cellData struct {
		row, col int
		computed string
	}
	var cells []cellData
	maxRow, maxCol := -1, -1
	for row := 0; row < 1000; row++ {
		for col := 0; col < 100; col++ {
			value := s.Ctrl.GetCellValue(row, col)
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
	if len(cells) == 0 {
		if err := os.WriteFile(req.Path, []byte(""), 0644); err != nil {
			log.Printf("[handleCSVExport] Failed to write empty file: %v\n", err)
			_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: false, Error: fmt.Sprintf("Failed to write file: %v", err), Code: "FILE_WRITE_ERROR"})
			return
		}
		_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: true, Rows: 0, Cols: 0, Message: "Exported empty spreadsheet"})
		return
	}
	records := make([][]string, maxRow+1)
	for i := range records {
		records[i] = make([]string, maxCol+1)
	}
	for _, cell := range cells {
		records[cell.row][cell.col] = cell.computed
	}
	csvContent, err := GenerateCSV(records)
	if err != nil {
		log.Printf("[handleCSVExport] CSV generation failed: %v\n", err)
		_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: false, Error: err.Error(), Code: "CSV_GENERATION_ERROR"})
		return
	}
	if err := os.WriteFile(req.Path, []byte(csvContent), 0644); err != nil {
		log.Printf("[handleCSVExport] File write failed: %v\n", err)
		_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: false, Error: fmt.Sprintf("Failed to write file: %v", err), Code: "FILE_WRITE_ERROR"})
		return
	}
	logutil.Debugln("[handleCSVExport] Complete")
	_ = json.NewEncoder(w).Encode(CSVExportResponse{
		Success: true,
		Rows:    maxRow + 1,
		Cols:    maxCol + 1,
		Message: fmt.Sprintf("Exported %d rows, %d columns to %s", maxRow+1, maxCol+1, req.Path),
	})
}

func (s *Server) HandleGetMerges(w http.ResponseWriter, r *http.Request) {
	merges := s.Ctrl.GetMerges()
	// Convert to API format
	mergeData := make([]map[string]interface{}, 0, len(merges))
	for _, m := range merges {
		mergeData = append(mergeData, map[string]interface{}{
			"startRow": m.StartRow,
			"startCol": m.StartCol,
			"rowSpan":  m.RowSpan,
			"colSpan":  m.ColSpan,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    map[string]interface{}{"merges": mergeData},
	})
}

func (s *Server) HandleSetMerge(w http.ResponseWriter, r *http.Request) {
	var req generated.SetMergeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.SetMerge(req.StartRow, req.StartCol, req.RowSpan, req.ColSpan); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
		},
	})
}

func (s *Server) HandleUnmerge(w http.ResponseWriter, r *http.Request) {
	var req generated.UnmergeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.Unmerge(req.StartRow, req.StartCol); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
		},
	})
}
