package api

// Story 20: Agentic API Access Layer
// Handlers for agent session management, read endpoints, and patch operations.

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"gosheet/controller"
	"gosheet/logutil"
	"gosheet/model"
)

// ── Helper ────────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]any{"success": false, "error": msg})
}

// agentTokenFromRequest extracts and validates the agent token from the request.
// Returns the session or writes a 401/403 and returns nil.
func (s *Server) agentTokenFromRequest(w http.ResponseWriter, r *http.Request) *controller.AgentSession {
	authHeader := r.Header.Get("Authorization")
	var token string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		token = authHeader[7:]
	}
	// Also accept query param (for bootstrap URL)
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"success": false, "error": "missing token"})
		return nil
	}
	sess, err := s.Ctrl.Agent.Validate(token)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"success": false, "error": "invalid or expired agent token"})
		return nil
	}
	return sess
}

// ── Session management ────────────────────────────────────────────────────────

// HandleAgentToken issues a scoped agent token in exchange for the bootstrap token.
// POST /api/agent/token  (requires bootstrap token — agent tokens are rejected)
func (s *Server) HandleAgentToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}

	// Only the bootstrap token may open a new session. Agent tokens must not be
	// able to open sessions even if they somehow pass the middleware.
	if s.bootstrapToken != "" {
		authHeader := r.Header.Get("Authorization")
		var tok string
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tok = authHeader[7:]
		}
		if tok == "" {
			tok = r.URL.Query().Get("token")
		}
		if tok != s.bootstrapToken {
			writeJSONError(w, http.StatusForbidden, "bootstrap token required to open a session")
			return
		}
	}

	var body struct {
		Scope string `json:"scope"` // "ro" or "rw"
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "invalid request body"})
		return
	}

	scope := controller.AgentScope(body.Scope)
	if scope != controller.ScopeReadOnly && scope != controller.ScopeReadWrite {
		scope = controller.ScopeReadWrite // default to rw
	}

	filePath := s.Ctrl.GetFilePath()
	sess, err := s.Ctrl.Agent.OpenSession(scope, filePath)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]any{"success": false, "error": err.Error()})
		return
	}

	logutil.Debugf("Agent session opened: agentId=%s scope=%s", sess.AgentID, sess.Scope)
	writeJSON(w, http.StatusOK, map[string]any{
		"success":    true,
		"agentToken": sess.Token,
		"agentId":    sess.AgentID,
	})
}

// HandleAgentBootstrap is the agent entry point — returns tool definitions + workbook context.
// GET /api/agent/bootstrap?token=<agent-token>
func (s *Server) HandleAgentBootstrap(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "GET only")
		return
	}

	sess := s.agentTokenFromRequest(w, r)
	if sess == nil {
		return
	}

	workbook := s.buildWorkbookSummary()
	baseURL := "http://localhost" // agent will discover port from the URL it hit

	// Extract the host from the request to give agent the correct base URL
	host := r.Host
	if host != "" {
		baseURL = "http://" + host
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"session": map[string]any{
			"agentId": sess.AgentID,
			"scope":   string(sess.Scope),
			"baseUrl": baseURL,
		},
		"workbook": workbook,
		"tools":    agentToolDefinitions(),
	})
}

// HandleAgentCommit collapses agent history into user history (checkpoint), token stays alive.
// POST /api/agent/commit
func (s *Server) HandleAgentCommit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}
	sess := s.agentTokenFromRequest(w, r)
	if sess == nil {
		return
	}

	s.Ctrl.LockForAgent()
	defer s.Ctrl.UnlockForAgent()

	if err := s.Ctrl.Agent.Commit(s.Ctrl.History); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

// HandleAgentEnd closes the session cleanly (remaining history folded in), token revoked.
// POST /api/agent/end
func (s *Server) HandleAgentEnd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}
	sess := s.agentTokenFromRequest(w, r)
	if sess == nil {
		return
	}

	s.Ctrl.LockForAgent()
	defer s.Ctrl.UnlockForAgent()

	if err := s.Ctrl.Agent.End(s.Ctrl.History); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": err.Error()})
		return
	}

	s.broadcastEvent("session_changed")
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

