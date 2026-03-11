package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"gosheet/api/generated"
	"gosheet/controller"
	"gosheet/logutil"
	"gosheet/model"
)

// Server holds HTTP handler dependencies and implements all API handlers.
// Testable: inject a controller (or mock) for unit tests.
type Server struct {
	Ctrl        *controller.AppController
	frontendDir string // cached at construction time
}

// NewServer creates a Server with the given controller.
func NewServer(ctrl *controller.AppController) *Server {
	return &Server{Ctrl: ctrl, frontendDir: GetFrontendDir()}
}

// ServeStatic serves frontend files (index.html, JS, CSS).
func (s *Server) ServeStatic(w http.ResponseWriter, r *http.Request) {
	frontendDir := s.frontendDir
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
	row, err := strconv.Atoi(r.URL.Query().Get("row"))
	if err != nil {
		http.Error(w, "invalid row parameter", http.StatusBadRequest)
		return
	}
	col, err := strconv.Atoi(r.URL.Query().Get("col"))
	if err != nil {
		http.Error(w, "invalid col parameter", http.StatusBadRequest)
		return
	}
	cell := s.Ctrl.Sheet.GetCell(row, col)
	value := s.Ctrl.GetCellValue(row, col)
	isError := cell != nil && cell.IsError
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data":    map[string]any{"computed": value, "isError": isError},
	})
}

func (s *Server) HandleGetCellRawValue(w http.ResponseWriter, r *http.Request) {
	row, err := strconv.Atoi(r.URL.Query().Get("row"))
	if err != nil {
		http.Error(w, "invalid row parameter", http.StatusBadRequest)
		return
	}
	col, err := strconv.Atoi(r.URL.Query().Get("col"))
	if err != nil {
		http.Error(w, "invalid col parameter", http.StatusBadRequest)
		return
	}
	value := s.Ctrl.GetCellRawValue(row, col)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data":    map[string]any{"value": value},
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
	var isFormula, isError bool
	if cell != nil {
		value, displayValue, isFormula, isError = cell.RawValue(), cell.Computed, cell.IsFormula, cell.IsError
	}
	urState := s.Ctrl.UndoRedoState()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data": map[string]any{
			"value":             value,
			"displayValue":      displayValue,
			"isFormula":         isFormula,
			"isError":           isError,
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
			"canUndo":           urState.CanUndo,
			"canRedo":           urState.CanRedo,
			"undoDescription":   urState.UndoDescription,
			"redoDescription":   urState.RedoDescription,
		},
	})
}

