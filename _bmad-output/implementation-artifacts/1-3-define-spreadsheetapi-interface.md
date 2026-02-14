# Story 1.3: Define SpreadsheetAPI Interface

**Epic:** 1 - Consistent Spreadsheet Actions & Error Handling  
**Story ID:** 1.3  
**Status:** done  
**Created:** 2026-02-14

---

## User Story

**As a** developer  
**I want** a unified SpreadsheetAPI interface  
**So that** native and web modes can implement the same contract for all spreadsheet operations

---

## Business Context

This story defines the core API contract that both native (Wails) and web (HTTP) modes will implement. It establishes:
- **Unified method signatures** for all spreadsheet operations
- **Consistent Response format** using the struct from Story 1.2
- **Clear documentation** of expected data structures and error codes

**Why this matters:** This interface is the key to dual-mode architecture. By defining a single contract, we ensure that:
- The frontend can call the same methods in both modes
- Both implementations must handle the same operations
- Tests can verify behavior consistently across modes

**Previous Story Context:**
- Story 1.1 created the `api/` package structure
- Story 1.2 defined the `Response` struct that all these methods will return

---

## Acceptance Criteria

**Given** the `api/` package and Response struct exist  
**When** I create `api/spreadsheet.go`  
**Then** it defines a `SpreadsheetAPI` interface with the following methods (all returning `Response`):
- `SetCellValue(row, col int, value string) Response` - Set cell value or formula
- `GetCellValue(row, col int) Response` - Get cell value and computed result
- `GetCellFormula(row, col int) Response` - Get cell formula (if any)
- `DeleteCell(row, col int) Response` - Delete cell contents
- `NewSpreadsheet() Response` - Create new empty spreadsheet
- `LoadFile(path string) Response` - Load .sheet file from disk
- `SaveFile(path string) Response` - Save spreadsheet to disk
- `GetFileStatus() Response` - Get current file status (saved/unsaved, path)
- `GetAllCells() Response` - Get all non-empty cells for rendering
- `ImportCSV(path string) Response` - Import CSV file (Epic 5)
- `ExportCSV(path string) Response` - Export to CSV file (Epic 5)

**And** each method is documented with:
- Purpose and behavior
- Expected Response.Data structure
- Possible error codes

**And** the interface follows Go naming conventions (PascalCase for exported)

---

## Technical Requirements

### SpreadsheetAPI Interface Design

Create `api/spreadsheet.go` with comprehensive documentation:

```go
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
	//   response := api.SetCellValue(0, 0, "=SUM(B1:B10)")
	//   if !response.Success {
	//     log.Printf("Error: %s (code: %s)", response.Error, response.Code)
	//   }
	SetCellValue(row, col int, value string) Response

	// GetCellValue retrieves a cell's value and computed result.
	//
	// Parameters:
	//   - row: 0-based row index
	//   - col: 0-based column index
	//
	// Response.Data structure:
	//   {
	//     "value": string,    // Raw cell value or formula
	//     "computed": string  // Evaluated result (for formulas)
	//   }
	//
	// Possible error codes:
	//   - INVALID_CELL_REF: row/col out of bounds
	//
	// Example:
	//   response := api.GetCellValue(0, 0)
	//   if response.Success {
	//     data := response.Data.(map[string]interface{})
	//     fmt.Printf("Value: %s, Computed: %s\n", data["value"], data["computed"])
	//   }
	GetCellValue(row, col int) Response

	// GetCellFormula retrieves a cell's formula (if any).
	//
	// Parameters:
	//   - row: 0-based row index
	//   - col: 0-based column index
	//
	// Response.Data structure:
	//   {
	//     "formula": string  // Formula string (empty if not a formula)
	//   }
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
	//   {
	//     "cellCount": int  // Number of cells loaded
	//   }
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
	//   {
	//     "path": string,      // File path (empty if unsaved)
	//     "saved": bool,       // true if saved, false if modified
	//     "modified": bool,    // true if unsaved changes exist
	//     "filename": string   // Filename only (e.g., "Budget.sheet")
	//   }
	//
	// Possible error codes: none (operation always succeeds)
	//
	// Example:
	//   response := api.GetFileStatus()
	//   data := response.Data.(map[string]interface{})
	//   if data["modified"].(bool) {
	//     fmt.Println("You have unsaved changes!")
	//   }
	GetFileStatus() Response

	// GetAllCells retrieves all non-empty cells for rendering.
	//
	// Response.Data structure: array of cell objects
	//   [
	//     {
	//       "row": int,
	//       "col": int,
	//       "value": string,    // Raw value or formula
	//       "computed": string  // Evaluated result
	//     },
	//     ...
	//   ]
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
	//   {
	//     "rowCount": int,    // Number of rows imported
	//     "colCount": int     // Number of columns imported
	//   }
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
```

---

## Architecture Compliance

### From Architecture Document (architecture.md)

**Unified API Layer (Section: API Design):**
- Single interface implemented by both modes
- Consistent method signatures and return types
- Mode-agnostic business logic

**IPC vs HTTP Mapping (Section: Implementation Approach):**
- Native mode: Wails binds these methods to `window.wails.Call.*`
- Web mode: HTTP handlers map to these methods via REST endpoints
- Frontend uses mode detection to call appropriate transport