// HandleAgentRollback unwinds agent history to last commit, revokes token.
// POST /api/agent/rollback
func (s *Server) HandleAgentRollback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}
	sess := s.agentTokenFromRequest(w, r)
	if sess == nil {
		return
	}

	s.Ctrl.LockForAgent()
	defer s.Ctrl.UnlockForAgent()

	if err := s.Ctrl.Agent.Rollback(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": err.Error()})
		return
	}

	s.broadcastEvent("session_changed")
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

// HandleAdminEndSession forcibly ends any active agent session using the bootstrap token.
// Called by the UI to revoke a session without needing the agent token.
// POST /api/agent/session/end  (bootstrap token required)
func (s *Server) HandleAdminEndSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}

	s.Ctrl.LockForAgent()
	defer s.Ctrl.UnlockForAgent()

	sess := s.Ctrl.Agent.ActiveSession()
	if sess == nil {
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "message": "no active session"})
		return
	}
	if err := s.Ctrl.Agent.End(s.Ctrl.History); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": err.Error()})
		return
	}
	s.broadcastEvent("session_changed")
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

// HandleAgentSessionStatus returns whether a session is active (bootstrap token only).
// GET /api/agent/session/status
func (s *Server) HandleAgentSessionStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "GET only")
		return
	}

	sess := s.Ctrl.Agent.ActiveSession()
	if sess == nil {
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "active": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"active":  true,
		"agentId": sess.AgentID,
		"scope":   string(sess.Scope),
	})
}

// ── Read endpoints ─────────────────────────────────────────────────────────────

// HandleAgentWorkbook returns a summary of the current workbook.
// GET /api/agent/workbook
func (s *Server) HandleAgentWorkbook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "GET only")
		return
	}
	if s.agentTokenFromRequest(w, r) == nil {
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"workbook": s.buildWorkbookSummary(),
	})
}

// HandleAgentRange reads cells in the given A1 range.
// GET /api/agent/range?range=A1:D10
func (s *Server) HandleAgentRange(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "GET only")
		return
	}
	if s.agentTokenFromRequest(w, r) == nil {
		return
	}

	rangeStr := r.URL.Query().Get("range")
	if rangeStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "range parameter required"})
		return
	}

	startRow, startCol, endRow, endCol, err := parseA1Range(rangeStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": err.Error()})
		return
	}

	const maxCells = 10000
	cellCount := (endRow - startRow + 1) * (endCol - startCol + 1)
	if cellCount > maxCells {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"error":   fmt.Sprintf("range too large (max %d cells, requested %d)", maxCells, cellCount),
		})
		return
	}

	s.Ctrl.RLockForAgent()
	defer s.Ctrl.RUnlockForAgent()

	var cells []map[string]any
	for row := startRow; row <= endRow; row++ {
		for col := startCol; col <= endCol; col++ {
			cell := s.Ctrl.Sheet.GetCell(row, col)
			ref := model.CoordsToRef(row, col)
			entry := map[string]any{
				"row": row,
				"col": col,
				"ref": ref,
			}
			if cell != nil {
				formula := cell.DisplayFormula()
				entry["raw"] = formula
				// Use Computed if populated; fall back to raw Value so agents
				// always get a non-empty string for cells with a value set.
				computed := cell.Computed
				if computed == "" {
					computed = cell.Value
				}
				entry["computed"] = computed
				entry["isFormula"] = cell.IsFormula
				entry["isError"] = cell.IsError()
				entry["styleId"] = cell.StyleId
			} else {
				entry["raw"] = ""
				entry["computed"] = ""
				entry["isFormula"] = false
				entry["isError"] = false
				entry["styleId"] = 0
			}
			cells = append(cells, entry)
		}
	}
	if cells == nil {
		cells = []map[string]any{}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"range":   rangeStr,
		"count":   len(cells),
		"cells":   cells,
	})
}

