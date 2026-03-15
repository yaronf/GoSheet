package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gosheet/controller"
)

// ── Test helpers ──────────────────────────────────────────────────────────────

const testBootstrap = "test-bootstrap-token-1234"

// newAgentServer creates a Server with auth enabled (non-empty bootstrap token).
func newAgentServer() *Server {
	return NewServer(controller.NewAppController(), testBootstrap)
}

// bootstrapHeader returns an Authorization header using the bootstrap token.
func bootstrapHeader() (string, string) {
	return "Authorization", "Bearer " + testBootstrap
}

// issueAgentToken opens a session and returns the agent token.
func issueAgentToken(t *testing.T, srv *Server, scope string) string {
	t.Helper()
	body := fmt.Sprintf(`{"scope":%q}`, scope)
	req := httptest.NewRequest(http.MethodPost, "/api/agent/token", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(bootstrapHeader())
	w := httptest.NewRecorder()
	srv.HandleAgentToken(w, req)
	require.Equal(t, http.StatusOK, w.Code, "issueAgentToken: %s", w.Body.String())
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	tok, ok := resp["agentToken"].(string)
	require.True(t, ok && tok != "", "expected non-empty agentToken")
	return tok
}

// agentHeader returns an Authorization header using an agent token.
func agentHeader(token string) (string, string) {
	return "Authorization", "Bearer " + token
}

func decodeJSON(t *testing.T, body *bytes.Buffer) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.NewDecoder(body).Decode(&m))
	return m
}

// ── AuthMiddleware ────────────────────────────────────────────────────────────

func TestAuthMiddleware_NoToken(t *testing.T) {
	srv := newAgentServer()
	called := false
	handler := srv.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})
	req := httptest.NewRequest(http.MethodGet, "/api/cell/value", nil)
	w := httptest.NewRecorder()
	handler(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.False(t, called)
}

func TestAuthMiddleware_BootstrapToken(t *testing.T) {
	srv := newAgentServer()
	called := false
	handler := srv.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodGet, "/api/cell/value", nil)
	req.Header.Set(bootstrapHeader())
	w := httptest.NewRecorder()
	handler(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, called)
}

func TestAuthMiddleware_AgentTokenAllowed(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	called := false
	handler := srv.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodGet, "/api/agent/workbook", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	handler(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, called)
}

func TestAuthMiddleware_AgentTokenBlockedOnFileEndpoint(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	called := false
	handler := srv.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})
	req := httptest.NewRequest(http.MethodPost, "/api/file/save", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	handler(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.False(t, called)
}

func TestAuthMiddleware_ROAgentTokenBlocksWrite(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "ro")

	called := false
	handler := srv.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	handler(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.False(t, called)
}

func TestAuthMiddleware_Disabled(t *testing.T) {
	srv := newTestServer() // empty token = auth disabled
	called := false
	handler := srv.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodGet, "/api/cell/value", nil)
	w := httptest.NewRecorder()
	handler(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, called)
}

// TestAuthMiddleware_DisabledAgentTokenBlockedOnFileEndpoint: in test mode (bootstrapToken==""),
// agent tokens must still be rejected on /api/file/* endpoints.
func TestAuthMiddleware_DisabledAgentTokenBlockedOnFileEndpoint(t *testing.T) {
	srv := newTestServer() // empty token = auth disabled (simulates NODE_ENV=test)
	// In disabled mode we can issue agent token without bootstrap
	body := `{"scope":"rw"}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/token", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleAgentToken(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	tok, ok := resp["agentToken"].(string)
	require.True(t, ok && tok != "")

	called := false
	handler := srv.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	req2 := httptest.NewRequest(http.MethodGet, "/api/file/status", nil)
	req2.Header.Set(agentHeader(tok))
	w2 := httptest.NewRecorder()
	handler(w2, req2)
	assert.Equal(t, http.StatusForbidden, w2.Code)
	assert.False(t, called)
}

func TestAuthMiddleware_QueryParamTokenOnNonAgentEndpoint(t *testing.T) {
	srv := newAgentServer()
	called := false
	handler := srv.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	// Bootstrap token passed as ?token= query param — should be accepted on any /api/* endpoint.
	req := httptest.NewRequest(http.MethodGet, "/api/cell/value?token="+testBootstrap, nil)
	w := httptest.NewRecorder()
	handler(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, called)
}

// ── HandleAgentToken ──────────────────────────────────────────────────────────

func TestHandleAgentToken_IssuesToken(t *testing.T) {
	srv := newAgentServer()
	body := `{"scope":"rw"}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/token", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(bootstrapHeader())
	w := httptest.NewRecorder()
	srv.HandleAgentToken(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])
	assert.NotEmpty(t, m["agentToken"])
	assert.NotEmpty(t, m["agentId"])
}

