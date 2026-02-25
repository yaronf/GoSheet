package api

import (
	"bytes"
	"encoding/json"
	"errors"
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

func TestHandleFileStatus_WithLoadedFile(t *testing.T) {
	srv := newTestServer()
	srv.Ctrl.SetCellValue(0, 0, "x")
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
	srv.Ctrl.SetCellValue(0, 0, "x")
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

func TestHandleCSVExport_WithErrorCell(t *testing.T) {
	srv := newTestServer()
	srv.Ctrl.SetCellValue(0, 0, "=1/0") // Produces #ERROR
	srv.Ctrl.SetCellValue(0, 1, "ok")
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
	srv.Ctrl.SetCellValue(0, 0, "x")
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
	srv.Ctrl.SetCellValue(0, 0, "x")
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
	srv.Ctrl.SetCellValue(0, 0, "x")
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
	srv.Ctrl.SetCellValue(0, 0, "download-me")

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

func TestHandleUploadFile_InvalidData(t *testing.T) {
	srv := newTestServer()
	// Corrupt gob data - LoadFile will fail
	req := httptest.NewRequest(http.MethodPost, "/api/file/upload", bytes.NewReader([]byte("not valid gob")))
	w := httptest.NewRecorder()
	srv.HandleUploadFile(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandleUploadFile_EmptyBody(t *testing.T) {
	srv := newTestServer()
	// Empty body - LoadFile on empty gob will fail
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
	defer os.Chdir(orig)
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
			Merges []map[string]interface{} `json:"merges"`
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