// ── Patch endpoint ─────────────────────────────────────────────────────────────

type patchOp struct {
	Op        string `json:"op"`
	Row       int    `json:"row"`
	Col       int    `json:"col"`
	StartRow  int    `json:"startRow"`
	StartCol  int    `json:"startCol"`
	EndRow    int    `json:"endRow"`
	EndCol    int    `json:"endCol"`
	Value     string `json:"value"`
	StyleID   int    `json:"styleId"`
	Alignment string `json:"alignment"`
	Name      string `json:"name"`
	FontColor string `json:"fontColor"`
	FillColor string `json:"fillColor"`
}

type patchRequest struct {
	Description string    `json:"description"`
	Ops         []patchOp `json:"ops"`
}

// HandleAgentPatch applies a batch of operations atomically through the command pattern.
// POST /api/agent/patch
func (s *Server) HandleAgentPatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "POST only")
		return
	}
	sess := s.agentTokenFromRequest(w, r)
	if sess == nil {
		return
	}
	if sess.Scope == controller.ScopeReadOnly {
		writeJSON(w, http.StatusForbidden, map[string]any{"success": false, "error": "agent token is read-only"})
		return
	}

	var req patchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "invalid request body"})
		return
	}
	if len(req.Ops) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "ops array is empty"})
		return
	}

	// Capture file path before acquiring write lock (GetFilePath acquires RLock).
	filePath := s.Ctrl.GetFilePath()

	// Validate all ops before applying any (two-pass)
	for i, op := range req.Ops {
		if err := validatePatchOp(op); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"success":      false,
				"error":        err.Error(),
				"failingOpIdx": i,
			})
			s.Ctrl.Agent.LogPatch(sess.AgentID, filePath, req.Description, len(req.Ops), "rejected")
			return
		}
	}

	s.Ctrl.LockForAgent()
	defer s.Ctrl.UnlockForAgent()

	// Build and execute commands, collecting them for AgentPatchCommand
	var cmds []controller.Command
	for i, op := range req.Ops {
		cmd, err := s.buildPatchCommand(op)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"success":      false,
				"error":        fmt.Sprintf("op %d (%s): %s", i, op.Op, err.Error()),
				"failingOpIdx": i,
			})
			s.Ctrl.Agent.LogPatch(sess.AgentID, filePath, req.Description, len(req.Ops), "rejected")
			return
		}
		if err := cmd.Do(); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"success":      false,
				"error":        fmt.Sprintf("op %d (%s): %s", i, op.Op, err.Error()),
				"failingOpIdx": i,
			})
			s.Ctrl.Agent.LogPatch(sess.AgentID, filePath, req.Description, len(req.Ops), "rejected")
			return
		}
		cmds = append(cmds, cmd)
	}

	// Wrap in AgentPatchCommand and record in agent history
	patch := controller.NewAgentPatchCommand(cmds, req.Description)
	sess.History.PushDone(patch)

	// Mark the spreadsheet as having unsaved changes (AC1).
	// Individual command Do() calls may set Modified via model methods, but we
	// set it explicitly here so the invariant holds regardless of op type.
	s.Ctrl.Sheet.Modified = true

	s.Ctrl.Agent.LogPatch(sess.AgentID, filePath, req.Description, len(req.Ops), "applied")

	s.broadcastEvent("cells_changed")

	writeJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"opsCount": len(req.Ops),
	})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// broadcastEvent sends an event to all connected SSE clients via the broker.
// No-op if the broker is not set (test mode or standalone dev without SSE).
func (s *Server) broadcastEvent(name string) {
	if s.Broker != nil {
		s.Broker.Broadcast(controller.Event{Name: name})
	}
}

