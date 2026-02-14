# Story 1.2: Define Response Struct with Error Codes

**Epic:** 1 - Consistent Spreadsheet Actions & Error Handling  
**Story ID:** 1.2  
**Status:** done  
**Created:** 2026-02-14

---

## User Story

**As a** developer  
**I want** a standardized API response format with error codes  
**So that** both native and web modes return consistent, testable responses

---

## Business Context

This story creates the foundational response contract that all API methods will use. It establishes:
- **Consistent error handling** across native and web modes
- **Testable error codes** that can be asserted in tests
- **Clear success/failure indicators** for the UI

**Why this matters:** The PRD emphasizes "clear, actionable error messages" (NFR-U4) and "graceful error handling" (NFR-R4). This Response struct is the mechanism that delivers those requirements. It also enables the UI to distinguish between different error types (circular references, file errors, invalid formulas) and respond appropriately.

**Previous Story Context:** Story 1.1 created the `api/` package structure. This story populates it with the first concrete type that all subsequent API interfaces will use.

---

## Acceptance Criteria

**Given** the `api/` package exists  
**When** I create `api/response.go`  
**Then** it defines a `Response` struct with fields:
- `Success bool` (indicates operation success/failure)
- `Data interface{}` (optional data payload)
- `Error string` (optional error message)
- `Code string` (optional error code for testing)

**And** the following error codes are defined as constants:
- `CIRCULAR_REF` - Circular reference detected in formula
- `INVALID_FORMULA` - Formula parse error
- `EMPTY_CELL_REF` - Reference to empty cell
- `FILE_NOT_FOUND` - File doesn't exist
- `FILE_READ_ERROR` - Cannot read file
- `FILE_WRITE_ERROR` - Cannot write file
- `INVALID_CELL_REF` - Invalid cell reference
- `PARSE_ERROR` - General parsing error

**And** the file includes documentation comments explaining when to use each error code  
**And** example usage is documented in comments

---

## Technical Requirements

### Response Struct Design

Create `api/response.go` with the following structure:

```go
package api

// Response represents a standardized API response for all spreadsheet operations.
// It provides consistent success/failure indication, optional data payloads,
// and structured error information with error codes for testing.
//
// Usage patterns:
//   - Success with data: Response{Success: true, Data: cellValue}
//   - Success without data: Response{Success: true}
//   - Error with code: Response{Success: false, Error: "message", Code: CIRCULAR_REF}
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
```

### Helper Functions (Optional but Recommended)

Consider adding helper functions for common response patterns:

```go
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
```

---

## Architecture Compliance

### From Architecture Document (architecture.md)

**Structured JSON Responses (Section: API Design):**
- Response struct with success, data, error, and code fields
- Error codes enable testable assertions (e.g., `assert response.code == "CIRCULAR_REF"`)
- Consistent format across all API methods

**Error Handling Strategy (Section: Cross-Cutting Concerns):**
- Clear, actionable error messages (NFR-U4)
- Graceful error handling (NFR-R4)
- No crashes on invalid input (NFR-S4)

**Testing Strategy (Section: Testing):**
- Error codes enable precise test assertions
- Both Go unit tests and Playwright tests can check error codes
- Reduces brittle string matching in tests

---

## Implementation Guide

### Step 1: Create api/response.go

Create the file with:
1. Package declaration: `package api`
2. Response struct with JSON tags
3. Error code constants with documentation
4. Optional helper functions

### Step 2: Add Comprehensive Documentation

Each error code should document:
- **What it means** - Brief description
- **Example scenario** - When this error occurs
- **Used by** - Which API methods return this code

This documentation is critical for future developers implementing the API methods in Stories 1.3, 2.2, 3.4, etc.

### Step 3: Verify Compilation

```bash
go build ./api
```

Expected: Successful compilation with no errors.

### Step 4: Verify Tests Still Pass

```bash
go test ./tests/... -v
```

Expected: All 42 tests pass (same as Story 1.1). This story adds new code but doesn't modify existing code, so tests should be unaffected.

---

## Current Codebase Context

