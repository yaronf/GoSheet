package api

// Response represents a standardized API response for all spreadsheet operations.
// It provides consistent success/failure indication, optional data payloads,
// and structured error information with error codes for testing.
//
// Usage patterns:
//
//	Success with data: Response{Success: true, Data: cellValue}
//	Success without data: Response{Success: true}
//	Error with code: Response{Success: false, Error: "message", Code: CIRCULAR_REF}
type Response struct {
	// Success indicates whether the operation completed successfully.
	// true = operation succeeded, false = operation failed
	Success bool `json:"success"`

	// Data contains the optional response payload.
	// The type depends on the API method:
	//   - GetCellValue: map with "value" and "computed" fields
	//   - GetAllCells: array of cell objects
	//   - GetFileStatus: map with "path", "saved", "modified" fields
	Data interface{} `json:"data,omitempty"`

	// Error contains a human-readable error message when Success is false.
	// Should be clear and actionable for users (NFR-U4).
	Error string `json:"error,omitempty"`

	// Code contains a machine-readable error code for testing and UI logic.
	// Use the error code constants defined below.
	Code string `json:"code,omitempty"`
}

// Error codes for structured error handling
const (
	// CIRCULAR_REF indicates a circular reference was detected in a formula.
	// Example: A1 = B1, B1 = A1
	// Used by: SetCellValue when formula creates a cycle
	CIRCULAR_REF = "CIRCULAR_REF"

	// INVALID_FORMULA indicates a formula could not be parsed.
	// Example: "=SUM(A1:A10" (missing closing parenthesis)
	// Used by: SetCellValue when formula syntax is invalid
	INVALID_FORMULA = "INVALID_FORMULA"

	// EMPTY_CELL_REF indicates a formula references an empty cell.
	// Example: "=A1+B1" where B1 is empty
	// Used by: Formula evaluation (may be warning, not always error)
	EMPTY_CELL_REF = "EMPTY_CELL_REF"

	// FILE_NOT_FOUND indicates the requested file does not exist.
	// Used by: LoadFile, OpenFileDialog
	FILE_NOT_FOUND = "FILE_NOT_FOUND"

	// FILE_READ_ERROR indicates a file could not be read.
	// Causes: Permission denied, corrupt file, I/O error
	// Used by: LoadFile, ImportCSV
	FILE_READ_ERROR = "FILE_READ_ERROR"

	// FILE_WRITE_ERROR indicates a file could not be written.
	// Causes: Permission denied, disk full, I/O error
	// Used by: SaveFile, ExportCSV
	FILE_WRITE_ERROR = "FILE_WRITE_ERROR"

	// INVALID_CELL_REF indicates an invalid cell reference format.
	// Example: "AA1" (column out of range), "A0" (row 0 doesn't exist)
	// Used by: GetCellValue, SetCellValue, DeleteCell
	INVALID_CELL_REF = "INVALID_CELL_REF"

	// PARSE_ERROR indicates a general parsing error.
	// Used by: CSV import, file deserialization
	PARSE_ERROR = "PARSE_ERROR"
)

// NewSuccessResponse creates a success response with optional data.
func NewSuccessResponse(data interface{}) Response {
	return Response{
		Success: true,
		Data:    data,
	}
}

// NewErrorResponse creates an error response with message and code.
func NewErrorResponse(message, code string) Response {
	return Response{
		Success: false,
		Error:   message,
		Code:    code,
	}
}
