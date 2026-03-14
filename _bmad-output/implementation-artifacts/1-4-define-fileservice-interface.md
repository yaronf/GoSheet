# Story 1.4: Define FileService Interface

**Epic:** 1 - Consistent Spreadsheet Actions & Error Handling  
**Story ID:** 1.4  
**Status:** done  
**Created:** 2026-02-14

---

## User Story

**As a** developer  
**I want** a unified FileService interface  
**So that** native and web modes can implement file dialogs and I/O independently

---

## Business Context

This story defines the file operations interface that separates native and web mode implementations. It establishes:
- **File dialog abstraction** (native macOS dialogs vs browser File API)
- **File I/O abstraction** (direct disk access vs temp files)
- **Mode-specific implementation notes** for future developers

**Why this matters:** The PRD's core problem is "accurate file status with real file paths" - something web mode cannot provide. This interface is the abstraction that allows:
- Native mode to use real macOS file dialogs and direct disk I/O
- Web mode to use browser File API for Playwright testing
- Both modes to implement the same contract

**Previous Story Context:**
- Story 1.1 created the `api/` package structure
- Story 1.2 defined the `Response` struct for API responses
- Story 1.3 defined the `SpreadsheetAPI` interface for spreadsheet operations
- This story completes Epic 1 by defining the file operations interface

---

## Acceptance Criteria

**Given** the `api/` package and Response struct exist  
**When** I create `api/fileservice.go`  
**Then** it defines a `FileService` interface with the following methods:
- `OpenFileDialog(filters []string) (path string, err error)` - Show open file dialog
- `SaveFileDialog(defaultName string) (path string, err error)` - Show save file dialog
- `ReadFile(path string) ([]byte, error)` - Read file contents
- `WriteFile(path string, data []byte) error` - Write file contents

**And** each method is documented with:
- Purpose and behavior
- Parameters and return values
- Mode-specific implementation notes (native vs web)

**And** the file includes documentation explaining:
- Native mode uses Wails dialogs with real file paths
- Web mode uses browser File API with temp files for testing

**And** the interface follows Go naming conventions

---

## Technical Requirements

### FileService Interface Design

Create `api/fileservice.go` with comprehensive documentation:

