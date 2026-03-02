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
	"gosheet/model"
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
			// Story 11.6: Skip covered cells; only include anchor for merged regions
			ar, ac := s.Ctrl.Sheet.ResolveToAnchor(row, col)
			if ar != row || ac != col {
				continue
			}
			value := s.Ctrl.GetCellValue(row, col)
			cell := s.Ctrl.Sheet.GetCell(row, col)
			if value != "" || (cell != nil && cell.StyleId != 0) {
				entry := map[string]interface{}{
					"row": row, "col": col,
					"computed": value,
					"value":    s.Ctrl.GetCellRawValue(row, col),
				}
				if cell != nil && cell.StyleId != 0 {
					entry["styleId"] = cell.StyleId
				}
				cells = append(cells, entry)
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
	// Story 11.6: Build grid; covered positions get "", anchor gets value
	maxRow, maxCol := -1, -1
	for _, m := range s.Ctrl.GetMerges() {
		if m.RowSpan > 0 && m.ColSpan > 0 {
			r, c := m.StartRow+m.RowSpan-1, m.StartCol+m.ColSpan-1
			if r > maxRow {
				maxRow = r
			}
			if c > maxCol {
				maxCol = c
			}
		}
	}
	for row := 0; row < 1000; row++ {
		for col := 0; col < 100; col++ {
			ar, ac := s.Ctrl.Sheet.ResolveToAnchor(row, col)
			if ar != row || ac != col {
				continue
			}
			if s.Ctrl.GetCellValue(row, col) != "" {
				if row > maxRow {
					maxRow = row
				}
				if col > maxCol {
					maxCol = col
				}
			}
		}
	}
	logutil.Debugf("[handleCSVExport] Bounds maxRow=%d, maxCol=%d\n", maxRow, maxCol)
	if maxRow < 0 || maxCol < 0 {
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
	for row := 0; row <= maxRow; row++ {
		for col := 0; col <= maxCol; col++ {
			ar, ac := s.Ctrl.Sheet.ResolveToAnchor(row, col)
			if ar != row || ac != col {
				records[row][col] = "" // Story 11.6: covered = empty
			} else {
				records[row][col] = s.Ctrl.GetCellValue(row, col)
			}
		}
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

// ApplyCellStyleRequest is the JSON body for POST /api/cell/style
type ApplyCellStyleRequest struct {
	Row     int `json:"row"`
	Col     int `json:"col"`
	StyleId int `json:"styleId"`
}

func (s *Server) HandleApplyCellStyle(w http.ResponseWriter, r *http.Request) {
	var req ApplyCellStyleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.ApplyStyleToCell(req.Row, req.Col, req.StyleId); err != nil {
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

// ApplyRangeStyleRequest is the JSON body for POST /api/range/style
type ApplyRangeStyleRequest struct {
	StartRow int `json:"startRow"`
	StartCol int `json:"startCol"`
	EndRow   int `json:"endRow"`
	EndCol   int `json:"endCol"`
	StyleId  int `json:"styleId"`
}

// ClearRangeRequest is the JSON body for POST /api/range/clear
type ClearRangeRequest struct {
	StartRow int `json:"startRow"`
	StartCol int `json:"startCol"`
	EndRow   int `json:"endRow"`
	EndCol   int `json:"endCol"`
}

func (s *Server) HandleApplyRangeStyle(w http.ResponseWriter, r *http.Request) {
	var req ApplyRangeStyleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.ApplyStyleToRange(req.StartRow, req.StartCol, req.EndRow, req.EndCol, req.StyleId); err != nil {
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

func (s *Server) HandleClearRange(w http.ResponseWriter, r *http.Request) {
	var req ClearRangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.Ctrl.ClearRange(req.StartRow, req.StartCol, req.EndRow, req.EndCol)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
		},
	})
}

// HandleFormatCleanup removes style from empty cells and deletes cells with no value and no style.
// Story 12.3: POST /api/format/cleanup
func (s *Server) HandleFormatCleanup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.Ctrl.CleanupFormat()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
		},
	})
}

// InsertRowRequest is the JSON body for POST /api/row/insert
type InsertRowRequest struct {
	Row int `json:"row"`
}

// InsertColumnRequest is the JSON body for POST /api/column/insert
type InsertColumnRequest struct {
	Col int `json:"col"`
}

// HandleInsertRow inserts an empty row at the given index. Story 13.1.
func (s *Server) HandleInsertRow(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req InsertRowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.InsertRow(req.Row); err != nil {
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

// HandleInsertColumn inserts an empty column at the given index. Story 13.1.
func (s *Server) HandleInsertColumn(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req InsertColumnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.InsertColumn(req.Col); err != nil {
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

// HandleStyles handles GET /api/styles (list) and POST /api/styles (add). Story 13.3.
func (s *Server) HandleStyles(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/styles" && r.URL.Path != "/api/styles/" {
		http.NotFound(w, r)
		return
	}
	switch r.Method {
	case http.MethodGet:
		s.handleGetStyles(w, r)
	case http.MethodPost:
		s.handleAddStyle(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleGetStyles(w http.ResponseWriter, r *http.Request) {
	styles := s.Ctrl.GetStyles()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    map[string]interface{}{"styles": styles},
	})
}

// AddStyleRequest is the JSON body for POST /api/styles
type AddStyleRequest struct {
	Name   string           `json:"name"`
	Format model.CellFormat `json:"format"`
}

func (s *Server) handleAddStyle(w http.ResponseWriter, r *http.Request) {
	var req AddStyleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logutil.Debugf("[handleAddStyle] req.Name=%q (len=%d)", req.Name, len(req.Name))
	id, err := s.Ctrl.AddStyle(req.Name, &req.Format)
	if err != nil {
		log.Printf("[handleAddStyle] ERROR: %v (req.Name=%q)", err, req.Name)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"id":                id,
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
		},
	})
}

// HandleStyleByID handles PUT /api/styles/:id and DELETE /api/styles/:id. Story 13.3.
func (s *Server) HandleStyleByID(w http.ResponseWriter, r *http.Request) {
	// Path is /api/styles/1, /api/styles/2, etc.
	path := strings.TrimPrefix(r.URL.Path, "/api/styles/")
	if path == "" || path == r.URL.Path {
		http.NotFound(w, r)
		return
	}
	id, err := strconv.Atoi(path)
	if err != nil || id < 1 {
		http.Error(w, "invalid style id", http.StatusBadRequest)
		return
	}
	switch r.Method {
	case http.MethodPut:
		s.handleUpdateStyle(w, r, id)
	case http.MethodDelete:
		s.handleDeleteStyle(w, r, id)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// UpdateStyleRequest is the JSON body for PUT /api/styles/:id
type UpdateStyleRequest struct {
	Format model.CellFormat `json:"format"`
	Name   string           `json:"name"`
}

func (s *Server) handleUpdateStyle(w http.ResponseWriter, r *http.Request, id int) {
	var req UpdateStyleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logutil.Debugf("[handleUpdateStyle] id=%d req.Name=%q (len=%d)", id, req.Name, len(req.Name))
	if err := s.Ctrl.UpdateStyle(id, &req.Format, req.Name); err != nil {
		log.Printf("[handleUpdateStyle] ERROR: %v (id=%d req.Name=%q)", err, id, req.Name)
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

func (s *Server) handleDeleteStyle(w http.ResponseWriter, r *http.Request, id int) {
	if err := s.Ctrl.DeleteStyle(id); err != nil {
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