func validatePatchOp(op patchOp) error {
	switch op.Op {
	case "SetCell":
		return nil
	case "ClearRange":
		if op.EndRow < op.StartRow || op.EndCol < op.StartCol {
			return fmt.Errorf("ClearRange: endRow/endCol must be >= startRow/startCol")
		}
	case "InsertRow", "DeleteRow":
		if op.Row < 0 {
			return fmt.Errorf("%s: row must be >= 0", op.Op)
		}
	case "InsertColumn", "DeleteColumn":
		if op.Col < 0 {
			return fmt.Errorf("%s: col must be >= 0", op.Op)
		}
	case "SetStyle":
		return nil
	case "AddStyle":
		if strings.TrimSpace(op.Name) == "" {
			return fmt.Errorf("AddStyle: name is required")
		}
	case "ClearFormat":
		if op.EndRow < op.StartRow || op.EndCol < op.StartCol {
			return fmt.Errorf("ClearFormat: endRow/endCol must be >= startRow/startCol")
		}
	default:
		return fmt.Errorf("unknown op: %s", op.Op)
	}
	return nil
}

func (s *Server) buildPatchCommand(op patchOp) (controller.Command, error) {
	switch op.Op {
	case "SetCell":
		return controller.NewAgentSetCellCommand(s.Ctrl, op.Row, op.Col, op.Value), nil
	case "ClearRange":
		return controller.NewAgentClearRangeCommand(s.Ctrl, op.StartRow, op.StartCol, op.EndRow, op.EndCol), nil
	case "InsertRow":
		return controller.NewAgentInsertRowCommand(s.Ctrl, op.Row), nil
	case "DeleteRow":
		return controller.NewAgentDeleteRowCommand(s.Ctrl, op.Row), nil
	case "InsertColumn":
		return controller.NewAgentInsertColumnCommand(s.Ctrl, op.Col), nil
	case "DeleteColumn":
		return controller.NewAgentDeleteColumnCommand(s.Ctrl, op.Col), nil
	case "SetStyle":
		return controller.NewAgentSetStyleCommand(s.Ctrl, op.Row, op.Col, op.StyleID, op.Alignment), nil
	case "AddStyle":
		return controller.NewAgentAddStyleCommand(s.Ctrl, op.Name, op.FontColor, op.FillColor), nil
	case "ClearFormat":
		return controller.NewAgentClearFormatCommand(s.Ctrl, op.StartRow, op.StartCol, op.EndRow, op.EndCol), nil
	default:
		return nil, fmt.Errorf("unknown op: %s", op.Op)
	}
}

func (s *Server) buildWorkbookSummary() map[string]any {
	s.Ctrl.RLockForAgent()
	defer s.Ctrl.RUnlockForAgent()

	sheet := s.Ctrl.Sheet
	filePath := sheet.FilePath // read inside RLock — safe
	cellCount := 0
	minRow, maxRow := -1, -1
	minCol, maxCol := -1, -1

	for row, rowMap := range sheet.Cells {
		for col, cell := range rowMap {
			if cell == nil || cell.Value == "" {
				continue
			}
			cellCount++
			if minRow < 0 || row < minRow {
				minRow = row
			}
			if row > maxRow {
				maxRow = row
			}
			if minCol < 0 || col < minCol {
				minCol = col
			}
			if col > maxCol {
				maxCol = col
			}
		}
	}

	dims := map[string]any{"rows": 0, "cols": 0}
	if minRow >= 0 {
		dims["rows"] = maxRow + 1
		dims["cols"] = maxCol + 1
		dims["usedRange"] = fmt.Sprintf("%s:%s",
			model.CoordsToRef(minRow, minCol),
			model.CoordsToRef(maxRow, maxCol))
	}

	return map[string]any{
		"filePath":   filePath,
		"cellCount":  cellCount,
		"dimensions": dims,
		"modified":   sheet.Modified,
	}
}

