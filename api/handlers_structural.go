package api

import (
	"encoding/json"
	"net/http"
)

// HandleUndo reverses the most recent undoable operation.
// POST /api/undo — returns 200 with canUndo/canRedo state even if nothing to undo.
func (s *Server) HandleUndo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// Undo returns (state, error); error means empty stack — treat as no-op.
	// State is captured inside the lock so it's always consistent.
	urState, _ := s.Ctrl.Undo()
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

// HandleRedo reapplies the most recently undone operation.
// POST /api/redo — returns 200 with canUndo/canRedo state even if nothing to redo.
func (s *Server) HandleRedo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	urState, _ := s.Ctrl.Redo()
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

// SetRangeAlignmentRequest is the JSON body for POST /api/range/alignment
type SetRangeAlignmentRequest struct {
	StartRow  int    `json:"startRow"`
	StartCol  int    `json:"startCol"`
	EndRow    int    `json:"endRow"`
	EndCol    int    `json:"endCol"`
	Alignment string `json:"alignment"`
}

func (s *Server) HandleSetRangeAlignment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req SetRangeAlignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Ctrl.SetRangeAlignment(req.StartRow, req.StartCol, req.EndRow, req.EndCol, req.Alignment); err != nil {
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
