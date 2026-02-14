package api

// SpreadsheetAPI defines the unified interface for all spreadsheet operations.
// Both native mode (Wails IPC) and web mode (HTTP) implement this interface,
// ensuring consistent behavior and testability across deployment modes.
//
// All methods return Response struct with:
//   - Success: true/false indicating operation result
//   - Data: optional payload (structure documented per method)
//   - Error: human-readable error message on failure
//   - Code: machine-readable error code for testing
//
// Implementation notes:
//   - Native mode: cmd/native/api_wails.go (Story 3.4)
//   - Web mode: cmd/web/api_http.go (Story 2.2)
type SpreadsheetAPI interface {
	// SetCellValue sets a cell's value or formula.
	//
	// Parameters:
	//   - row: 0-based row index
	//   - col: 0-based column index
	//   - value: cell value or formula (formulas start with "=")
	//
	// Response.Data: nil (no data returned)
	//
	// Possible error codes:
	//   - INVALID_CELL_REF: row/col out of bounds
	//   - CIRCULAR_REF: formula creates circular reference
	//   - INVALID_FORMULA: formula syntax error
	//
	// Example:
	//
	//	response := api.SetCellValue(0, 0, "=SUM(B1:B10)")
	//	if !response.Success {
	//	  log.Printf("Error: %s (code: %s)", response.Error, response.Code)
	//	}
	SetCellValue(row, col int, value string) Response

	// GetCellValue retrieves a cell's value and computed result.
	//
	// Parameters:
	//   - row: 0-based row index
	//   - col: 0-based column index
	//
	// Response.Data structure:
	//
	//	{
	//	  "value": string,    // Raw cell value or formula
	//	  "computed": string  // Evaluated result (for formulas)
	//	}
	//
	// Possible error codes:
	//   - INVALID_CELL_REF: row/col out of bounds
	//
	// Example:
	//
	//	response := api.GetCellValue(0, 0)
	//	if response.Success {
	//	  data := response.Data.(map[string]interface{})
	//	  fmt.Printf("Value: %s, Computed: %s\n", data["value"], data["computed"])
	//	}
	GetCellValue(row, col int) Response

	// GetCellFormula retrieves a cell's formula (if any).
	//
	// Parameters:
	//   - row: 0-based row index
	//   - col: 0-based column index
	//
	// Response.Data structure:
	//
	//	{
	//	  "formula": string  // Formula string (empty if not a formula)
	//	}
	//
	// Possible error codes:
	//   - INVALID_CELL_REF: row/col out of bounds
	//
	// Note: Returns empty string for non-formula cells (not an error)
	GetCellFormula(row, col int) Response

	// DeleteCell removes a cell's contents.
	//
	// Parameters:
	//   - row: 0-based row index
	//   - col: 0-based column index
	//
	// Response.Data: nil (no data returned)
	//
	// Possible error codes:
	//   - INVALID_CELL_REF: row/col out of bounds
	//
	// Note: Deleting an empty cell is not an error (idempotent operation)
	DeleteCell(row, col int) Response

	// NewSpreadsheet creates a new empty spreadsheet.
	// Clears all cells and resets file status to "Untitled - Unsaved".
	//
	// Response.Data: nil (no data returned)
	//
	// Possible error codes: none (operation always succeeds)
	//
	// Note: If there are unsaved changes, caller should prompt user first
	// (handled by UI layer, not this API method)
	NewSpreadsheet() Response

	// LoadFile loads a .sheet file from disk.
	//
	// Parameters:
	//   - path: absolute file path to .sheet file
	//
	// Response.Data structure:
	//
	//	{
	//	  "cellCount": int  // Number of cells loaded
	//	}
	//
	// Possible error codes:
	//   - FILE_NOT_FOUND: file doesn't exist
	//   - FILE_READ_ERROR: cannot read file (permissions, I/O error)
	//   - PARSE_ERROR: file format invalid or corrupt
	//
	// Note: Rebuilds dependency graph after loading
	LoadFile(path string) Response

	// SaveFile saves the spreadsheet to disk.
	//
	// Parameters:
	//   - path: absolute file path to save to
	//
	// Response.Data: nil (no data returned)
	//
	// Possible error codes:
	//   - FILE_WRITE_ERROR: cannot write file (permissions, disk full, I/O error)
	//
	// Note: Updates file status to "Saved: <path>" on success
	SaveFile(path string) Response

	// GetFileStatus retrieves the current file status.
	//
	// Response.Data structure:
	//
	//	{
	//	  "path": string,      // File path (empty if unsaved)
	//	  "saved": bool,       // true if saved, false if modified
	//	  "modified": bool,    // true if unsaved changes exist
	//	  "filename": string  // Filename only (e.g., "Budget.sheet")
	//	}
	//
	// Possible error codes: none (operation always succeeds)
	//
	// Example:
	//
	//	response := api.GetFileStatus()
	//	data := response.Data.(map[string]interface{})
	//	if data["modified"].(bool) {
	//	  fmt.Println("You have unsaved changes!")
	//	}
	GetFileStatus() Response

	// GetAllCells retrieves all non-empty cells for rendering.
	//
	// Response.Data structure: array of cell objects
	//
	//	[
	//	  {
	//	    "row": int,
	//	    "col": int,
	//	    "value": string,    // Raw value or formula
	//	    "computed": string  // Evaluated result
	//	  },
	//	  ...
	//	]
	//
	// Possible error codes: none (operation always succeeds)
	//
	// Note: Used by frontend to render the entire grid
	GetAllCells() Response

	// ImportCSV imports data from a CSV file.
	// Implementation in Epic 5 (Story 5.2).
	//
	// Parameters:
	//   - path: absolute file path to CSV file
	//
	// Response.Data structure:
	//
	//	{
	//	  "rowCount": int,    // Number of rows imported
	//	  "colCount": int     // Number of columns imported
	//	}
	//
	// Possible error codes:
	//   - FILE_NOT_FOUND: file doesn't exist
	//   - FILE_READ_ERROR: cannot read file
	//   - PARSE_ERROR: CSV format invalid
	//
	// Note: Clears existing spreadsheet before importing (data-only, no formulas)
	ImportCSV(path string) Response

	// ExportCSV exports the spreadsheet to CSV format.
	// Implementation in Epic 5 (Story 5.3).
	//
	// Parameters:
	//   - path: absolute file path to save CSV to
	//
	// Response.Data: nil (no data returned)
	//
	// Possible error codes:
	//   - FILE_WRITE_ERROR: cannot write file
	//
	// Note: Exports computed values (formulas are evaluated, not exported)
	ExportCSV(path string) Response
}