**Response Contract (Section: API Design):**
- All methods return Response struct (from Story 1.2)
- Consistent error handling with error codes
- Testable assertions on error conditions

---

## Implementation Guide

### Step 1: Create api/spreadsheet.go

Create the file with:
1. Package declaration: `package api`
2. SpreadsheetAPI interface definition
3. Comprehensive documentation for each method

### Step 2: Document Data Structures

For each method, clearly document:
- **Parameters:** What each parameter means, valid ranges
- **Response.Data:** Exact structure (use JSON-like notation)
- **Error codes:** Which errors can occur and why

This documentation is critical for:
- Story 2.2 (implementing HttpAPI wrapper)
- Story 3.4 (implementing WailsAPI wrapper)
- Frontend developers calling these methods

### Step 3: Verify Compilation

```bash
go build ./api
```

Expected: Successful compilation with no errors.

### Step 4: Verify Tests Still Pass

```bash
go test ./tests/... -v
```

Expected: All 42 tests pass. This story adds an interface definition (no implementation), so existing tests are unaffected.

---

## Current Codebase Context

### Existing Controller Methods

The `controller/app.go` file has methods that will be wrapped by this API:

**Existing methods:**
- `SetCellValue(row, col int, value string) error`
- `GetCell(row, col int) (*model.Cell, error)`
- `LoadFile(path string) error`
- `SaveFile(path string) error`
- `NewSpreadsheet()`

**Mapping to API:**
- Story 2.2 (web mode) will wrap these methods with HttpAPI
- Story 3.4 (native mode) will wrap these methods with WailsAPI
- Both wrappers convert `error` returns to `Response` struct with error codes

### Cell Coordinate System

The codebase uses 0-based indexing:
- Row 0 = first row (displayed as "1" in UI)
- Col 0 = column A (displayed as "A" in UI)

The `model/coords.go` file has helper functions:
- `ColToLetter(col int) string` - Convert 0-based col to letter (0 → "A")
- `LetterToCol(letter string) int` - Convert letter to 0-based col ("A" → 0)

---

## Testing Requirements

### Unit Tests

No new unit tests required for this story. The interface is a contract definition with no implementation to test.

**Future Testing:** In Stories 2.2 and 3.4, we'll write tests that verify implementations conform to this interface.

### Manual Verification

1. **Compilation:** Verify `go build ./api` succeeds
2. **Documentation:** Verify all methods have clear documentation
3. **Existing Tests:** Verify `go test ./tests/... -v` still passes

---

## Definition of Done

- [ ] `api/spreadsheet.go` created with SpreadsheetAPI interface
- [ ] All 11 methods defined (SetCellValue, GetCellValue, GetCellFormula, DeleteCell, NewSpreadsheet, LoadFile, SaveFile, GetFileStatus, GetAllCells, ImportCSV, ExportCSV)
- [ ] All methods return Response struct
- [ ] Each method documented with purpose, parameters, Response.Data structure, and error codes
- [ ] Interface follows Go naming conventions (PascalCase)
- [ ] `go build ./api` succeeds
- [ ] `go test ./tests/... -v` passes (all 42 tests)
- [ ] Story marked as "done" in sprint-status.yaml

---

## Notes for Developer

### Why 0-Based Indexing?

The API uses 0-based row/col indexing (matching Go conventions) even though the UI displays 1-based rows and A-Z columns. The conversion happens in the frontend:
- UI "A1" → API (row=0, col=0)
- UI "B3" → API (row=2, col=1)

This keeps the Go code consistent with standard array indexing.

### Why ImportCSV and ExportCSV Now?

Even though CSV operations are implemented in Epic 5, we define the methods now so the interface is complete. The implementations will be added later, but the contract is established upfront.

This allows:
- Frontend to reference these methods (even if not yet functional)
- Epic 5 developers to implement against a defined contract
- No interface changes needed in Epic 5

### Method Naming Conventions

- **Get** prefix: Retrieves data (GetCellValue, GetFileStatus, GetAllCells)
- **Set** prefix: Modifies data (SetCellValue)
- **Delete** prefix: Removes data (DeleteCell)
- **New** prefix: Creates new instance (NewSpreadsheet)
- **Load/Save** prefix: File I/O (LoadFile, SaveFile)
- **Import/Export** prefix: Data conversion (ImportCSV, ExportCSV)

These conventions make the API self-documenting and predictable.

---

## Related Stories

**Previous Story:** 1.2 - Define Response Struct with Error Codes (completed)  
**Next Story:** 1.4 - Define FileService Interface  
**Epic Goal:** Establish consistent API contract for both native and web modes  
**Architecture Reference:** Section "Unified API Layer" in architecture.md

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** Created `api/spreadsheet.go` with SpreadsheetAPI interface containing all 11 methods. Each method has comprehensive documentation including parameters, Response.Data structure (JSON-like notation), possible error codes, and usage examples where appropriate. Interface follows Go naming conventions (PascalCase).  
**Challenges Encountered:** None. Implementation was straightforward following the story specification.  
**Learnings for Next Story:** The interface is a pure contract—no implementation. Stories 2.2 (HttpAPI) and 3.4 (WailsAPI) will wrap the controller methods to conform to this interface.