func TestHandleAgentToken_DefaultsToRW(t *testing.T) {
	srv := newAgentServer()
	body := `{"scope":"invalid"}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/token", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(bootstrapHeader())
	w := httptest.NewRecorder()
	srv.HandleAgentToken(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleAgentToken_ConflictWhenSessionActive(t *testing.T) {
	srv := newAgentServer()
	_ = issueAgentToken(t, srv, "rw")

	// Second issuance should conflict
	body := `{"scope":"rw"}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/token", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(bootstrapHeader())
	w := httptest.NewRecorder()
	srv.HandleAgentToken(w, req)
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestHandleAgentToken_MethodNotAllowed(t *testing.T) {
	srv := newAgentServer()
	req := httptest.NewRequest(http.MethodGet, "/api/agent/token", nil)
	req.Header.Set(bootstrapHeader())
	w := httptest.NewRecorder()
	srv.HandleAgentToken(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleAgentToken_AgentTokenRejected(t *testing.T) {
	srv := newAgentServer()
	// Issue a session first with the bootstrap token
	agentTok := issueAgentToken(t, srv, "rw")
	// End it so there's no conflict
	endReq := httptest.NewRequest(http.MethodPost, "/api/agent/end", nil)
	endReq.Header.Set(agentHeader(agentTok))
	srv.HandleAgentEnd(httptest.NewRecorder(), endReq)

	// Now try to open a new session using the agent token — must be rejected
	srv2 := newAgentServer() // fresh server with no active session
	body := `{"scope":"rw"}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/token", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(agentTok)) // agent token, NOT bootstrap
	w := httptest.NewRecorder()
	srv2.HandleAgentToken(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

// ── HandleAgentBootstrap ──────────────────────────────────────────────────────

func TestHandleAgentBootstrap_ReturnsToolsAndWorkbook(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/bootstrap?token="+tok, nil)
	w := httptest.NewRecorder()
	srv.HandleAgentBootstrap(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])
	assert.NotNil(t, m["tools"])
	assert.NotNil(t, m["workbook"])
	assert.NotNil(t, m["session"])
	tools, ok := m["tools"].([]any)
	require.True(t, ok)
	assert.Len(t, tools, 6)
}

func TestHandleAgentBootstrap_BearerTokenAlsoWorks(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "ro")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/bootstrap", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentBootstrap(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleAgentBootstrap_NoToken(t *testing.T) {
	srv := newAgentServer()
	// Open a session so there's a valid session to not use
	_ = issueAgentToken(t, srv, "rw")
	req := httptest.NewRequest(http.MethodGet, "/api/agent/bootstrap", nil)
	w := httptest.NewRecorder()
	srv.HandleAgentBootstrap(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestHandleAgentBootstrap_ToolNames(t *testing.T) {
	// AC2: tools array must have exactly the 6 expected names.
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/bootstrap?token="+tok, nil)
	w := httptest.NewRecorder()
	srv.HandleAgentBootstrap(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	tools, ok := m["tools"].([]any)
	require.True(t, ok)
	require.Len(t, tools, 6)

	names := make([]string, 0, 6)
	for _, item := range tools {
		tool, ok := item.(map[string]any)
		require.True(t, ok, "tool must be a JSON object")
		names = append(names, tool["name"].(string))
	}
	assert.ElementsMatch(t, []string{"get_workbook", "get_range", "apply_patch", "commit", "end_session", "rollback"}, names)
}

func TestHandleAgentBootstrap_BaseURLFromHost(t *testing.T) {
	// AC3: session.baseUrl must be set from the request Host header.
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/bootstrap?token="+tok, nil)
	req.Host = "localhost:54321"
	w := httptest.NewRecorder()
	srv.HandleAgentBootstrap(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	sess, ok := m["session"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "http://localhost:54321", sess["baseUrl"])
}

func TestHandleAgentBootstrap_WorkbookFields(t *testing.T) {
	// AC6: workbook must contain filePath, cellCount, dimensions, modified.
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/bootstrap?token="+tok, nil)
	w := httptest.NewRecorder()
	srv.HandleAgentBootstrap(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	wb, ok := m["workbook"].(map[string]any)
	require.True(t, ok)
	assert.Contains(t, wb, "filePath")
	assert.Contains(t, wb, "cellCount")
	assert.Contains(t, wb, "dimensions")
	assert.Contains(t, wb, "modified")
}

func TestHandleAgentBootstrap_MethodNotAllowed(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	req := httptest.NewRequest(http.MethodPost, "/api/agent/bootstrap?token="+tok, nil)
	w := httptest.NewRecorder()
	srv.HandleAgentBootstrap(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
}

// ── HandleAgentWorkbook ───────────────────────────────────────────────────────

func TestHandleAgentWorkbook_ReturnsWorkbook(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "ro")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/workbook", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentWorkbook(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])
	assert.NotNil(t, m["workbook"])
}

func TestHandleAgentWorkbook_RejectsInvalidToken(t *testing.T) {
	srv := newAgentServer()
	// No session opened — any token is invalid
	req := httptest.NewRequest(http.MethodGet, "/api/agent/workbook", nil)
	req.Header.Set("Authorization", "Bearer bogus-token")
	w := httptest.NewRecorder()
	srv.HandleAgentWorkbook(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// ── HandleAgentRange ──────────────────────────────────────────────────────────

func TestHandleAgentRange_ReturnsCells(t *testing.T) {
	srv := newAgentServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "hello"))
	require.NoError(t, srv.Ctrl.SetCellValue(0, 1, "world"))
	tok := issueAgentToken(t, srv, "ro")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/range?range=A1:B1", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentRange(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])
	cells, ok := m["cells"].([]any)
	require.True(t, ok)
	assert.Len(t, cells, 2)
}

func TestHandleAgentRange_MissingRangeParam(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "ro")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/range", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentRange(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleAgentRange_InvalidRange(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "ro")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/range?range=notarange", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentRange(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleAgentRange_RangeTooLarge(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "ro")

	// A1:CZZ1000 would be > 10000 cells
	req := httptest.NewRequest(http.MethodGet, "/api/agent/range?range=A1:ZZZ1000", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentRange(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Contains(t, m["error"], "range too large")
}

func TestHandleAgentRange_SingleCell(t *testing.T) {
	srv := newAgentServer()
	require.NoError(t, srv.Ctrl.SetCellValue(1, 2, "42"))
	tok := issueAgentToken(t, srv, "ro")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/range?range=C2", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentRange(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	cells, ok := m["cells"].([]any)
	require.True(t, ok)
	assert.Len(t, cells, 1)
	cell := cells[0].(map[string]any)
	assert.Equal(t, "42", cell["raw"])
}

// ── HandleAgentPatch ──────────────────────────────────────────────────────────

func TestHandleAgentPatch_SetCell(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	body := `{"description":"set A1","ops":[{"op":"SetCell","row":0,"col":0,"value":"hello"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])
	assert.Equal(t, float64(1), m["opsCount"])

	// Verify cell was actually set
	cell := srv.Ctrl.Sheet.GetCell(0, 0)
	require.NotNil(t, cell)
	assert.Equal(t, "hello", cell.Value)
}

func TestHandleAgentPatch_ROTokenRejected(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "ro")

	body := `{"ops":[{"op":"SetCell","row":0,"col":0,"value":"x"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestHandleAgentPatch_EmptyOps(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	body := `{"ops":[]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleAgentPatch_UnknownOp(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	body := `{"ops":[{"op":"Explode","row":0,"col":0}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Contains(t, m["error"], "unknown op")
}

func TestHandleAgentPatch_MultipleCellsAndClearRange(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	body := `{"ops":[
		{"op":"SetCell","row":0,"col":0,"value":"a"},
		{"op":"SetCell","row":0,"col":1,"value":"b"},
		{"op":"ClearRange","startRow":0,"startCol":0,"endRow":0,"endCol":1}
	]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, float64(3), m["opsCount"])
}

func TestHandleAgentPatch_AddStyle(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	body := `{"ops":[{"op":"AddStyle","name":"Bold","fontColor":"#000","fillColor":"#ff0"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleAgentPatch_AddStyleMissingName(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	body := `{"ops":[{"op":"AddStyle","name":""}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleAgentPatch_InvalidJSONBody(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString("not-json"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ── HandleAgentCommit ─────────────────────────────────────────────────────────

func TestHandleAgentCommit_CollapsesPatchIntoHistory(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	// Apply a patch first
	patchBody := `{"ops":[{"op":"SetCell","row":0,"col":0,"value":"v"}]}`
	pReq := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(patchBody))
	pReq.Header.Set("Content-Type", "application/json")
	pReq.Header.Set(agentHeader(tok))
	pW := httptest.NewRecorder()
	srv.HandleAgentPatch(pW, pReq)
	require.Equal(t, http.StatusOK, pW.Code)

	req := httptest.NewRequest(http.MethodPost, "/api/agent/commit", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentCommit(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])
}

func TestHandleAgentCommit_InvalidToken(t *testing.T) {
	srv := newAgentServer()
	req := httptest.NewRequest(http.MethodPost, "/api/agent/commit", nil)
	req.Header.Set("Authorization", "Bearer badtoken")
	w := httptest.NewRecorder()
	srv.HandleAgentCommit(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// ── HandleAgentEnd ────────────────────────────────────────────────────────────

func TestHandleAgentEnd_EndsSession(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	req := httptest.NewRequest(http.MethodPost, "/api/agent/end", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentEnd(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])

	// Token should now be invalid
	req2 := httptest.NewRequest(http.MethodGet, "/api/agent/workbook", nil)
	req2.Header.Set(agentHeader(tok))
	w2 := httptest.NewRecorder()
	srv.HandleAgentWorkbook(w2, req2)
	assert.Equal(t, http.StatusUnauthorized, w2.Code)
}

func TestHandleAgentEnd_InvalidToken(t *testing.T) {
	srv := newAgentServer()
	req := httptest.NewRequest(http.MethodPost, "/api/agent/end", nil)
	req.Header.Set("Authorization", "Bearer deadtoken")
	w := httptest.NewRecorder()
	srv.HandleAgentEnd(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// ── HandleAgentRollback ───────────────────────────────────────────────────────

func TestHandleAgentRollback_RevertsChanges(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	// Apply a patch
	patchBody := `{"ops":[{"op":"SetCell","row":5,"col":5,"value":"before-rollback"}]}`
	pReq := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(patchBody))
	pReq.Header.Set("Content-Type", "application/json")
	pReq.Header.Set(agentHeader(tok))
	pW := httptest.NewRecorder()
	srv.HandleAgentPatch(pW, pReq)
	require.Equal(t, http.StatusOK, pW.Code)

	// Verify it was applied
	cell := srv.Ctrl.Sheet.GetCell(5, 5)
	require.NotNil(t, cell)
	assert.Equal(t, "before-rollback", cell.Value)

	// Rollback
	req := httptest.NewRequest(http.MethodPost, "/api/agent/rollback", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentRollback(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Cell should be cleared
	cellAfter := srv.Ctrl.Sheet.GetCell(5, 5)
	assert.True(t, cellAfter == nil || cellAfter.Value == "")

	// Token revoked after rollback
	req2 := httptest.NewRequest(http.MethodGet, "/api/agent/workbook", nil)
	req2.Header.Set(agentHeader(tok))
	w2 := httptest.NewRecorder()
	srv.HandleAgentWorkbook(w2, req2)
	assert.Equal(t, http.StatusUnauthorized, w2.Code)
}

// ── HandleAdminEndSession ─────────────────────────────────────────────────────

func TestHandleAdminEndSession_EndsActiveSession(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	req := httptest.NewRequest(http.MethodPost, "/api/agent/session/end", nil)
	req.Header.Set(bootstrapHeader())
	w := httptest.NewRecorder()
	srv.HandleAdminEndSession(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])

	// Agent token should now be invalid
	req2 := httptest.NewRequest(http.MethodGet, "/api/agent/workbook", nil)
	req2.Header.Set(agentHeader(tok))
	w2 := httptest.NewRecorder()
	srv.HandleAgentWorkbook(w2, req2)
	assert.Equal(t, http.StatusUnauthorized, w2.Code)
}

func TestHandleAdminEndSession_NoActiveSession(t *testing.T) {
	srv := newAgentServer()
	req := httptest.NewRequest(http.MethodPost, "/api/agent/session/end", nil)
	req.Header.Set(bootstrapHeader())
	w := httptest.NewRecorder()
	srv.HandleAdminEndSession(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])
	assert.Equal(t, "no active session", m["message"])
}

// ── HandleAgentSessionStatus ──────────────────────────────────────────────────

func TestHandleAgentSessionStatus_Inactive(t *testing.T) {
	srv := newAgentServer()
	req := httptest.NewRequest(http.MethodGet, "/api/agent/session/status", nil)
	req.Header.Set(bootstrapHeader())
	w := httptest.NewRecorder()
	srv.HandleAgentSessionStatus(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])
	assert.Equal(t, false, m["active"])
}

func TestHandleAgentSessionStatus_Active(t *testing.T) {
	srv := newAgentServer()
	_ = issueAgentToken(t, srv, "rw")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/session/status", nil)
	req.Header.Set(bootstrapHeader())
	w := httptest.NewRecorder()
	srv.HandleAgentSessionStatus(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, true, m["success"])
	assert.Equal(t, true, m["active"])
	assert.NotEmpty(t, m["agentId"])
	assert.Equal(t, "rw", m["scope"])
}

// ── parseA1Range ──────────────────────────────────────────────────────────────

func TestParseA1Range_ValidRange(t *testing.T) {
	sr, sc, er, ec, err := parseA1Range("A1:C3")
	require.NoError(t, err)
	assert.Equal(t, 0, sr)
	assert.Equal(t, 0, sc)
	assert.Equal(t, 2, er)
	assert.Equal(t, 2, ec)
}

func TestParseA1Range_SingleCell(t *testing.T) {
	sr, sc, er, ec, err := parseA1Range("B2")
	require.NoError(t, err)
	assert.Equal(t, 1, sr)
	assert.Equal(t, 1, sc)
	assert.Equal(t, 1, er)
	assert.Equal(t, 1, ec)
}

func TestParseA1Range_InvertedRange(t *testing.T) {
	_, _, _, _, err := parseA1Range("C3:A1")
	assert.Error(t, err)
}

func TestParseA1Range_InvalidRef(t *testing.T) {
	_, _, _, _, err := parseA1Range("badref")
	assert.Error(t, err)
}

// ── buildWorkbookSummary ──────────────────────────────────────────────────────

func TestBuildWorkbookSummary_EmptySheet(t *testing.T) {
	srv := newTestServer()
	wb := srv.buildWorkbookSummary()
	assert.Equal(t, 0, wb["cellCount"])
	dims := wb["dimensions"].(map[string]any)
	assert.Equal(t, 0, dims["rows"])
}

func TestBuildWorkbookSummary_WithData(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "x"))
	require.NoError(t, srv.Ctrl.SetCellValue(2, 3, "y"))

	wb := srv.buildWorkbookSummary()
	assert.Equal(t, 2, wb["cellCount"])
	dims := wb["dimensions"].(map[string]any)
	assert.Equal(t, 3, dims["rows"])
	assert.Equal(t, 4, dims["cols"])
	assert.Equal(t, "A1:D3", dims["usedRange"])
}

// ── Auth-enabled patch test (confirms no deadlock with real bootstrap token) ──

func TestHandleAgentPatch_WithAuthEnabled(t *testing.T) {
	// Use a non-empty bootstrap token — auth is fully enforced
	srv := newAgentServer() // uses testBootstrap = "test-bootstrap-token-1234"

	// Issue token via bootstrap auth
	tok := issueAgentToken(t, srv, "rw")

	// Patch through the full auth middleware stack
	body := `{"description":"auth test","ops":[{"op":"SetCell","row":0,"col":0,"value":"auth-ok"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))

	// Route through AuthMiddleware like the real server does
	w := httptest.NewRecorder()
	srv.AuthMiddleware(srv.HandleAgentPatch)(w, req)

	assert.Equal(t, http.StatusOK, w.Code, w.Body.String())
	cell := srv.Ctrl.Sheet.GetCell(0, 0)
	require.NotNil(t, cell)
	assert.Equal(t, "auth-ok", cell.Value)
}

// ── HandleAgentPatch — Story 20.4 additional AC coverage ─────────────────────

func TestHandleAgentPatch_MarksSheetModified(t *testing.T) {
	// AC1: spreadsheet must be marked modified after a successful patch.
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")
	srv.Ctrl.Sheet.Modified = false // ensure clean baseline

	body := `{"description":"set A1","ops":[{"op":"SetCell","row":0,"col":0,"value":"hello"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.True(t, srv.Ctrl.Sheet.Modified, "sheet must be marked modified after patch (AC1)")
}

func TestHandleAgentPatch_AtomicRejectionDoesNotModify(t *testing.T) {
	// AC2: unknown op in position 1 — first op (valid) must NOT be applied.
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")
	srv.Ctrl.Sheet.Modified = false

	body := `{"ops":[{"op":"SetCell","row":1,"col":0,"value":"first"},{"op":"DoSomethingIllegal","row":0,"col":0}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, false, m["success"])
	assert.Equal(t, float64(1), m["failingOpIdx"])
	// Atomic: first op must NOT have been applied
	assert.Nil(t, srv.Ctrl.Sheet.GetCell(1, 0), "no ops applied on validation failure (AC2)")
	assert.False(t, srv.Ctrl.Sheet.Modified, "sheet must not be modified on rejected patch")
}

func TestHandleAgentPatch_InsertAndDeleteRow(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "row0"))

	body := `{"ops":[{"op":"InsertRow","row":0}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	body2 := `{"ops":[{"op":"DeleteRow","row":0}]}`
	req2 := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body2))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set(agentHeader(tok))
	w2 := httptest.NewRecorder()
	srv.HandleAgentPatch(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)
}

func TestHandleAgentPatch_InsertAndDeleteColumn(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	body := `{"ops":[{"op":"InsertColumn","col":0}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	body2 := `{"ops":[{"op":"DeleteColumn","col":0}]}`
	req2 := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body2))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set(agentHeader(tok))
	w2 := httptest.NewRecorder()
	srv.HandleAgentPatch(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)
}

func TestHandleAgentPatch_SetStyleAlignment(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "styled"))

	// styleId=0 with alignment creates Align-center style and applies it
	body := `{"ops":[{"op":"SetStyle","row":0,"col":0,"styleId":0,"alignment":"center"}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	cell := srv.Ctrl.Sheet.GetCell(0, 0)
	require.NotNil(t, cell)
	format := srv.Ctrl.Sheet.Styles.GetFormat(cell.StyleId)
	require.NotNil(t, format)
	assert.Equal(t, "center", format.Alignment.Horizontal)
}

func TestHandleAgentPatch_ClearFormat(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	body := `{"ops":[{"op":"ClearFormat","startRow":0,"startCol":0,"endRow":1,"endCol":1}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandleAgentPatch_InvalidClearRangeBounds(t *testing.T) {
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	// endRow < startRow — reversed bounds (AC2)
	body := `{"ops":[{"op":"ClearRange","startRow":5,"startCol":0,"endRow":2,"endCol":0}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/agent/patch", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	m := decodeJSON(t, w.Body)
	assert.Equal(t, false, m["success"])
	assert.Equal(t, float64(0), m["failingOpIdx"])
}

func TestHandleAgentPatch_MethodNotAllowed(t *testing.T) {
	// Method-not-allowed must return JSON (consistent with other agent endpoints).
	srv := newAgentServer()
	tok := issueAgentToken(t, srv, "rw")

	req := httptest.NewRequest(http.MethodGet, "/api/agent/patch", nil)
	req.Header.Set(agentHeader(tok))
	w := httptest.NewRecorder()
	srv.HandleAgentPatch(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
}
