package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gosheet/api/generated"
	"gosheet/logutil"
	"gosheet/model"
)

func (s *Server) HandleGetMerges(w http.ResponseWriter, r *http.Request) {
	merges := s.Ctrl.GetMerges()
	// Convert to API format
	mergeData := make([]map[string]any, 0, len(merges))
	for _, m := range merges {
		mergeData = append(mergeData, map[string]any{
			"startRow": m.StartRow,
			"startCol": m.StartCol,
			"rowSpan":  m.RowSpan,
			"colSpan":  m.ColSpan,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data":    map[string]any{"merges": mergeData},
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

func (s *Server) HandleClearRange(w http.ResponseWriter, r *http.Request) {
	var req ClearRangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.Ctrl.ClearRange(req.StartRow, req.StartCol, req.EndRow, req.EndCol)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data": map[string]any{
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
		},
	})
}

// HandleClearRangeFormat clears styleId and alignment from cells in the range without touching values.
// POST /api/range/clear-format
func (s *Server) HandleClearRangeFormat(w http.ResponseWriter, r *http.Request) {
	var req ClearRangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.ClearRangeFormat(req.StartRow, req.StartCol, req.EndRow, req.EndCol); err != nil {
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

// HandleFormatCleanup removes style from empty cells and deletes cells with no value and no style.
// Story 12.3: POST /api/format/cleanup
func (s *Server) HandleFormatCleanup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.Ctrl.CleanupFormat()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data": map[string]any{
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

// HandleInsertRow inserts an empty row at the given index. Story 13.1 / 15.3.
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

// HandleInsertColumn inserts an empty column at the given index. Story 13.1 / 15.3.
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

// DeleteRowRequest is the JSON body for POST /api/row/delete
type DeleteRowRequest struct {
	Row int `json:"row"`
}

// DeleteColumnRequest is the JSON body for POST /api/column/delete
type DeleteColumnRequest struct {
	Col int `json:"col"`
}

// HandleDeleteRow deletes the row at the given index. Story 15.3.
func (s *Server) HandleDeleteRow(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req DeleteRowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.DeleteRow(req.Row); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
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

// HandleDeleteColumn deletes the column at the given index. Story 15.3.
func (s *Server) HandleDeleteColumn(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req DeleteColumnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.DeleteColumn(req.Col); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
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

func (s *Server) handleGetStyles(w http.ResponseWriter, _ *http.Request) {
	styles := s.Ctrl.GetStyles()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data":    map[string]any{"styles": styles},
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
		logutil.Warnf("[handleAddStyle] %v (req.Name=%q)", err, req.Name)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data": map[string]any{
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
		logutil.Warnf("[handleUpdateStyle] %v (id=%d req.Name=%q)", err, id, req.Name)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data": map[string]any{
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
		},
	})
}

func (s *Server) handleDeleteStyle(w http.ResponseWriter, _ *http.Request, id int) {
	if err := s.Ctrl.DeleteStyle(id); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data": map[string]any{
			"hasUnsavedChanges": s.Ctrl.HasUnsavedChanges(),
		},
	})
}

// SetCellAlignmentRequest is the JSON body for POST /api/cell/alignment
type SetCellAlignmentRequest struct {
	Row       int    `json:"row"`
	Col       int    `json:"col"`
	Alignment string `json:"alignment"`
}

func (s *Server) HandleSetCellAlignment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req SetCellAlignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.ApplyAlignmentToRange(req.Row, req.Col, req.Row, req.Col, req.Alignment); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
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
