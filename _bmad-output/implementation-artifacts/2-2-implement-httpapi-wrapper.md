# Story 2.2: Implement HttpAPI Wrapper

**Epic:** 2 - Web Mode Preservation  
**Story ID:** 2.2  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** an HttpAPI implementation that wraps existing controller methods  
**So that** the web mode uses the unified API interface

---

## Business Context

This story creates the bridge between the unified `SpreadsheetAPI` interface (defined in Epic 1) and the existing web mode HTTP server. By wrapping the controller with an HttpAPI struct that implements the interface, we:

- Enable consistent Response format across all API endpoints
- Provide structured error codes for testing and UI logic
- Prepare for frontend migration to unified API (Story 2.4)
- Maintain backward compatibility with existing routes for Playwright tests

**Why this matters:** The dual-mode architecture requires both web and native modes to use the same API contract. This story delivers the web mode implementation, ensuring Response structs, error codes, and method signatures align with the interface.

**Previous Context:**
- Story 2.1 created `cmd/web/main.go` with HTTP server and existing routes
- Story 1.3 defined `SpreadsheetAPI` interface with 11 methods
- Story 1.2 defined `Response` struct and error codes

---

## Acceptance Criteria (from epics.md lines 589-617)

**Given** the web mode entry point exists and SpreadsheetAPI interface is defined  
**When** I create `cmd/web/api_http.go`  
**Then** it defines an `HttpAPI` struct that implements `SpreadsheetAPI` interface  
**And** it wraps the existing `controller.AppController` instance  
**And** each API method:
- Calls the corresponding controller method
- Converts Go errors to `Response` struct with appropriate error codes
- Returns `Response` with success=true and data on success
- Returns `Response` with success=false, error message, and error code on failure  
**And** HTTP handlers are registered for each API method:
- `POST /api/set-cell` → SetCellValue
- `GET /api/get-cell` → GetCellValue
- `GET /api/get-formula` → GetCellFormula
- `DELETE /api/delete-cell` → DeleteCell
- `POST /api/new` → NewSpreadsheet
- `POST /api/load` → LoadFile
- `POST /api/save` → SaveFile
- `GET /api/status` → GetFileStatus
- `GET /api/cells` → GetAllCells  
**And** all handlers return JSON responses matching the `Response` struct format  
**And** error codes are correctly mapped (e.g., circular ref errors → CIRCULAR_REF code)

---

## Technical Requirements

### cmd/web/api_http.go Structure

Create `cmd/web/api_http.go` with:

1. **HttpAPI struct** - Holds reference to `*controller.AppController`
2. **NewHttpAPI(ctrl *controller.AppController) *HttpAPI** - Constructor
3. **Implement all 11 SpreadsheetAPI methods** - Each returns `api.Response`
4. **Error mapping logic** - Convert controller/model errors to Response with codes

### Controller Method Mapping

| API Method     | Controller/Model Method              | Notes                                                    |
|----------------|--------------------------------------|----------------------------------------------------------|
| SetCellValue   | ctrl.SetCellValue                    | Check for circular ref in cell.Computed after call       |
| GetCellValue   | ctrl.GetCellValue, GetCellRawValue   | Return {value, computed}                                 |
| GetCellFormula | ctrl.GetCellRawValue, cell.IsFormula | Return formula if formula cell, else ""                 |
| DeleteCell     | ctrl.Sheet.DeleteCell                | Also remove from dependency graph                        |
| NewSpreadsheet | ctrl.NewFile                         |                                                          |
| LoadFile       | ctrl.LoadFile                        | Map os errors to FILE_NOT_FOUND, FILE_READ_ERROR, PARSE_ERROR |
| SaveFile       | ctrl.SaveFile                        | Map to FILE_WRITE_ERROR                                  |
| GetFileStatus  | ctrl.GetFilePath, HasUnsavedChanges  | Return {path, saved, modified, filename}                 |
| GetAllCells    | Iterate ctrl.Sheet.Cells             | Return array of {row, col, value, computed}              |
| ImportCSV      | Stub (Epic 5)                        | Return NOT_IMPLEMENTED                                   |
| ExportCSV      | Stub (Epic 5)                        | Return NOT_IMPLEMENTED                                   |

### Error Code Mapping

| Controller/Model Error              | Response Code   |
|-------------------------------------|-----------------|
| Circular reference (in cell.Computed)| CIRCULAR_REF    |
| Formula parse/syntax error          | INVALID_FORMULA |
| os.IsNotExist (LoadFile)            | FILE_NOT_FOUND  |
| os.IsPermission (LoadFile)          | FILE_READ_ERROR |
| Decode/parse error (LoadFile)       | PARSE_ERROR     |
| os.Create/Write error (SaveFile)    | FILE_WRITE_ERROR|
| Invalid row/col (negative, bounds)   | INVALID_CELL_REF|
| CSV not implemented                 | PARSE_ERROR     |

### Response Struct Usage

```go
// Success with data
return api.NewSuccessResponse(map[string]interface{}{
    "value": rawValue,
    "computed": computedValue,
})

// Success without data
return api.NewSuccessResponse(nil)

// Error with code
return api.NewErrorResponse("Circular reference detected", api.CIRCULAR_REF)
```

---

## Implementation Guide

### Step 1: Create HttpAPI struct and constructor

```go
package main

import (
    "gosheet/api"
    "gosheet/controller"
)

type HttpAPI struct {
    ctrl *controller.AppController
}

func NewHttpAPI(ctrl *controller.AppController) *HttpAPI {
    return &HttpAPI{ctrl: ctrl}
}
```

### Step 2: Implement SetCellValue with circular ref detection

