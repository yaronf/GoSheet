package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gosheet/api/generated"
	"gosheet/controller"
	"gosheet/model"
)

func newTestServer() *Server {
	return NewServer(controller.NewAppController(), "") // empty token = auth disabled
}

func TestNewServer(t *testing.T) {
	ctrl := controller.NewAppController()
	srv := NewServer(ctrl, "")
	assert.NotNil(t, srv)
	assert.Equal(t, ctrl, srv.Ctrl)
}

func TestHandleGetCellValue(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "42"))

	req := httptest.NewRequest(http.MethodGet, "/api/cell/value?row=0&col=0", nil)
	w := httptest.NewRecorder()
	srv.HandleGetCellValue(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Computed string `json:"computed"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Equal(t, "42", resp.Data.Computed)
}

func TestHandleGetCellRawValue(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "=1+1"))

	req := httptest.NewRequest(http.MethodGet, "/api/cell/raw?row=0&col=0", nil)
	w := httptest.NewRecorder()
	srv.HandleGetCellRawValue(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Value string `json:"value"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Contains(t, resp.Data.Value, "1+1")
}

func TestHandleSetCellValue(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(generated.SetCellRequest{Row: 0, Col: 0, Value: "Hello"})

	req := httptest.NewRequest(http.MethodPost, "/api/cell/set", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSetCellValue(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Value        string `json:"value"`
			DisplayValue string `json:"displayValue"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Equal(t, "Hello", resp.Data.Value)
	assert.Equal(t, "Hello", resp.Data.DisplayValue)
}

func TestHandleSetCellValue_InvalidJSON(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/cell/set", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSetCellValue(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleGetCellRef(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/cell/ref?row=0&col=1", nil)
	w := httptest.NewRecorder()
	srv.HandleGetCellRef(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var ref string
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&ref))
	assert.Equal(t, "B1", ref)
}

func TestHandleGetAllCells(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "A1"))
	require.NoError(t, srv.Ctrl.SetCellValue(1, 1, "B2"))

	req := httptest.NewRequest(http.MethodGet, "/api/cells/all", nil)
	w := httptest.NewRecorder()
	srv.HandleGetAllCells(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool             `json:"success"`
		Data    []map[string]any `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Len(t, resp.Data, 2)
}

func TestHandleGetAllCells_WithMerges(t *testing.T) {
	// Story 11.6: Covered cells omitted; only anchor included
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "anchor"))
	_ = srv.Ctrl.SetMerge(0, 0, 1, 3) // A1:C1 merged

	req := httptest.NewRequest(http.MethodGet, "/api/cells/all", nil)
	w := httptest.NewRecorder()
	srv.HandleGetAllCells(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool             `json:"success"`
		Data    []map[string]any `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Len(t, resp.Data, 1) // Only anchor, not B1/C1
	assert.Equal(t, "anchor", resp.Data[0]["computed"])
}

func TestHandleNewFile(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "data"))

	req := httptest.NewRequest(http.MethodPost, "/api/file/new", nil)
	w := httptest.NewRecorder()
	srv.HandleNewFile(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, srv.Ctrl.GetCellValue(0, 0))
}

func TestHandleFileStatus(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/file/status", nil)
	w := httptest.NewRecorder()
	srv.HandleFileStatus(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Path     string `json:"path"`
			Filename string `json:"filename"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Equal(t, "Untitled", resp.Data.Filename)
}

func TestHandleFileStatus_WithLoadedFile(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "x"))
	tmpfile := filepath.Join(t.TempDir(), "mydoc.gosheet")
	assert.NoError(t, srv.Ctrl.SaveFile(tmpfile))

	req := httptest.NewRequest(http.MethodGet, "/api/file/status", nil)
	w := httptest.NewRecorder()
	srv.HandleFileStatus(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Path     string `json:"path"`
			Filename string `json:"filename"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Equal(t, "mydoc.gosheet", resp.Data.Filename)
}

func TestHandleSaveFile(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "test"))
	tmpfile := filepath.Join(t.TempDir(), "save.gosheet")
	body, _ := json.Marshal(generated.PathRequest{Path: tmpfile})

	req := httptest.NewRequest(http.MethodPost, "/api/file/save", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSaveFile(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	info, err := os.Stat(tmpfile)
	assert.NoError(t, err)
	assert.Greater(t, info.Size(), int64(0))
}

func TestHandleSaveFile_EmptyPath(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(generated.PathRequest{Path: ""})
	req := httptest.NewRequest(http.MethodPost, "/api/file/save", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSaveFile(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleSaveFile_InvalidJSON(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/file/save", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSaveFile(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleSaveFile_UnwritablePath(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "x"))
	// Parent dir does not exist
	body, _ := json.Marshal(generated.PathRequest{Path: "/nonexistent/parent/dir/file.gosheet"})
	req := httptest.NewRequest(http.MethodPost, "/api/file/save", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSaveFile(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandleLoadFile(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "loaded"))
	tmpfile := filepath.Join(t.TempDir(), "load.gosheet")
	assert.NoError(t, srv.Ctrl.SaveFile(tmpfile))

	srv2 := newTestServer()
	body, _ := json.Marshal(generated.PathRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/file/load", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv2.HandleLoadFile(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "loaded", srv2.Ctrl.GetCellValue(0, 0))
}

func TestHandleLoadFile_NotFound(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(generated.PathRequest{Path: "/nonexistent/file.gosheet"})
	req := httptest.NewRequest(http.MethodPost, "/api/file/load", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleLoadFile(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandleLoadFile_InvalidJSON(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/file/load", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleLoadFile(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleLoadFile_EmptyPath(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(generated.PathRequest{Path: ""})
	req := httptest.NewRequest(http.MethodPost, "/api/file/load", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleLoadFile(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleFileStatus_FilepathBase(t *testing.T) {
	// Regression: filename extraction previously used strings.Split("/") which
	// fails on Windows paths. Now uses filepath.Base.
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "x"))
	// Use a real temp file so SaveFile sets the path
	tmpfile := filepath.Join(t.TempDir(), "my spreadsheet.gosheet")
	assert.NoError(t, srv.Ctrl.SaveFile(tmpfile))

	req := httptest.NewRequest(http.MethodGet, "/api/file/status", nil)
	w := httptest.NewRecorder()
	srv.HandleFileStatus(w, req)

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Filename string `json:"filename"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Equal(t, "my spreadsheet.gosheet", resp.Data.Filename)
}

