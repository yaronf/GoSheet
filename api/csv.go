package api

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
)

// CSVPreviewRequest represents a request to preview a CSV file
type CSVPreviewRequest struct {
	Path string `json:"path"`
}

// CSVPreviewResponse represents the preview data for a CSV file
type CSVPreviewResponse struct {
	Success bool       `json:"success"`
	Rows    int        `json:"rows"`
	Cols    int        `json:"cols"`
	Preview [][]string `json:"preview"`
	Error   string     `json:"error,omitempty"`
	Code    string     `json:"code,omitempty"`
}

// HandleCSVPreview handles POST /api/csv/preview
// Reads a CSV file from the given path and returns preview data (first 10 rows)
func HandleCSVPreview(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Parse request
	var req CSVPreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		_ = json.NewEncoder(w).Encode(CSVPreviewResponse{
			Success: false,
			Error:   "Invalid request format",
			Code:    "INVALID_REQUEST",
		})
		return
	}

	if req.Path == "" {
		_ = json.NewEncoder(w).Encode(CSVPreviewResponse{
			Success: false,
			Error:   "File path is required",
			Code:    "INVALID_REQUEST",
		})
		return
	}

	// Open and parse file
	f, err := os.Open(req.Path)
	if err != nil {
		_ = json.NewEncoder(w).Encode(CSVPreviewResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to read file: %v", err),
			Code:    "FILE_READ_ERROR",
		})
		return
	}
	defer func() { _ = f.Close() }()

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1 // Allow variable number of fields

	records, err := reader.ReadAll()
	if err != nil {
		_ = json.NewEncoder(w).Encode(CSVPreviewResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to parse CSV: %v", err),
			Code:    "PARSE_ERROR",
		})
		return
	}

	if len(records) == 0 {
		_ = json.NewEncoder(w).Encode(CSVPreviewResponse{
			Success: false,
			Error:   "CSV file contains no data",
			Code:    "EMPTY_FILE",
		})
		return
	}

	// Determine column count (max columns in any row)
	maxCols := 0
	for _, row := range records {
		if len(row) > maxCols {
			maxCols = len(row)
		}
	}

	// Get preview (first 10 rows)
	previewRows := records
	if len(records) > 10 {
		previewRows = records[:10]
	}

	// Return preview
	_ = json.NewEncoder(w).Encode(CSVPreviewResponse{
		Success: true,
		Rows:    len(records),
		Cols:    maxCols,
		Preview: previewRows,
	})
}

// CSVImportRequest represents a request to import a CSV file
type CSVImportRequest struct {
	Path string `json:"path"`
}

// CSVImportResponse represents the response after importing a CSV file
type CSVImportResponse struct {
	Success bool   `json:"success"`
	Rows    int    `json:"rows"`
	Cols    int    `json:"cols"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
	Code    string `json:"code,omitempty"`
}

// ParseCSVFile reads and parses a CSV file, returning the records
func ParseCSVFile(path string) ([][]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %v", err)
	}
	defer func() { _ = f.Close() }()

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1 // Allow variable number of fields

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse CSV: %v", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("CSV file contains no data")
	}

	return records, nil
}

// CSVExportRequest represents a request to export spreadsheet to CSV
type CSVExportRequest struct {
	Path string `json:"path"`
}

// CSVExportResponse represents the response after exporting to CSV
type CSVExportResponse struct {
	Success bool   `json:"success"`
	Rows    int    `json:"rows"`
	Cols    int    `json:"cols"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
	Code    string `json:"code,omitempty"`
}

// GenerateCSV generates RFC 4180-compliant CSV from a 2D string array
func GenerateCSV(records [][]string) (string, error) {
	var buf strings.Builder
	writer := csv.NewWriter(&buf)

	for _, record := range records {
		if err := writer.Write(record); err != nil {
			return "", fmt.Errorf("failed to write CSV record: %v", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", fmt.Errorf("failed to flush CSV writer: %v", err)
	}

	return buf.String(), nil
}