### Existing Error Handling Patterns

The current codebase has error handling in several places:

**model/formula.go:**
- Returns `error` from `ParseFormula` and `EvaluateFormula`
- Error messages like "circular reference detected", "invalid formula"

**controller/app.go:**
- Returns `error` from methods like `SetCellValue`, `LoadFile`, `SaveFile`
- HTTP handlers convert errors to JSON responses

**Future Integration:** In Story 2.2, we'll wrap these existing error returns into the new Response struct format. For now, we're just defining the structure.

### JSON Serialization

The Response struct includes JSON tags (`json:"success"`, etc.) because:
- Web mode (Epic 2) will serialize responses to JSON for HTTP
- Native mode (Epic 3) will use Wails IPC, which also uses JSON serialization
- Consistent JSON format across both modes

---

## Testing Requirements

### Unit Tests

No new unit tests required for this story. The Response struct is a simple data structure with no logic to test.

**Future Testing:** In Story 2.2 and beyond, we'll write tests that assert on error codes:

```go
// Example from future Story 2.2
response := api.SetCellValue(0, 0, "=A1")
assert.False(t, response.Success)
assert.Equal(t, api.CIRCULAR_REF, response.Code)
```

### Manual Verification

1. **Compilation:** Verify `go build ./api` succeeds
2. **Documentation:** Verify all error codes have clear documentation
3. **Existing Tests:** Verify `go test ./tests/... -v` still passes

---

## Definition of Done

- [ ] `api/response.go` created with Response struct
- [ ] Response struct has Success, Data, Error, Code fields with JSON tags
- [ ] All 8 error code constants defined (CIRCULAR_REF, INVALID_FORMULA, EMPTY_CELL_REF, FILE_NOT_FOUND, FILE_READ_ERROR, FILE_WRITE_ERROR, INVALID_CELL_REF, PARSE_ERROR)
- [ ] Each error code has documentation comment explaining usage
- [ ] Example usage documented in file comments
- [ ] Optional helper functions added (NewSuccessResponse, NewErrorResponse)
- [ ] `go build ./api` succeeds
- [ ] `go test ./tests/... -v` passes (all 42 tests)
- [ ] Story marked as "done" in sprint-status.yaml

---

## Notes for Developer

### Why interface{} for Data?

The `Data` field uses `interface{}` (or `any` in Go 1.18+) because different API methods return different data types:
- `GetCellValue` returns `map[string]interface{}` with "value" and "computed" fields
- `GetAllCells` returns `[]map[string]interface{}` (array of cell objects)
- `GetFileStatus` returns `map[string]interface{}` with "path", "saved", "modified" fields

Using `interface{}` allows flexibility while maintaining type safety at the API method level.

### Why Both Error and Code?

- **Error** (string) - Human-readable message for users and logs
- **Code** (string) - Machine-readable identifier for tests and UI logic

Example:
```go
Response{
	Success: false,
	Error:   "Circular reference detected: A1 → B1 → A1",
	Code:    CIRCULAR_REF,
}
```

The UI can check `Code == CIRCULAR_REF` to show a specific error icon or help text, while displaying the `Error` message to the user.

### Error Code Naming Convention

Error codes use SCREAMING_SNAKE_CASE to distinguish them from regular Go constants. This is a common pattern in API design and makes error codes easily recognizable in code.

---

## Related Stories

**Previous Story:** 1.1 - Create API Package Structure (completed)  
**Next Story:** 1.3 - Define SpreadsheetAPI Interface  
**Epic Goal:** Establish consistent API contract for both native and web modes  
**Architecture Reference:** Section "Structured JSON Responses" in architecture.md

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** Created `api/response.go` with Response struct (Success, Data, Error, Code fields), all 8 error code constants with comprehensive documentation, and helper functions NewSuccessResponse and NewErrorResponse. Compilation and all 42 tests pass.  
**Challenges Encountered:** None.  
**Learnings for Next Story:** Response struct is ready for use in Story 1.3 (SpreadsheetAPI interface) and Story 2.2 (HTTP API wrapper).