func (s *Server) HandleSetRangeValues(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Cells []struct {
			Row   int    `json:"row"`
			Col   int    `json:"col"`
			Value string `json:"value"`
		} `json:"cells"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	cells := make([]controller.RangeCell, len(req.Cells))
	for i, c := range req.Cells {
		cells[i] = controller.RangeCell{Row: c.Row, Col: c.Col, Value: c.Value}
	}
	if err := s.Ctrl.SetRangeValues(cells); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	urState := s.Ctrl.UndoRedoState()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data": map[string]any{
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
			"canUndo":           urState.CanUndo,
			"canRedo":           urState.CanRedo,
			"undoDescription":   urState.UndoDescription,
			"redoDescription":   urState.RedoDescription,
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
	maxRow, maxCol := s.computeGridBounds()
	var cells []map[string]any
	for row := 0; row <= maxRow; row++ {
		for col := 0; col <= maxCol; col++ {
			// Story 11.6: Skip covered cells; only include anchor for merged regions
			ar, ac := s.Ctrl.Sheet.ResolveToAnchor(row, col)
			if ar != row || ac != col {
				continue
			}
			if entry, ok := s.buildCellEntry(row, col); ok {
				cells = append(cells, entry)
			}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "data": cells})
}

// computeGridBounds returns the maximum row and column indices occupied by cells or merges.
func (s *Server) computeGridBounds() (maxRow, maxCol int) {
	maxRow, maxCol = 99, 25
	for row, cols := range s.Ctrl.Sheet.Cells {
		if row > maxRow {
			maxRow = row
		}
		for col := range cols {
			if col > maxCol {
				maxCol = col
			}
		}
	}
	for _, m := range s.Ctrl.Sheet.Merges {
		if end := m.StartRow + m.RowSpan - 1; end > maxRow {
			maxRow = end
		}
		if end := m.StartCol + m.ColSpan - 1; end > maxCol {
			maxCol = end
		}
	}
	return maxRow, maxCol
}

// buildCellEntry builds the JSON entry for a single cell. Returns (entry, true) if the cell
// has content worth including; (nil, false) if the cell is empty and unstyled.
func (s *Server) buildCellEntry(row, col int) (map[string]any, bool) {
	value := s.Ctrl.GetCellValue(row, col)
	cell := s.Ctrl.Sheet.GetCell(row, col)
	if value == "" && (cell == nil || (cell.StyleId == 0 && cell.Alignment == "")) {
		return nil, false
	}
	entry := map[string]any{
		"row": row, "col": col,
		"computed": value,
		"isError":  cell != nil && cell.IsError,
		"value":    s.Ctrl.GetCellRawValue(row, col),
	}
	if cell != nil && cell.StyleId != 0 {
		entry["styleId"] = cell.StyleId
	}
	if cell != nil && cell.Alignment != "" {
		entry["alignment"] = cell.Alignment
	}
	return entry, true
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
		logutil.Errorf("Save error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "path": req.Path})
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
		logutil.Errorf("Load error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "path": req.Path})
}

func (s *Server) HandleNewFile(w http.ResponseWriter, r *http.Request) {
	logutil.Debugln("Creating new file")
	s.Ctrl.NewFile()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
}

func (s *Server) HandleFileStatus(w http.ResponseWriter, r *http.Request) {
	filePath := s.Ctrl.GetFilePath()
	filename := "Untitled"
	if filePath != "" {
		filename = filepath.Base(filePath)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data": map[string]any{
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
	tmpFile, err := os.CreateTemp("", "gosheet-download-*.gosheet")
	if err != nil {
		logutil.Errorf("Download error creating temp file: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	tmpPath := tmpFile.Name()
	_ = tmpFile.Close()
	defer func() { _ = os.Remove(tmpPath) }()
	if err := s.Ctrl.SaveFile(tmpPath); err != nil {
		logutil.Errorf("Download error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=spreadsheet.gosheet")
	http.ServeFile(w, r, tmpPath)
}

func (s *Server) HandleUploadFile(w http.ResponseWriter, r *http.Request) {
	logutil.Debugln("Uploading file")
	data, err := io.ReadAll(r.Body)
	if err != nil {
		logutil.Errorf("Upload read error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	tmpFile, err := os.CreateTemp("", "gosheet-upload-*.gosheet")
	if err != nil {
		logutil.Errorf("Upload temp file error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	tmpPath := tmpFile.Name()
	_ = tmpFile.Close()
	defer func() { _ = os.Remove(tmpPath) }()
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		logutil.Errorf("Upload write error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := s.Ctrl.LoadFile(tmpPath); err != nil {
		logutil.Errorf("Upload load error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
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
		logutil.Warnf("[handleCSVExport] Failed to parse request: %v", err)
		_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: false, Error: "Invalid request format", Code: "INVALID_REQUEST"})
		return
	}
	logutil.Debugf("[handleCSVExport] Export path: %s\n", req.Path)
	if req.Path == "" {
		logutil.Debugln("[handleCSVExport] No path provided")
		_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: false, Error: "File path is required", Code: "INVALID_REQUEST"})
		return
	}
	maxRow, maxCol := s.computeCSVExportBounds()
	logutil.Debugf("[handleCSVExport] Bounds maxRow=%d, maxCol=%d\n", maxRow, maxCol)
	if maxRow < 0 || maxCol < 0 {
		if err := os.WriteFile(req.Path, []byte(""), 0644); err != nil {
			logutil.Errorf("[handleCSVExport] Failed to write empty file: %v", err)
			_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: false, Error: fmt.Sprintf("Failed to write file: %v", err), Code: "FILE_WRITE_ERROR"})
			return
		}
		_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: true, Rows: 0, Cols: 0, Message: "Exported empty spreadsheet"})
		return
	}
	records := s.buildCSVRecords(maxRow, maxCol)
	csvContent, err := GenerateCSV(records)
	if err != nil {
		logutil.Errorf("[handleCSVExport] CSV generation failed: %v", err)
		_ = json.NewEncoder(w).Encode(CSVExportResponse{Success: false, Error: err.Error(), Code: "CSV_GENERATION_ERROR"})
		return
	}
	if err := os.WriteFile(req.Path, []byte(csvContent), 0644); err != nil {
		logutil.Errorf("[handleCSVExport] File write failed: %v", err)
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

// computeCSVExportBounds returns the max row and column with content for CSV export.
// Returns (-1, -1) if the sheet is empty.
func (s *Server) computeCSVExportBounds() (maxRow, maxCol int) {
	maxRow, maxCol = -1, -1
	// Story 11.6: include merge extents
	for _, m := range s.Ctrl.GetMerges() {
		if m.RowSpan > 0 && m.ColSpan > 0 {
			if r := m.StartRow + m.RowSpan - 1; r > maxRow {
				maxRow = r
			}
			if c := m.StartCol + m.ColSpan - 1; c > maxCol {
				maxCol = c
			}
		}
	}
	for row, cols := range s.Ctrl.Sheet.Cells {
		for col := range cols {
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
	return maxRow, maxCol
}

// HandleShiftFormula shifts cell/range references in a formula string by a row/col offset.
// Stateless pure transformation — no spreadsheet state is read or written.
// POST /api/formula/shift
// Request:  { "formula": "=A1+B2", "row_offset": 1, "col_offset": 2 }
// Response: { "success": true, "data": { "shifted": "=B2+D4" } }
func (s *Server) HandleShiftFormula(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Formula   string `json:"formula"`
		RowOffset int    `json:"row_offset"`
		ColOffset int    `json:"col_offset"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	shifted, err := model.ShiftFormulaByOffset(req.Formula, req.RowOffset, req.ColOffset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data":    map[string]any{"shifted": shifted},
	})
}

// buildCSVRecords builds the 2D string grid for CSV export.
// Covered (non-anchor) cells get an empty string (Story 11.6).
func (s *Server) buildCSVRecords(maxRow, maxCol int) [][]string {
	records := make([][]string, maxRow+1)
	for i := range records {
		records[i] = make([]string, maxCol+1)
	}
	for row := 0; row <= maxRow; row++ {
		for col := 0; col <= maxCol; col++ {
			ar, ac := s.Ctrl.Sheet.ResolveToAnchor(row, col)
			if ar == row && ac == col {
				records[row][col] = s.Ctrl.GetCellValue(row, col)
			}
			// covered cells remain ""
		}
	}
	return records
}