func TestHandleGetCellValue_BadParams(t *testing.T) {
	srv := newTestServer()
	// Non-numeric row
	req := httptest.NewRequest(http.MethodGet, "/api/cell/value?row=abc&col=0", nil)
	w := httptest.NewRecorder()
	srv.HandleGetCellValue(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)

	// Non-numeric col
	req2 := httptest.NewRequest(http.MethodGet, "/api/cell/value?row=0&col=xyz", nil)
	w2 := httptest.NewRecorder()
	srv.HandleGetCellValue(w2, req2)
	assert.Equal(t, http.StatusBadRequest, w2.Code)
}

func TestHandleGetCellRawValue_BadParams(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/cell/raw?row=bad&col=0", nil)
	w := httptest.NewRecorder()
	srv.HandleGetCellRawValue(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleCSVPreview(t *testing.T) {
	srv := newTestServer()
	tmpfile := filepath.Join(t.TempDir(), "preview.csv")
	assert.NoError(t, os.WriteFile(tmpfile, []byte("a,b,c\n1,2,3"), 0644))

	body, _ := json.Marshal(CSVPreviewRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/preview", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVPreview(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVPreviewResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Equal(t, 2, resp.Rows)
}

func TestHandleCSVImport(t *testing.T) {
	srv := newTestServer()
	tmpfile := filepath.Join(t.TempDir(), "import.csv")
	assert.NoError(t, os.WriteFile(tmpfile, []byte("x,y,z\n1,2,3"), 0644))

	body, _ := json.Marshal(generated.PathRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/import", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVImport(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVImportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Equal(t, 2, resp.Rows)
	assert.Equal(t, "x", srv.Ctrl.GetCellValue(0, 0))
	assert.Equal(t, "1", srv.Ctrl.GetCellValue(1, 0))
}

func TestHandleCSVImport_InvalidJSON(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/csv/import", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVImport(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVImportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.Success)
	assert.Equal(t, "INVALID_REQUEST", resp.Code)
}

func TestHandleCSVImport_EmptyPath(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(generated.PathRequest{Path: ""})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/import", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVImport(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVImportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.Success)
	assert.Equal(t, "INVALID_REQUEST", resp.Code)
}

func TestHandleCSVImport_FileNotFound(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(generated.PathRequest{Path: "/nonexistent/import.csv"})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/import", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVImport(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVImportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.Success)
	assert.Equal(t, "PARSE_ERROR", resp.Code)
}

func TestHandleCSVImport_InvalidCSV(t *testing.T) {
	srv := newTestServer()
	tmpfile := filepath.Join(t.TempDir(), "bad.csv")
	assert.NoError(t, os.WriteFile(tmpfile, []byte("a,\"b\nc"), 0644)) // Unclosed quote
	body, _ := json.Marshal(generated.PathRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/import", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVImport(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVImportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.Success)
	assert.Equal(t, "PARSE_ERROR", resp.Code)
}

func TestHandleCSVExport(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "a"))
	require.NoError(t, srv.Ctrl.SetCellValue(0, 1, "b"))
	tmpfile := filepath.Join(t.TempDir(), "export.csv")

	body, _ := json.Marshal(generated.PathRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/export", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVExport(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVExportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Equal(t, 1, resp.Rows)
	content, err := os.ReadFile(tmpfile)
	assert.NoError(t, err)
	assert.Contains(t, string(content), "a")
	assert.Contains(t, string(content), "b")
}

func TestHandleCSVExport_WithMergedCells(t *testing.T) {
	// Story 11.6: Covered positions empty; anchor gets value
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "header"))
	_ = srv.Ctrl.SetMerge(0, 0, 1, 2) // A1:B1 merged
	tmpfile := filepath.Join(t.TempDir(), "merged.csv")

	body, _ := json.Marshal(generated.PathRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/export", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVExport(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVExportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	content, err := os.ReadFile(tmpfile)
	assert.NoError(t, err)
	// A1=header, B1=covered (empty)
	assert.Contains(t, string(content), "header")
	// CSV should have header in col 0, empty in col 1
	lines := bytes.Split(content, []byte("\n"))
	assert.GreaterOrEqual(t, len(lines), 1)
	assert.Contains(t, string(lines[0]), "header")
}

func TestHandleCSVExport_WithErrorCell(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "=1/0")) // Produces #ERROR
	require.NoError(t, srv.Ctrl.SetCellValue(0, 1, "ok"))
	tmpfile := filepath.Join(t.TempDir(), "errors.csv")
	body, _ := json.Marshal(generated.PathRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/export", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVExport(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVExportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	content, _ := os.ReadFile(tmpfile)
	assert.Contains(t, string(content), "#ERROR")
	assert.Contains(t, string(content), "ok")
}

func TestHandleCSVExport_EmptySpreadsheet(t *testing.T) {
	srv := newTestServer()
	tmpfile := filepath.Join(t.TempDir(), "empty.csv")
	body, _ := json.Marshal(generated.PathRequest{Path: tmpfile})

	req := httptest.NewRequest(http.MethodPost, "/api/csv/export", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVExport(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVExportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Equal(t, 0, resp.Rows)
}

func TestHandleCSVExport_InvalidJSON(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/csv/export", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVExport(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVExportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.Success)
	assert.Equal(t, "INVALID_REQUEST", resp.Code)
}

func TestHandleCSVExport_EmptyPath(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "x"))
	body, _ := json.Marshal(generated.PathRequest{Path: ""})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/export", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVExport(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVExportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.Success)
	assert.Equal(t, "INVALID_REQUEST", resp.Code)
}

func TestHandleCSVExport_UnwritablePath(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "x"))
	body, _ := json.Marshal(generated.PathRequest{Path: "/nonexistent/parent/dir/export.csv"})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/export", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVExport(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVExportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.Success)
	assert.Equal(t, "FILE_WRITE_ERROR", resp.Code)
}