// parseA1Range parses "A1:D10" or single "A1" into row/col bounds (0-indexed).
func parseA1Range(s string) (startRow, startCol, endRow, endCol int, err error) {
	parts := strings.SplitN(strings.ToUpper(s), ":", 2)
	startRow, startCol, err = model.RefToCoords(parts[0])
	if err != nil {
		return 0, 0, 0, 0, fmt.Errorf("invalid start ref %q: %w", parts[0], err)
	}
	if len(parts) == 1 {
		return startRow, startCol, startRow, startCol, nil
	}
	endRow, endCol, err = model.RefToCoords(parts[1])
	if err != nil {
		return 0, 0, 0, 0, fmt.Errorf("invalid end ref %q: %w", parts[1], err)
	}
	if endRow < startRow || endCol < startCol {
		return 0, 0, 0, 0, fmt.Errorf("end of range must be >= start")
	}
	return
}

// agentToolDefinitions returns OpenAI-compatible tool definitions for the agent.
func agentToolDefinitions() []map[string]any {
	return []map[string]any{
		{
			"name":        "get_workbook",
			"description": "Get a summary of the current spreadsheet workbook (file path, dimensions, cell count).",
			"input_schema": map[string]any{
				"type":       "object",
				"properties": map[string]any{},
				"required":   []string{},
			},
		},
		{
			"name":        "get_range",
			"description": "Read cell values in an A1-notation range (e.g. \"A1:D10\"). Returns raw values, computed values, formulas, style IDs, and alignment for each cell. Max 10,000 cells per call.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"range": map[string]any{
						"type":        "string",
						"description": "A1 range notation, e.g. \"A1:D10\" or single cell \"B3\"",
					},
				},
				"required": []string{"range"},
			},
		},
		{
			"name":        "apply_patch",
			"description": "Apply a batch of operations atomically to the spreadsheet. All ops succeed or all fail. Supported ops: SetCell, ClearRange, InsertRow, DeleteRow, InsertColumn, DeleteColumn, SetStyle, AddStyle, ClearFormat.",
			"input_schema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"description": map[string]any{
						"type":        "string",
						"description": "Human-readable description of what this patch does (recorded in audit log)",
					},
					"ops": map[string]any{
						"type":        "array",
						"description": "List of operations to apply",
						"items": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"op":        map[string]any{"type": "string", "description": "Operation type"},
								"row":       map[string]any{"type": "integer"},
								"col":       map[string]any{"type": "integer"},
								"startRow":  map[string]any{"type": "integer"},
								"startCol":  map[string]any{"type": "integer"},
								"endRow":    map[string]any{"type": "integer"},
								"endCol":    map[string]any{"type": "integer"},
								"value":     map[string]any{"type": "string"},
								"styleId":   map[string]any{"type": "integer"},
								"alignment": map[string]any{"type": "string", "enum": []string{"", "left", "center", "right"}},
								"name":      map[string]any{"type": "string"},
								"fontColor": map[string]any{"type": "string"},
								"fillColor": map[string]any{"type": "string"},
							},
							"required": []string{"op"},
						},
					},
				},
				"required": []string{"ops"},
			},
		},
		{
			"name":        "commit",
			"description": "Checkpoint: collapse all agent operations since the last commit into a single undo entry in the user's history. The session remains active and the token is not revoked.",
			"input_schema": map[string]any{
				"type":       "object",
				"properties": map[string]any{},
				"required":   []string{},
			},
		},
		{
			"name":        "end_session",
			"description": "Declare success and close the agent session. Any uncommitted changes are folded into the user's undo history. The token is revoked.",
			"input_schema": map[string]any{
				"type":       "object",
				"properties": map[string]any{},
				"required":   []string{},
			},
		},
		{
			"name":        "rollback",
			"description": "Discard all agent changes since the last commit and close the session. The token is revoked.",
			"input_schema": map[string]any{
				"type":       "object",
				"properties": map[string]any{},
				"required":   []string{},
			},
		},
	}
}