```go
package api

// FileService defines the unified interface for file operations.
// This interface abstracts file dialogs and I/O to support both:
//   - Native mode: Wails dialogs with direct disk access
//   - Web mode: Browser File API with temp files for testing
//
// Implementation notes:
//   - Native mode: cmd/native/fileservice_wails.go (Story 4.1-4.2)
//   - Web mode: cmd/web/fileservice_http.go (Story 2.3)
//
// Design rationale:
// This interface does NOT return Response struct (unlike SpreadsheetAPI)
// because file operations are lower-level primitives that may be called
// from multiple contexts. Error handling is done via standard Go errors,
// which callers can wrap into Response structs as needed.
type FileService interface {
	// OpenFileDialog displays a file selection dialog and returns the chosen path.
	//
	// Parameters:
	//   - filters: File type filters (e.g., [".sheet", ".csv"])
	//
	// Returns:
	//   - path: Absolute file path selected by user (empty if cancelled)
	//   - err: Error if dialog fails (nil if cancelled by user)
	//
	// Mode-specific behavior:
	//   - Native mode: Uses Wails OpenFileDialog with native macOS UI
	//     Returns real file path like "/Users/name/Documents/Budget.sheet"
	//   - Web mode: Uses browser file input element
	//     Returns temp path like "/tmp/upload-12345.sheet"
	//
	// Example:
	//   path, err := fs.OpenFileDialog([]string{".sheet"})
	//   if err != nil {
	//     return NewErrorResponse("Failed to open file dialog", FILE_READ_ERROR)
	//   }
	//   if path == "" {
	//     // User cancelled - not an error
	//     return NewSuccessResponse(nil)
	//   }
	//   // Proceed to read file at path
	OpenFileDialog(filters []string) (path string, err error)

	// SaveFileDialog displays a save dialog and returns the chosen path.
	//
	// Parameters:
	//   - defaultName: Suggested filename (e.g., "Untitled.sheet")
	//
	// Returns:
	//   - path: Absolute file path selected by user (empty if cancelled)
	//   - err: Error if dialog fails (nil if cancelled by user)
	//
	// Mode-specific behavior:
	//   - Native mode: Uses Wails SaveFileDialog with native macOS UI
	//     Returns real file path like "/Users/name/Documents/Budget.sheet"
	//     Automatically appends .sheet extension if missing
	//   - Web mode: Uses browser download mechanism
	//     Returns temp path like "/tmp/download-12345.sheet"
	//
	// Example:
	//   path, err := fs.SaveFileDialog("Untitled.sheet")
	//   if err != nil {
	//     return NewErrorResponse("Failed to open save dialog", FILE_WRITE_ERROR)
	//   }
	//   if path == "" {
	//     // User cancelled - not an error
	//     return NewSuccessResponse(nil)
	//   }
	//   // Proceed to write file to path
	SaveFileDialog(defaultName string) (path string, err error)

	// ReadFile reads the entire file contents from the given path.
	//
	// Parameters:
	//   - path: Absolute file path to read
	//
	// Returns:
	//   - data: File contents as byte slice
	//   - err: Error if file cannot be read
	//
	// Mode-specific behavior:
	//   - Native mode: Uses Go's os.ReadFile for direct disk access
	//     Respects macOS file permissions
	//   - Web mode: Reads from temp storage (uploaded files)
	//     Limited to files uploaded via browser
	//
	// Possible errors:
	//   - File not found (os.ErrNotExist)
	//   - Permission denied (os.ErrPermission)
	//   - I/O errors (various)
	//
	// Example:
	//   data, err := fs.ReadFile(path)
	//   if err != nil {
	//     if os.IsNotExist(err) {
	//       return NewErrorResponse("File not found", FILE_NOT_FOUND)
	//     }
	//     return NewErrorResponse("Cannot read file", FILE_READ_ERROR)
	//   }
	//   // Proceed to deserialize data
	ReadFile(path string) ([]byte, error)

	// WriteFile writes data to the given file path.
	//
	// Parameters:
	//   - path: Absolute file path to write
	//   - data: File contents as byte slice
	//
	// Returns:
	//   - err: Error if file cannot be written (nil on success)
	//
	// Mode-specific behavior:
	//   - Native mode: Uses Go's os.WriteFile for direct disk access
	//     Creates file with 0644 permissions
	//     Overwrites existing file
	//   - Web mode: Writes to temp storage for download
	//     Triggers browser download mechanism
	//
	// Possible errors:
	//   - Permission denied (os.ErrPermission)
	//   - Disk full (various)
	//   - I/O errors (various)
	//
	// Example:
	//   err := fs.WriteFile(path, data)
	//   if err != nil {
	//     return NewErrorResponse("Cannot write file", FILE_WRITE_ERROR)
	//   }
	//   return NewSuccessResponse(nil)
	WriteFile(path string, data []byte) error
}
```

---

## Architecture Compliance

### From Architecture Document (architecture.md)

**Mode-Aware File Service (Section: File I/O Layer):**
- Native mode: Wails dialogs with real file paths
- Web mode: Browser File API with temp files
- Single interface, dual implementations

**File Dialog Requirements (Section: macOS Integration):**
- Native macOS dialogs (NFR-U3)
- Standard keyboard shortcuts (Cmd+O, Cmd+S)
- File type filters (.sheet, .csv)

**File I/O Requirements (Section: Reliability):**
- No file corruption (NFR-R1)
- Respect file permissions (NFR-S2)
- Graceful error handling (NFR-R4)

---

## Implementation Guide

### Step 1: Create api/fileservice.go

Create the file with:
1. Package declaration: `package api`
2. FileService interface definition
3. Comprehensive documentation for each method

### Step 2: Document Mode-Specific Behavior

For each method, clearly document:
- **Native mode:** How Wails implements this (real dialogs, direct I/O)
- **Web mode:** How HTTP implements this (browser API, temp files)
- **Error handling:** What errors can occur and how to handle them

This documentation is critical for:
- Story 2.3 (implementing HttpFileService)
- Story 4.1-4.2 (implementing WailsFileService)

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

### Existing File Operations

The current `server/main.go` has HTTP handlers for file operations:
- `/api/load` - Loads file from temp storage
- `/api/save` - Saves file to temp storage
- File upload/download via browser