func TestHandleCSVExport_WriteToDirectoryFails(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "x"))
	// Writing to a directory path fails
	body, _ := json.Marshal(generated.PathRequest{Path: "/"})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/export", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleCSVExport(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVExportResponse
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.Success)
	assert.Equal(t, "FILE_WRITE_ERROR", resp.Code)
}

func TestHandleDownloadFile(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "download-me"))

	req := httptest.NewRequest(http.MethodGet, "/api/file/download", nil)
	w := httptest.NewRecorder()
	srv.HandleDownloadFile(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/octet-stream", w.Header().Get("Content-Type"))
	assert.Greater(t, w.Body.Len(), 0)
}

func TestHandleDownloadFile_EmptySpreadsheet(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/file/download", nil)
	w := httptest.NewRecorder()
	srv.HandleDownloadFile(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/octet-stream", w.Header().Get("Content-Type"))
}

func TestHandleUploadFile(t *testing.T) {
	orig := controller.NewAppController()
	require.NoError(t, orig.SetCellValue(0, 0, "uploaded"))
	tmpfile := filepath.Join(t.TempDir(), "upload.gosheet")
	assert.NoError(t, orig.SaveFile(tmpfile))
	data, _ := os.ReadFile(tmpfile)

	srv2 := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/file/upload", bytes.NewReader(data))
	w := httptest.NewRecorder()
	srv2.HandleUploadFile(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "uploaded", srv2.Ctrl.GetCellValue(0, 0))
}

func TestHandleUploadFile_InvalidData(t *testing.T) {
	srv := newTestServer()
	// Corrupt MessagePack data - LoadFile will fail
	req := httptest.NewRequest(http.MethodPost, "/api/file/upload", bytes.NewReader([]byte("not valid msgpack")))
	w := httptest.NewRecorder()
	srv.HandleUploadFile(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandleUploadFile_EmptyBody(t *testing.T) {
	srv := newTestServer()
	// Empty body - LoadFile on empty MessagePack will fail
	req := httptest.NewRequest(http.MethodPost, "/api/file/upload", bytes.NewReader(nil))
	w := httptest.NewRecorder()
	srv.HandleUploadFile(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// errReader makes io.ReadAll fail
type errReader struct{}

func (errReader) Read([]byte) (int, error) {
	return 0, errors.New("read failed")
}

func TestHandleUploadFile_ReadError(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/file/upload", errReader{})
	w := httptest.NewRecorder()
	srv.HandleUploadFile(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetFrontendDir(t *testing.T) {
	dir := GetFrontendDir()
	assert.NotEmpty(t, dir)
	// When run from project root, frontend/ typically exists
	assert.Contains(t, []string{"frontend", "../frontend", "Resources/frontend", "../Resources/frontend"}, dir)
}

func TestGetFrontendDir_FromTempDir(t *testing.T) {
	// Run from temp dir without frontend - should hit fallback
	orig, err := os.Getwd()
	assert.NoError(t, err)
	defer func() { _ = os.Chdir(orig) }()
	assert.NoError(t, os.Chdir(t.TempDir()))
	dir := GetFrontendDir()
	assert.NotEmpty(t, dir)
	assert.Contains(t, dir, "frontend", "fallback should return path containing 'frontend'")
}

func TestServeStatic(t *testing.T) {
	srv := newTestServer()
	// ServeStatic serves / as index.html
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	srv.ServeStatic(w, req)
	assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusNotFound, "expected 200 or 404, got %d", w.Code)

	// Non-root path serves file from frontend dir
	req2 := httptest.NewRequest(http.MethodGet, "/main.js", nil)
	w2 := httptest.NewRecorder()
	srv.ServeStatic(w2, req2)
	assert.True(t, w2.Code == http.StatusOK || w2.Code == http.StatusNotFound, "expected 200 or 404, got %d", w2.Code)
}

func TestHandleGetMerges(t *testing.T) {
	srv := newTestServer()
	// Empty merges
	req := httptest.NewRequest(http.MethodGet, "/api/merges", nil)
	w := httptest.NewRecorder()
	srv.HandleGetMerges(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Merges []map[string]any `json:"merges"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Empty(t, resp.Data.Merges)

	// Add merge via controller
	assert.NoError(t, srv.Ctrl.SetMerge(0, 0, 1, 3))
	req2 := httptest.NewRequest(http.MethodGet, "/api/merges", nil)
	w2 := httptest.NewRecorder()
	srv.HandleGetMerges(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)
	assert.NoError(t, json.NewDecoder(w2.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Len(t, resp.Data.Merges, 1)
	assert.Equal(t, float64(0), resp.Data.Merges[0]["startRow"])
	assert.Equal(t, float64(0), resp.Data.Merges[0]["startCol"])
	assert.Equal(t, float64(1), resp.Data.Merges[0]["rowSpan"])
	assert.Equal(t, float64(3), resp.Data.Merges[0]["colSpan"])
}

func TestHandleSetMerge(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(generated.SetMergeRequest{StartRow: 0, StartCol: 0, RowSpan: 1, ColSpan: 3})
	req := httptest.NewRequest(http.MethodPost, "/api/merge", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSetMerge(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			HasUnsavedChanges bool `json:"hasUnsavedChanges"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.True(t, resp.Data.HasUnsavedChanges)

	// Overlapping merge should fail
	body2, _ := json.Marshal(generated.SetMergeRequest{StartRow: 0, StartCol: 1, RowSpan: 1, ColSpan: 2})
	req2 := httptest.NewRequest(http.MethodPost, "/api/merge", bytes.NewReader(body2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	srv.HandleSetMerge(w2, req2)
	assert.Equal(t, http.StatusBadRequest, w2.Code)

	// Invalid bounds (rowSpan 0) should fail
	body3, _ := json.Marshal(generated.SetMergeRequest{StartRow: 5, StartCol: 5, RowSpan: 0, ColSpan: 1})
	req3 := httptest.NewRequest(http.MethodPost, "/api/merge", bytes.NewReader(body3))
	req3.Header.Set("Content-Type", "application/json")
	w3 := httptest.NewRecorder()
	srv.HandleSetMerge(w3, req3)
	assert.Equal(t, http.StatusBadRequest, w3.Code)
}

func TestHandleUnmerge(t *testing.T) {
	srv := newTestServer()
	assert.NoError(t, srv.Ctrl.SetMerge(0, 0, 1, 3))

	body, _ := json.Marshal(generated.UnmergeRequest{StartRow: 0, StartCol: 0})
	req := httptest.NewRequest(http.MethodPost, "/api/unmerge", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleUnmerge(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			HasUnsavedChanges bool `json:"hasUnsavedChanges"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.True(t, resp.Data.HasUnsavedChanges)
	assert.Empty(t, srv.Ctrl.GetMerges())

	// Unmerge non-anchor should fail
	assert.NoError(t, srv.Ctrl.SetMerge(0, 0, 2, 2))
	body2, _ := json.Marshal(generated.UnmergeRequest{StartRow: 1, StartCol: 1})
	req2 := httptest.NewRequest(http.MethodPost, "/api/unmerge", bytes.NewReader(body2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	srv.HandleUnmerge(w2, req2)
	assert.Equal(t, http.StatusBadRequest, w2.Code)
}

func TestHandleApplyCellStyle(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "Title"))

	body, _ := json.Marshal(ApplyCellStyleRequest{Row: 0, Col: 0, StyleId: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/cell/style", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleApplyCellStyle(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	cell := srv.Ctrl.Sheet.GetCell(0, 0)
	assert.NotNil(t, cell)
	assert.Equal(t, 1, cell.StyleId)

	// Invalid styleId
	body2, _ := json.Marshal(ApplyCellStyleRequest{Row: 0, Col: 0, StyleId: 99})
	req2 := httptest.NewRequest(http.MethodPost, "/api/cell/style", bytes.NewReader(body2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	srv.HandleApplyCellStyle(w2, req2)
	assert.Equal(t, http.StatusBadRequest, w2.Code)

	// Negative coords
	body3, _ := json.Marshal(ApplyCellStyleRequest{Row: -1, Col: 0, StyleId: 1})
	req3 := httptest.NewRequest(http.MethodPost, "/api/cell/style", bytes.NewReader(body3))
	req3.Header.Set("Content-Type", "application/json")
	w3 := httptest.NewRecorder()
	srv.HandleApplyCellStyle(w3, req3)
	assert.Equal(t, http.StatusBadRequest, w3.Code)
}

func TestHandleApplyRangeStyle(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "A"))
	require.NoError(t, srv.Ctrl.SetCellValue(0, 1, "B"))

	body, _ := json.Marshal(ApplyRangeStyleRequest{
		StartRow: 0, StartCol: 0, EndRow: 1, EndCol: 1, StyleId: 2,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/range/style", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleApplyRangeStyle(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	assert.Equal(t, 2, srv.Ctrl.Sheet.GetCell(0, 0).StyleId)
	assert.Equal(t, 2, srv.Ctrl.Sheet.GetCell(0, 1).StyleId)
	assert.Equal(t, 2, srv.Ctrl.Sheet.GetCell(1, 0).StyleId)
	assert.Equal(t, 2, srv.Ctrl.Sheet.GetCell(1, 1).StyleId)

	// Range too large
	body2, _ := json.Marshal(ApplyRangeStyleRequest{
		StartRow: 0, StartCol: 0, EndRow: 99, EndCol: 200, StyleId: 1,
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/range/style", bytes.NewReader(body2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	srv.HandleApplyRangeStyle(w2, req2)
	assert.Equal(t, http.StatusBadRequest, w2.Code)
}

func TestHandleGetAllCells_FormulaWithEmptyComputed(t *testing.T) {
	// Formula cells like =B1 compute to "" when B1 is empty; GetAllCells must still include them (for copy).
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "=B1"))
	require.NoError(t, srv.Ctrl.SetCellValue(1, 0, "=B2"))
	require.NoError(t, srv.Ctrl.SetCellValue(2, 0, "=B3"))

	req := httptest.NewRequest(http.MethodGet, "/api/cells/all", nil)
	w := httptest.NewRecorder()
	srv.HandleGetAllCells(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Success bool `json:"success"`
		Data    []struct {
			Row   int    `json:"row"`
			Col   int    `json:"col"`
			Value string `json:"value"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Len(t, resp.Data, 3)
	byRC := make(map[string]string)
	for _, c := range resp.Data {
		byRC[fmt.Sprintf("%d,%d", c.Row, c.Col)] = c.Value
	}
	assert.Equal(t, "=B1", byRC["0,0"])
	assert.Equal(t, "=B2", byRC["1,0"])
	assert.Equal(t, "=B3", byRC["2,0"])
}

func TestHandleGetAllCells_WithStyleId(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "Styled"))
	_ = srv.Ctrl.ApplyStyleToCell(0, 0, 1)

	req := httptest.NewRequest(http.MethodGet, "/api/cells/all", nil)
	w := httptest.NewRecorder()
	srv.HandleGetAllCells(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Success bool `json:"success"`
		Data    []struct {
			Row      int    `json:"row"`
			Col      int    `json:"col"`
			Value    string `json:"value"`
			Computed string `json:"computed"`
			StyleId  int    `json:"styleId"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Len(t, resp.Data, 1)
	assert.Equal(t, 1, resp.Data[0].StyleId)
}

func TestHandleFormatCleanup(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "Keep"))
	_ = srv.Ctrl.ApplyStyleToCell(0, 0, 1)
	_ = srv.Ctrl.ApplyStyleToCell(1, 0, 2) // empty + styled -> cleanup removes

	req := httptest.NewRequest(http.MethodPost, "/api/format/cleanup", nil)
	w := httptest.NewRecorder()
	srv.HandleFormatCleanup(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			HasUnsavedChanges bool `json:"hasUnsavedChanges"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.True(t, resp.Data.HasUnsavedChanges)

	// Styled empty cell should be gone
	assert.Nil(t, srv.Ctrl.Sheet.GetCell(1, 0))
	// Cell with value kept
	assert.NotNil(t, srv.Ctrl.Sheet.GetCell(0, 0))
	assert.Equal(t, 1, srv.Ctrl.Sheet.GetCell(0, 0).StyleId)
}

func TestHandleFormatCleanup_MethodNotAllowed(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/format/cleanup", nil)
	w := httptest.NewRecorder()
	srv.HandleFormatCleanup(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleInsertRow(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "A1"))
	require.NoError(t, srv.Ctrl.SetCellValue(1, 0, "A2"))
	body, _ := json.Marshal(InsertRowRequest{Row: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/row/insert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleInsertRow(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "A1", srv.Ctrl.GetCellValue(0, 0))
	assert.Equal(t, "", srv.Ctrl.GetCellValue(1, 0))
	assert.Equal(t, "A2", srv.Ctrl.GetCellValue(2, 0))
}

func TestHandleInsertColumn(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "A1"))
	require.NoError(t, srv.Ctrl.SetCellValue(0, 1, "B1"))
	body, _ := json.Marshal(InsertColumnRequest{Col: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/column/insert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleInsertColumn(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "A1", srv.Ctrl.GetCellValue(0, 0))
	assert.Equal(t, "", srv.Ctrl.GetCellValue(0, 1))
	assert.Equal(t, "B1", srv.Ctrl.GetCellValue(0, 2))
}

func TestHandleInsertRow_IncludesUndoState(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "A1"))
	body, _ := json.Marshal(InsertRowRequest{Row: 0})
	req := httptest.NewRequest(http.MethodPost, "/api/row/insert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleInsertRow(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	assert.Equal(t, "Insert Row 1", data["undoDescription"])
}

func TestHandleDeleteRow(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "A1"))
	require.NoError(t, srv.Ctrl.SetCellValue(1, 0, "A2"))
	require.NoError(t, srv.Ctrl.SetCellValue(2, 0, "A3"))
	body, _ := json.Marshal(DeleteRowRequest{Row: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/row/delete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleDeleteRow(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "A1", srv.Ctrl.GetCellValue(0, 0))
	assert.Equal(t, "A3", srv.Ctrl.GetCellValue(1, 0))
	assert.Equal(t, "", srv.Ctrl.GetCellValue(2, 0))
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	assert.Equal(t, "Delete Row 2", data["undoDescription"])
}

func TestHandleDeleteColumn(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "A1"))
	require.NoError(t, srv.Ctrl.SetCellValue(0, 1, "B1"))
	require.NoError(t, srv.Ctrl.SetCellValue(0, 2, "C1"))
	body, _ := json.Marshal(DeleteColumnRequest{Col: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/column/delete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleDeleteColumn(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "A1", srv.Ctrl.GetCellValue(0, 0))
	assert.Equal(t, "C1", srv.Ctrl.GetCellValue(0, 1))
	assert.Equal(t, "", srv.Ctrl.GetCellValue(0, 2))
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	assert.Equal(t, "Delete Column B", data["undoDescription"])
}

func TestHandleClearRange(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "a"))
	require.NoError(t, srv.Ctrl.SetCellValue(0, 1, "b"))
	require.NoError(t, srv.Ctrl.SetCellValue(1, 0, "c"))
	require.NoError(t, srv.Ctrl.SetCellValue(1, 1, "d"))
	body, _ := json.Marshal(ClearRangeRequest{
		StartRow: 0, StartCol: 0, EndRow: 1, EndCol: 1,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/range/clear", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleClearRange(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "", srv.Ctrl.GetCellValue(0, 0))
	assert.Equal(t, "", srv.Ctrl.GetCellValue(0, 1))
	assert.Equal(t, "", srv.Ctrl.GetCellValue(1, 0))
	assert.Equal(t, "", srv.Ctrl.GetCellValue(1, 1))
}

func TestHandleGetStyles(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/styles", nil)
	w := httptest.NewRecorder()
	srv.HandleStyles(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Styles []struct {
				ID     int      `json:"id"`
				Name   string   `json:"name"`
				Format struct{} `json:"format"`
			} `json:"styles"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Len(t, resp.Data.Styles, 3)
	assert.Equal(t, "Title", resp.Data.Styles[0].Name)
	assert.Equal(t, "Header", resp.Data.Styles[1].Name)
	assert.Equal(t, "Total", resp.Data.Styles[2].Name)
}

func TestHandleAddStyle(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(AddStyleRequest{
		Name: "Custom",
		Format: model.CellFormat{
			Font: model.Font{Name: "Arial", Size: 14, Bold: true},
		},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/styles", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleStyles(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID int `json:"id"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Equal(t, 4, resp.Data.ID)
}

func TestHandleUpdateStyle(t *testing.T) {
	srv := newTestServer()
	_ = srv.Ctrl.ApplyStyleToCell(0, 0, 1)
	body, _ := json.Marshal(UpdateStyleRequest{
		Format: model.CellFormat{
			Font: model.Font{Name: "Arial", Size: 24, Bold: true},
		},
	})
	req := httptest.NewRequest(http.MethodPut, "/api/styles/1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleStyleByID(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	format := srv.Ctrl.Sheet.Styles.GetFormat(1)
	assert.NotNil(t, format)
	assert.Equal(t, 24, format.Font.Size)
}

func TestHandleDeleteStyle(t *testing.T) {
	srv := newTestServer()
	_ = srv.Ctrl.ApplyStyleToCell(0, 0, 1)
	_ = srv.Ctrl.ApplyStyleToCell(0, 1, 1)
	req := httptest.NewRequest(http.MethodDelete, "/api/styles/1", nil)
	w := httptest.NewRecorder()
	srv.HandleStyleByID(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, 0, srv.Ctrl.Sheet.GetCell(0, 0).StyleId)
	assert.Equal(t, 0, srv.Ctrl.Sheet.GetCell(0, 1).StyleId)
	assert.Len(t, srv.Ctrl.Sheet.Styles.Formats, 2)
}

// --- Undo/Redo handler tests ---

func TestHandleUndo_EmptyStack(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/undo", nil)
	w := httptest.NewRecorder()
	srv.HandleUndo(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			CanUndo bool `json:"canUndo"`
			CanRedo bool `json:"canRedo"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.False(t, resp.Data.CanUndo)
	assert.False(t, resp.Data.CanRedo)
}

func TestHandleUndo_RevertsCellEdit(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "hello"))
	assert.Equal(t, "hello", srv.Ctrl.GetCellValue(0, 0))

	req := httptest.NewRequest(http.MethodPost, "/api/undo", nil)
	w := httptest.NewRecorder()
	srv.HandleUndo(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "", srv.Ctrl.GetCellValue(0, 0))

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			CanUndo  bool   `json:"canUndo"`
			CanRedo  bool   `json:"canRedo"`
			RedoDesc string `json:"redoDescription"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.False(t, resp.Data.CanUndo)
	assert.True(t, resp.Data.CanRedo)
	assert.Equal(t, "Set Cell A1", resp.Data.RedoDesc)
}

func TestHandleRedo_ReappliesCellEdit(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "hello"))
	_, err := srv.Ctrl.Undo()
	require.NoError(t, err)
	assert.Equal(t, "", srv.Ctrl.GetCellValue(0, 0))

	req := httptest.NewRequest(http.MethodPost, "/api/redo", nil)
	w := httptest.NewRecorder()
	srv.HandleRedo(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "hello", srv.Ctrl.GetCellValue(0, 0))

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			CanUndo bool `json:"canUndo"`
			CanRedo bool `json:"canRedo"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.True(t, resp.Data.CanUndo)
	assert.False(t, resp.Data.CanRedo)
}

func TestHandleUndo_MethodNotAllowed(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/undo", nil)
	w := httptest.NewRecorder()
	srv.HandleUndo(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleRedo_MethodNotAllowed(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/redo", nil)
	w := httptest.NewRecorder()
	srv.HandleRedo(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleSetCellValue_IncludesUndoState(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(map[string]any{"row": 0, "col": 0, "value": "test"})
	req := httptest.NewRequest(http.MethodPost, "/api/cell/set", bytes.NewReader(body))
	w := httptest.NewRecorder()
	srv.HandleSetCellValue(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			CanUndo bool `json:"canUndo"`
			CanRedo bool `json:"canRedo"`
		} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.True(t, resp.Data.CanUndo)
	assert.False(t, resp.Data.CanRedo)
}

// --- Formatting handler undo state tests (Story 15.4) ---

func TestHandleApplyCellStyle_IncludesUndoState(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "hello"))
	body, _ := json.Marshal(ApplyCellStyleRequest{Row: 0, Col: 0, StyleId: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/cell/style", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleApplyCellStyle(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	assert.Equal(t, "Apply Style to A1", data["undoDescription"])
}

func TestHandleApplyRangeStyle_IncludesUndoState(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "A"))
	require.NoError(t, srv.Ctrl.SetCellValue(0, 1, "B"))
	body, _ := json.Marshal(ApplyRangeStyleRequest{StartRow: 0, StartCol: 0, EndRow: 0, EndCol: 1, StyleId: 2})
	req := httptest.NewRequest(http.MethodPost, "/api/range/style", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleApplyRangeStyle(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	assert.Equal(t, "Apply Style to A1:B1", data["undoDescription"])
}

func TestHandleSetCellAlignment_IncludesUndoState(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "hello"))
	body, _ := json.Marshal(SetCellAlignmentRequest{Row: 0, Col: 0, Alignment: "center"})
	req := httptest.NewRequest(http.MethodPost, "/api/cell/alignment", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSetCellAlignment(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	assert.Equal(t, "Align A1", data["undoDescription"])
}

func TestHandleSetCellAlignment_GetAllCellsReturnsStyleId(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "hello"))
	body, _ := json.Marshal(SetCellAlignmentRequest{Row: 0, Col: 0, Alignment: "center"})
	req := httptest.NewRequest(http.MethodPost, "/api/cell/alignment", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSetCellAlignment(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	req2 := httptest.NewRequest(http.MethodGet, "/api/cells/all", nil)
	w2 := httptest.NewRecorder()
	srv.HandleGetAllCells(w2, req2)
	require.Equal(t, http.StatusOK, w2.Code)
	var cellsResp struct {
		Success bool `json:"success"`
		Data    []struct {
			Row     int `json:"row"`
			Col     int `json:"col"`
			StyleId int `json:"styleId"`
		} `json:"data"`
	}
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&cellsResp))
	require.True(t, cellsResp.Success)
	require.Len(t, cellsResp.Data, 1)
	assert.Greater(t, cellsResp.Data[0].StyleId, 0, "cell should have styleId after alignment")

	// Verify alignment is included in response (derived from style format)
	req3 := httptest.NewRequest(http.MethodGet, "/api/cells/all", nil)
	w3 := httptest.NewRecorder()
	srv.HandleGetAllCells(w3, req3)
	var cellsResp2 struct {
		Data []struct {
			Alignment string `json:"alignment"`
		} `json:"data"`
	}
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&cellsResp2))
	require.Len(t, cellsResp2.Data, 1)
	assert.Equal(t, "center", cellsResp2.Data[0].Alignment)
}

func TestHandleSetMerge_IncludesUndoState(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "anchor"))
	body, _ := json.Marshal(map[string]any{"startRow": 0, "startCol": 0, "rowSpan": 1, "colSpan": 2})
	req := httptest.NewRequest(http.MethodPost, "/api/merge", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSetMerge(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	assert.Equal(t, "Merge A1:B1", data["undoDescription"])
}

func TestHandleUnmerge_IncludesUndoState(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "anchor"))
	require.NoError(t, srv.Ctrl.SetMerge(0, 0, 2, 2))
	srv.Ctrl.History.Clear()
	body, _ := json.Marshal(map[string]any{"startRow": 0, "startCol": 0})
	req := httptest.NewRequest(http.MethodPost, "/api/unmerge", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleUnmerge(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	assert.Equal(t, "Unmerge A1", data["undoDescription"])
}

// --- HandleClearRange extra branches ---

func TestHandleClearRange_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/range/clear", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleClearRange(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// --- HandleInsertRow / HandleInsertColumn / HandleDeleteRow / HandleDeleteColumn error branches ---

func TestHandleInsertRow_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/row/insert", nil)
	w := httptest.NewRecorder()
	srv.HandleInsertRow(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleInsertRow_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/row/insert", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleInsertRow(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleInsertColumn_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/column/insert", nil)
	w := httptest.NewRecorder()
	srv.HandleInsertColumn(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleInsertColumn_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/column/insert", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleInsertColumn(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleDeleteRow_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/row/delete", nil)
	w := httptest.NewRecorder()
	srv.HandleDeleteRow(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleDeleteRow_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/row/delete", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleDeleteRow(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleDeleteColumn_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/column/delete", nil)
	w := httptest.NewRecorder()
	srv.HandleDeleteColumn(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleDeleteColumn_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/column/delete", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleDeleteColumn(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// --- HandleSetCellAlignment error branches ---

func TestHandleSetCellAlignment_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/cell/alignment", nil)
	w := httptest.NewRecorder()
	srv.HandleSetCellAlignment(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleSetCellAlignment_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/cell/alignment", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleSetCellAlignment(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleSetCellAlignment_InvalidAlignment(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(map[string]any{"row": 0, "col": 0, "alignment": "diagonal"})
	req := httptest.NewRequest(http.MethodPost, "/api/cell/alignment", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSetCellAlignment(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// --- HandleSetMerge / HandleUnmerge / HandleApplyCellStyle / HandleApplyRangeStyle error branches ---

func TestHandleSetMerge_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/merge", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleSetMerge(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleUnmerge_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/unmerge", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleUnmerge(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleApplyCellStyle_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/cell/style", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleApplyCellStyle(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleApplyRangeStyle_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/range/style", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleApplyRangeStyle(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// --- HandleSetRangeValues ---

func TestHandleSetRangeValues_Basic(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(map[string]any{
		"cells": []map[string]any{
			{"row": 0, "col": 0, "value": "hello"},
			{"row": 0, "col": 1, "value": "world"},
		},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/range/values", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSetRangeValues(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, true, resp["success"])
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	assert.Equal(t, "Paste 2 cell(s)", data["undoDescription"])
	assert.Equal(t, "hello", srv.Ctrl.GetCellValue(0, 0))
	assert.Equal(t, "world", srv.Ctrl.GetCellValue(0, 1))
}

func TestHandleSetRangeValues_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/range/values", bytes.NewReader([]byte("not json")))
	w := httptest.NewRecorder()
	srv.HandleSetRangeValues(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// --- HandleShiftFormula ---

func TestHandleShiftFormula_Basic(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(map[string]any{
		"formula":    "=A1+B2",
		"row_offset": 1,
		"col_offset": 2,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/formula/shift", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleShiftFormula(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, true, resp["success"])
	data := resp["data"].(map[string]any)
	assert.Equal(t, "=C2+D3", data["shifted"])
}

func TestHandleShiftFormula_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/formula/shift", nil)
	w := httptest.NewRecorder()
	srv.HandleShiftFormula(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleShiftFormula_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/formula/shift", bytes.NewReader([]byte("not json")))
	w := httptest.NewRecorder()
	srv.HandleShiftFormula(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// --- HandleClearRangeFormat ---

func TestHandleClearRangeFormat_Basic(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "styled"))
	require.NoError(t, srv.Ctrl.ApplyStyleToCell(0, 0, 1))
	srv.Ctrl.History.Clear()

	body, _ := json.Marshal(map[string]any{"startRow": 0, "startCol": 0, "endRow": 0, "endCol": 0})
	req := httptest.NewRequest(http.MethodPost, "/api/range/clear-format", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleClearRangeFormat(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, true, resp["success"])
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	assert.Equal(t, "Clear Formatting A1", data["undoDescription"])
	assert.Equal(t, 0, srv.Ctrl.Sheet.GetCell(0, 0).StyleId)
}

func TestHandleClearRangeFormat_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/range/clear-format", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleClearRangeFormat(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// --- HandleSetRangeAlignment ---

func TestHandleSetRangeAlignment_Basic(t *testing.T) {
	srv := newTestServer()
	require.NoError(t, srv.Ctrl.SetCellValue(0, 0, "x"))
	require.NoError(t, srv.Ctrl.SetCellValue(1, 0, "y"))
	srv.Ctrl.History.Clear()

	body, _ := json.Marshal(map[string]any{
		"startRow": 0, "startCol": 0, "endRow": 1, "endCol": 0, "alignment": "center",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/range/alignment", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSetRangeAlignment(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, true, resp["success"])
	data := resp["data"].(map[string]any)
	assert.Equal(t, true, data["canUndo"])
	// Alignment is now in style
	for _, row := range []int{0, 1} {
		cell := srv.Ctrl.Sheet.GetCell(row, 0)
		require.NotNil(t, cell)
		format := srv.Ctrl.Sheet.Styles.GetFormat(cell.StyleId)
		require.NotNil(t, format)
		assert.Equal(t, "center", format.Alignment.Horizontal)
	}
}

func TestHandleSetRangeAlignment_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/range/alignment", nil)
	w := httptest.NewRecorder()
	srv.HandleSetRangeAlignment(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleSetRangeAlignment_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/range/alignment", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleSetRangeAlignment(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleSetRangeAlignment_InvalidAlignment(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(map[string]any{
		"startRow": 0, "startCol": 0, "endRow": 0, "endCol": 0, "alignment": "diagonal",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/range/alignment", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleSetRangeAlignment(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// --- HandleStyles / HandleStyleByID low-coverage branches ---

func TestHandleStyles_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodDelete, "/api/styles", nil)
	w := httptest.NewRecorder()
	srv.HandleStyles(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleStyles_WrongPath(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/styles/extra/path", nil)
	w := httptest.NewRecorder()
	srv.HandleStyles(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleStyleByID_WrongMethod(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodGet, "/api/styles/1", nil)
	w := httptest.NewRecorder()
	srv.HandleStyleByID(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleStyleByID_InvalidID(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodDelete, "/api/styles/abc", nil)
	w := httptest.NewRecorder()
	srv.HandleStyleByID(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleStyleByID_NoID(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodDelete, "/api/styles/", nil)
	w := httptest.NewRecorder()
	srv.HandleStyleByID(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHandleDeleteStyle_BadID(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodDelete, "/api/styles/99", nil)
	w := httptest.NewRecorder()
	srv.HandleStyleByID(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleUpdateStyle_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPut, "/api/styles/1", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleStyleByID(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleUpdateStyle_DuplicateName(t *testing.T) {
	srv := newTestServer()
	// Built-in styles: 1=Title, 2=Header, 3=Accent. Try renaming style 1 to "Header" (already style 2).
	body, _ := json.Marshal(map[string]any{"name": "Header", "format": map[string]any{}})
	req := httptest.NewRequest(http.MethodPut, "/api/styles/1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleStyleByID(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleAddStyle_BadBody(t *testing.T) {
	srv := newTestServer()
	req := httptest.NewRequest(http.MethodPost, "/api/styles", bytes.NewReader([]byte("bad")))
	w := httptest.NewRecorder()
	srv.HandleStyles(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleAddStyle_DuplicateName(t *testing.T) {
	srv := newTestServer()
	body, _ := json.Marshal(map[string]any{"name": "Title", "format": map[string]any{}})
	req := httptest.NewRequest(http.MethodPost, "/api/styles", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.HandleStyles(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
} //nolint:revive // file length exceeds 800-line limit; test files are exempt by convention (max 1500)
