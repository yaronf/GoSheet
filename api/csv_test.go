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
)

func TestCSVPreviewRequest(t *testing.T) {
	req := CSVPreviewRequest{Path: "/tmp/test.csv"}
	data, err := json.Marshal(req)
	assert.NoError(t, err)

	var decoded CSVPreviewRequest
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.Equal(t, "/tmp/test.csv", decoded.Path)
}

func TestCSVPreviewResponse(t *testing.T) {
	resp := CSVPreviewResponse{
		Success: true,
		Rows:    5,
		Cols:    3,
		Preview: [][]string{{"a", "b", "c"}, {"1", "2", "3"}},
	}
	data, err := json.Marshal(resp)
	assert.NoError(t, err)

	var decoded CSVPreviewResponse
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)
	assert.True(t, decoded.Success)
	assert.Equal(t, 5, decoded.Rows)
	assert.Equal(t, 3, decoded.Cols)
	assert.Len(t, decoded.Preview, 2)
}

func TestParseCSVFile(t *testing.T) {
	tmpfile := filepath.Join(t.TempDir(), "test.csv")
	err := os.WriteFile(tmpfile, []byte("a,b,c\n1,2,3\nx,y,z"), 0644)
	assert.NoError(t, err)

	records, err := ParseCSVFile(tmpfile)
	assert.NoError(t, err)
	assert.Len(t, records, 3)
	assert.Equal(t, []string{"a", "b", "c"}, records[0])
	assert.Equal(t, []string{"1", "2", "3"}, records[1])
	assert.Equal(t, []string{"x", "y", "z"}, records[2])
}

func TestParseCSVFile_Empty(t *testing.T) {
	tmpfile := filepath.Join(t.TempDir(), "empty.csv")
	err := os.WriteFile(tmpfile, []byte(""), 0644)
	assert.NoError(t, err)

	_, err = ParseCSVFile(tmpfile)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "empty")
}

func TestParseCSVFile_NotFound(t *testing.T) {
	_, err := ParseCSVFile("/nonexistent/file.csv")
	assert.Error(t, err)
}

func TestGenerateCSV(t *testing.T) {
	records := [][]string{{"a", "b", "c"}, {"1", "2", "3"}}
	out, err := GenerateCSV(records)
	assert.NoError(t, err)
	assert.Contains(t, out, "a,b,c")
	assert.Contains(t, out, "1,2,3")
}

func TestGenerateCSV_Empty(t *testing.T) {
	out, err := GenerateCSV([][]string{})
	assert.NoError(t, err)
	assert.Empty(t, out)
}

func TestHandleCSVPreview_Success(t *testing.T) {
	tmpfile := filepath.Join(t.TempDir(), "preview.csv")
	err := os.WriteFile(tmpfile, []byte("col1,col2\nval1,val2"), 0644)
	assert.NoError(t, err)

	body, _ := json.Marshal(CSVPreviewRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/preview", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	HandleCSVPreview(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVPreviewResponse
	err = json.NewDecoder(w.Body).Decode(&resp)
	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Equal(t, 2, resp.Rows)
	assert.Equal(t, 2, resp.Cols)
	assert.Len(t, resp.Preview, 2)
}

func TestHandleCSVPreview_EmptyPath(t *testing.T) {
	body, _ := json.Marshal(CSVPreviewRequest{Path: ""})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/preview", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	HandleCSVPreview(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVPreviewResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	assert.False(t, resp.Success)
	assert.Equal(t, "INVALID_REQUEST", resp.Code)
}

func TestHandleCSVPreview_FileNotFound(t *testing.T) {
	body, _ := json.Marshal(CSVPreviewRequest{Path: "/nonexistent/file.csv"})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/preview", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	HandleCSVPreview(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVPreviewResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	assert.False(t, resp.Success)
	assert.Equal(t, "FILE_READ_ERROR", resp.Code)
}

func TestHandleCSVPreview_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/csv/preview", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	HandleCSVPreview(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVPreviewResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	assert.False(t, resp.Success)
	assert.Equal(t, "INVALID_REQUEST", resp.Code)
}

func TestHandleCSVPreview_EmptyFile(t *testing.T) {
	tmpfile := filepath.Join(t.TempDir(), "empty.csv")
	err := os.WriteFile(tmpfile, []byte(""), 0644)
	assert.NoError(t, err)

	body, _ := json.Marshal(CSVPreviewRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/preview", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	HandleCSVPreview(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVPreviewResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	assert.False(t, resp.Success)
	assert.Equal(t, "EMPTY_FILE", resp.Code)
}

func TestHandleCSVPreview_InvalidCSV(t *testing.T) {
	tmpfile := filepath.Join(t.TempDir(), "bad.csv")
	// Malformed CSV: unclosed quote
	err := os.WriteFile(tmpfile, []byte("a,\"b\nc"), 0644)
	assert.NoError(t, err)

	body, _ := json.Marshal(CSVPreviewRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/preview", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	HandleCSVPreview(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVPreviewResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	assert.False(t, resp.Success)
	assert.Equal(t, "PARSE_ERROR", resp.Code)
}

func TestHandleCSVPreview_MoreThan10Rows(t *testing.T) {
	tmpfile := filepath.Join(t.TempDir(), "large.csv")
	var content []byte
	for i := 0; i < 15; i++ {
		content = append(content, []byte("a,b,c\n")...)
	}
	err := os.WriteFile(tmpfile, content, 0644)
	assert.NoError(t, err)

	body, _ := json.Marshal(CSVPreviewRequest{Path: tmpfile})
	req := httptest.NewRequest(http.MethodPost, "/api/csv/preview", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	HandleCSVPreview(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp CSVPreviewResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)
	assert.True(t, resp.Success)
	assert.Equal(t, 15, resp.Rows)
	assert.Len(t, resp.Preview, 10) // Preview capped at 10 rows
}
