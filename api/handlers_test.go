package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"gosheet/api/generated"
	"gosheet/controller"
)

func newTestServer() *Server {
	return NewServer(controller.NewAppController())
}

func TestNewServer(t *testing.T) {
	ctrl := controller.NewAppController()
	srv := NewServer(ctrl)
	assert.NotNil(t, srv)
	assert.Equal(t, ctrl, srv.Ctrl)
}

func TestHandleGetCellValue(t *testing.T) {
	srv := newTestServer()
	srv.Ctrl.SetCellValue(0, 0, "42")

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
	srv.Ctrl.SetCellValue(0, 0, "=1+1")

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
	srv.Ctrl.SetCellValue(0, 0, "A1")
	srv.Ctrl.SetCellValue(1, 1, "B2")

	req := httptest.NewRequest(http.MethodGet, "/api/cells/all", nil)
	w := httptest.NewRecorder()
	srv.HandleGetAllCells(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool                     `json:"success"`
		Data    []map[string]interface{} `json:"data"`
	}
	assert.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Success)
	assert.Len(t, resp.Data, 2)
}

func TestHandleNewFile(t *testing.T) {
	srv := newTestServer()
	srv.Ctrl.SetCellValue(0, 0, "data")

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

func TestHandleSaveFile(t *testing.T) {
	srv := newTestServer()
	srv.Ctrl.SetCellValue(0, 0, "test")
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

func TestHandleLoadFile(t *testing.T) {
	srv := newTestServer()
	srv.Ctrl.SetCellValue(0, 0, "loaded")
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

func TestHandleCSVExport(t *testing.T) {
	srv := newTestServer()
	srv.Ctrl.SetCellValue(0, 0, "a")
	srv.Ctrl.SetCellValue(0, 1, "b")
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

func TestHandleDownloadFile(t *testing.T) {
	srv := newTestServer()
	srv.Ctrl.SetCellValue(0, 0, "download-me")

	req := httptest.NewRequest(http.MethodGet, "/api/file/download", nil)
	w := httptest.NewRecorder()
	srv.HandleDownloadFile(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/octet-stream", w.Header().Get("Content-Type"))
	assert.Greater(t, w.Body.Len(), 0)
}

func TestHandleUploadFile(t *testing.T) {
	orig := controller.NewAppController()
	orig.SetCellValue(0, 0, "uploaded")
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

func TestGetFrontendDir(t *testing.T) {
	dir := GetFrontendDir()
	assert.NotEmpty(t, dir)
	// When run from project root, frontend/ typically exists
	assert.Contains(t, []string{"frontend", "../frontend", "Resources/frontend", "../Resources/frontend"}, dir)
}