**Future Migration:**
- Story 2.3 will wrap these into HttpFileService
- Story 4.1-4.2 will implement WailsFileService with native dialogs

### File Format

The `.sheet` file format uses MessagePack encoding (binary, cross-language):
- Defined in `model/file.go`
- Functions: `SaveToFile(path string)`, `LoadFromFile(path string)`, `SaveToBytes()`, `LoadFromBytes()`
- Format spec: `docs/FILE_FORMAT.md` (v2.0)

---

## Testing Requirements

### Unit Tests

No new unit tests required for this story. The interface is a contract definition with no implementation to test.

**Future Testing:**
- Story 2.3 will test HttpFileService implementation
- Story 4.1-4.2 will test WailsFileService implementation

### Manual Verification

1. **Compilation:** Verify `go build ./api` succeeds
2. **Documentation:** Verify all methods have clear documentation
3. **Existing Tests:** Verify `go test ./tests/... -v` still passes

---

## Definition of Done

- [ ] `api/fileservice.go` created with FileService interface
- [ ] All 4 methods defined (OpenFileDialog, SaveFileDialog, ReadFile, WriteFile)
- [ ] Each method documented with purpose, parameters, returns, and mode-specific behavior
- [ ] Documentation explains native vs web mode differences
- [ ] Interface follows Go naming conventions (PascalCase)
- [ ] `go build ./api` succeeds
- [ ] `go test ./tests/... -v` passes (all 42 tests)
- [ ] Epic 1 is complete (all 4 stories done)
- [ ] Story marked as "done" in sprint-status.yaml

---

## Notes for Developer

### Why Not Use Response Struct?

Unlike `SpreadsheetAPI`, this interface uses standard Go error returns instead of `Response` struct because:
1. **Lower-level primitives:** File operations are building blocks used by higher-level APIs
2. **Standard Go patterns:** File I/O conventionally returns `error`, not custom types
3. **Flexibility:** Callers can wrap errors into Response structs as needed

Example usage in SpreadsheetAPI implementation:
```go
func (api *WailsAPI) LoadFile(path string) Response {
	data, err := api.fileService.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return NewErrorResponse("File not found", FILE_NOT_FOUND)
		}
		return NewErrorResponse("Cannot read file", FILE_READ_ERROR)
	}
	// Deserialize and load...
	return NewSuccessResponse(map[string]interface{}{"cellCount": count})
}
```

### File Path Conventions

**Native mode:**
- Uses absolute paths: `/Users/name/Documents/Budget.sheet`
- Paths are real and persistent
- File status shows real path to user

**Web mode:**
- Uses temp paths: `/tmp/upload-12345.sheet`
- Paths are temporary and session-scoped
- File status shows "Untitled" (not temp path)

### File Type Filters

The `filters` parameter uses file extensions:
- `.sheet` - Spreadsheet files
- `.csv` - CSV files

Native mode will display these in the file dialog. Web mode will use them as `accept` attribute on file input elements.

---

## Related Stories

**Previous Story:** 1.3 - Define SpreadsheetAPI Interface (completed)  
**Next Epic:** Epic 2 - Web Mode Preservation  
**Epic 1 Status:** Complete (all 4 stories done)  
**Architecture Reference:** Section "Mode-Aware File Service" in architecture.md

---

## Epic 1 Completion

This story completes Epic 1: Consistent Spreadsheet Actions & Error Handling.

**Epic 1 Deliverables:**
- ✅ Story 1.1: API package structure created
- ✅ Story 1.2: Response struct with error codes defined
- ✅ Story 1.3: SpreadsheetAPI interface defined
- ✅ Story 1.4: FileService interface defined (this story)

**What's Next:**
Epic 2 will implement these interfaces for web mode, wrapping the existing HTTP server and preserving all 74 tests.

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** Created api/fileservice.go with FileService interface containing all 4 methods (OpenFileDialog, SaveFileDialog, ReadFile, WriteFile). Each method has comprehensive documentation including purpose, parameters, returns, mode-specific behavior (native vs web), possible errors, and usage examples.  
**Challenges Encountered:** None. Straightforward interface definition per story specification.  
**Learnings for Next Story:** FileService uses standard Go errors (not Response struct) as lower-level primitives. Story 2.3 will implement HttpFileService; Story 4.1-4.2 will implement WailsFileService.