The controller sets the cell to "#ERROR: Circular reference: ..." and returns nil. Check cell.Computed after the call:

```go
func (h *HttpAPI) SetCellValue(row, col int, value string) api.Response {
    if row < 0 || col < 0 {
        return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
    }
    err := h.ctrl.SetCellValue(row, col, value)
    if err != nil {
        return api.NewErrorResponse(err.Error(), api.INVALID_FORMULA)
    }
    cell := h.ctrl.Sheet.GetCell(row, col)
    if cell != nil && strings.Contains(cell.Computed, "Circular reference") {
        return api.NewErrorResponse(cell.Computed, api.CIRCULAR_REF)
    }
    return api.NewSuccessResponse(nil)
}
```

### Step 3: Implement GetCellValue

```go
func (h *HttpAPI) GetCellValue(row, col int) api.Response {
    if row < 0 || col < 0 {
        return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
    }
    value := h.ctrl.GetCellRawValue(row, col)
    computed := h.ctrl.GetCellValue(row, col)
    return api.NewSuccessResponse(map[string]interface{}{
        "value":    value,
        "computed": computed,
    })
}
```

### Step 4: Implement GetAllCells (array format)

```go
func (h *HttpAPI) GetAllCells() api.Response {
    var cells []map[string]interface{}
    for row, rowMap := range h.ctrl.Sheet.Cells {
        for col, cell := range rowMap {
            if cell != nil {
                cells = append(cells, map[string]interface{}{
                    "row":      row,
                    "col":      col,
                    "value":    cell.Value,
                    "computed": cell.Computed,
                })
            }
        }
    }
    return api.NewSuccessResponse(cells)
}
```

### Step 5: Map file errors in LoadFile

```go
func (h *HttpAPI) LoadFile(path string) api.Response {
    err := h.ctrl.LoadFile(path)
    if err != nil {
        if errors.Is(err, os.ErrNotExist) {
            return api.NewErrorResponse(err.Error(), api.FILE_NOT_FOUND)
        }
        if errors.Is(err, os.ErrPermission) {
            return api.NewErrorResponse(err.Error(), api.FILE_READ_ERROR)
        }
        return api.NewErrorResponse(err.Error(), api.PARSE_ERROR)
    }
    return api.NewSuccessResponse(map[string]interface{}{
        "cellCount": h.ctrl.Sheet.GetCellCount(),
    })
}
```

---

## Example Implementations

### DeleteCell (with dependency cleanup)

```go
func (h *HttpAPI) DeleteCell(row, col int) api.Response {
    if row < 0 || col < 0 {
        return api.NewErrorResponse("Invalid cell reference", api.INVALID_CELL_REF)
    }
    cellRef := model.CoordsToRef(row, col)
    h.ctrl.Sheet.Dependencies.RemoveDependencies(cellRef)
    h.ctrl.Sheet.DeleteCell(row, col)
    return api.NewSuccessResponse(nil)
}
```

### GetFileStatus

```go
func (h *HttpAPI) GetFileStatus() api.Response {
    path := h.ctrl.GetFilePath()
    modified := h.ctrl.HasUnsavedChanges()
    filename := filepath.Base(path)
    if path == "" {
        filename = ""
    }
    return api.NewSuccessResponse(map[string]interface{}{
        "path":     path,
        "saved":    !modified,
        "modified": modified,
        "filename": filename,
    })
}
```

---

## HTTP Route Registration

Register in main.go alongside existing routes:

```go
api := NewHttpAPI(ctrl)

// Unified API routes (Response format)
http.HandleFunc("/api/set-cell", corsMiddleware(handleSetCellAPI(api)))
http.HandleFunc("/api/get-cell", corsMiddleware(handleGetCellAPI(api)))
// ... etc
```

Handler pattern - parse request, call API method, write Response as JSON:

```go
func handleSetCellAPI(api *HttpAPI) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost { ... }
        var req struct { Row, Col int; Value string }
        json.NewDecoder(r.Body).Decode(&req)
        resp := api.SetCellValue(req.Row, req.Col, req.Value)
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(resp)
    }
}
```

---

## Definition of Done

- [x] `cmd/web/api_http.go` created with HttpAPI struct
- [x] All 11 SpreadsheetAPI methods implemented
- [x] Error codes correctly mapped (circular ref → CIRCULAR_REF, etc.)
- [x] Unified routes registered in main.go
- [x] Existing routes preserved for Playwright tests
- [x] `go build ./cmd/web` succeeds
- [x] `go test ./tests/... -v` passes (all tests)
- [x] Server runs: `go run ./cmd/web`
- [x] Story marked "done" in sprint-status.yaml

---

## Related Stories

**Previous Story:** 2.1 - Create Web Mode Entry Point  
**Next Story:** 2.3 - Implement Web Mode FileService  
**Epic Goal:** Preserve web mode with unified API layer

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** Created `cmd/web/api_http.go` with HttpAPI struct implementing all 11 SpreadsheetAPI methods. Wraps controller.AppController, maps errors to Response with appropriate codes (CIRCULAR_REF, FILE_NOT_FOUND, etc.). ImportCSV and ExportCSV return stub errors for Epic 5. Registered 9 unified routes in main.go: /api/set-cell, /api/get-cell, /api/get-formula, /api/delete-cell, /api/new, /api/load, /api/save, /api/status, /api/cells. Existing routes preserved for Playwright backward compatibility. Added DELETE to CORS Allow-Methods for delete-cell.  
**Challenges Encountered:** None.  
**Learnings for Next Story:** HttpAPI is ready for Story 2.3 (FileService) and Story 2.4 (frontend migration to unified API).
