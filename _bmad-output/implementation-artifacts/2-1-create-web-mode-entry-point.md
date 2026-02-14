# Story 2.1: Create Web Mode Entry Point

**Epic:** 2 - Web Mode Preservation  
**Story ID:** 2.1  
**Status:** done  
**Created:** 2026-02-14

---

## User Story

**As a** developer  
**I want** a web mode entry point that initializes the HTTP server  
**So that** the existing web-based spreadsheet continues to work with the new architecture

---

## Business Context

This story migrates the existing `server/main.go` to the new `cmd/web/main.go` structure, aligning with the dual-mode architecture established in Epic 1. It:
- Moves the HTTP server to the correct package location
- Maintains all existing functionality (static file serving, API routes)
- Prepares for the unified API layer (Stories 2.2-2.4)

**Why this matters:** This is the first step in preserving web mode functionality while transitioning to the new architecture. The existing `server/` directory will eventually be deprecated, but for now we create the new entry point alongside it to ensure a smooth migration.

**Previous Context:**
- Epic 1 created the `api/` package and `cmd/web/` directory structure
- The existing `server/main.go` has a working HTTP server with all routes
- This story creates `cmd/web/main.go` as the new entry point

---

## Acceptance Criteria

**Given** the API interfaces are defined  
**When** I create `cmd/web/main.go`  
**Then** it initializes an HTTP server on port 8080  
**And** it creates an instance of `controller.AppController`  
**And** it serves static files from `frontend/` directory  
**And** it registers an `/api/` route namespace (handler registration and implementations are added in later stories)  
**And** it starts the server with graceful shutdown handling  
**And** the server can be started with `go run ./cmd/web`  
**And** the server logs startup message with port number

---

## Technical Requirements

### cmd/web/main.go Structure

Create `cmd/web/main.go` based on the existing `server/main.go`, with these changes:

```go
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"

	"gosheet/controller"
)

var ctrl *controller.AppController

func main() {
	// Parse command line flags
	port := flag.String("port", "8080", "Port to run the server on")
	flag.Parse()
	
	// Create controller
	ctrl = controller.NewAppController()
	
	// Add sample data
	log.Println("Loading sample data...")
	ctrl.SetCellValue(0, 0, "10")
	ctrl.SetCellValue(1, 0, "20")
	ctrl.SetCellValue(2, 0, "30")
	ctrl.SetCellValue(3, 0, "=SUM(A1:A3)")
	ctrl.SetCellValue(0, 1, "=A1*2")
	// Clear Modified flag - sample data is the initial state
	ctrl.Sheet.Modified = false
	log.Println("Sample data loaded")
	
	// Enable CORS for development
	http.HandleFunc("/", corsMiddleware(serveStatic))
	
	// Existing API routes (preserved for now, will be refactored in Story 2.2)
	http.HandleFunc("/api/cell/value", corsMiddleware(handleGetCellValue))
	http.HandleFunc("/api/cell/raw", corsMiddleware(handleGetCellRawValue))
	http.HandleFunc("/api/cell/set", corsMiddleware(handleSetCellValue))
	http.HandleFunc("/api/cell/ref", corsMiddleware(handleGetCellRef))
	http.HandleFunc("/api/cells/all", corsMiddleware(handleGetAllCells))
	http.HandleFunc("/api/file/save", corsMiddleware(handleSaveFile))
	http.HandleFunc("/api/file/load", corsMiddleware(handleLoadFile))
	http.HandleFunc("/api/file/new", corsMiddleware(handleNewFile))
	http.HandleFunc("/api/file/status", corsMiddleware(handleFileStatus))
	http.HandleFunc("/api/file/download", corsMiddleware(handleDownloadFile))
	http.HandleFunc("/api/file/upload", corsMiddleware(handleUploadFile))
	
	log.Printf("GoSheet web mode server running at http://localhost:%s\n", *port)
	fmt.Printf("Open http://localhost:%s in your browser\n", *port)
	
	if err := http.ListenAndServe(":"+*port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// Copy all handler functions from server/main.go:
// - corsMiddleware
// - serveStatic
// - handleGetCellValue
// - handleGetCellRawValue
// - handleSetCellValue
// - handleGetCellRef
// - handleGetAllCells
// - handleSaveFile
// - handleLoadFile
// - handleNewFile
// - handleFileStatus
// - handleDownloadFile
// - handleUploadFile
```

### Key Changes from server/main.go

1. **Default port:** Changed from 3000 to 8080 (standard HTTP port)
2. **Log message:** Updated to say "web mode server" for clarity
3. **Location:** New file in `cmd/web/` instead of `server/`
4. **All handlers:** Copy all existing handlers unchanged

### Static File Serving

The `serveStatic` function needs to handle the new directory structure:

```go
func serveStatic(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" {
		http.ServeFile(w, r, "../../frontend/index.html")
		return
	}
	http.ServeFile(w, r, "../../frontend"+r.URL.Path)
}
```

Note: Path is `../../frontend/` because we're now in `cmd/web/`, which is two levels deep.

---

## Architecture Compliance

### From Architecture Document (architecture.md)

**Package-Based Separation (Section: Implementation Approach):**
- `cmd/web/` contains HTTP server entry point
- Shared code remains in `model/`, `controller/`
- Frontend served from `frontend/` directory

**Web Mode Preservation (Section: Migration Strategy):**
- Existing HTTP server continues to work
- All 32 Playwright tests must continue to pass
- No functional changes to existing behavior

**Dual-Mode Build (Section: Build Strategy):**
- `go run ./cmd/web` runs web mode
- `go run ./server` still works (for now, deprecated later)
- Both entry points use the same controller

---

## Implementation Guide

### Step 1: Copy server/main.go to cmd/web/main.go

```bash
cp server/main.go cmd/web/main.go
```

### Step 2: Update Default Port

Change line 21 from:
```go
port := flag.String("port", "3000", "Port to run the server on")
```

To:
```go
port := flag.String("port", "8080", "Port to run the server on")
```

### Step 3: Update Log Message

Change line 52 from:
```go
log.Printf("GoSheet server running at http://localhost:%s\n", *port)
```

To:
```go
log.Printf("GoSheet web mode server running at http://localhost:%s\n", *port)
```

### Step 4: Fix Static File Paths

Update the `serveStatic` function (lines 77-83) to use `../../frontend/` instead of `../frontend/`:

```go
func serveStatic(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" {
		http.ServeFile(w, r, "../../frontend/index.html")
		return
	}
	http.ServeFile(w, r, "../../frontend"+r.URL.Path)
}
```

### Step 5: Verify Server Runs

```bash
go run ./cmd/web
```

Expected output:
```
Loading sample data...
Sample data loaded
GoSheet web mode server running at http://localhost:8080
Open http://localhost:8080 in your browser
```

### Step 6: Test in Browser

1. Open http://localhost:8080
2. Verify the spreadsheet loads with sample data
3. Verify you can edit cells
4. Verify formulas calculate correctly

### Step 7: Verify Tests Pass

```bash
go test ./tests/... -v
```

Expected: All 42 Go unit tests pass.

---

## Current Codebase Context

### Existing server/main.go

The current server has:
- Port 3000 default
- Sample data initialization
- CORS middleware
- 11 API endpoints
- Static file serving from `../frontend/`

### Controller Methods Used

The server uses these controller methods:
- `NewAppController()` - Create controller instance
- `SetCellValue(row, col, value)` - Set cell value/formula
- `GetCellValue(row, col)` - Get computed cell value
- `GetCellRawValue(row, col)` - Get raw cell value
- `GetCellRef(row, col)` - Get cell reference (e.g., "A1")
- `SaveFile(path)` - Save to disk
- `LoadFile(path)` - Load from disk
- `NewFile()` - Create new spreadsheet
- `GetFilePath()` - Get current file path
- `HasUnsavedChanges()` - Check if modified

All these methods will be wrapped by the unified API in Story 2.2.

---

## Testing Requirements

### Manual Testing

1. **Server Startup:**
   ```bash
   go run ./cmd/web
   ```
   Expected: Server starts on port 8080

2. **Browser Access:**
   - Open http://localhost:8080
   - Verify spreadsheet loads
   - Verify sample data displays (10, 20, 30, 60, 20)

3. **Cell Editing:**
   - Click a cell and type a value
   - Verify it updates
   - Enter a formula (e.g., `=A1+A2`)
   - Verify it calculates

4. **File Operations:**
   - Click "Save" (downloads file)
   - Click "Open" (uploads file)
   - Verify file operations work

### Unit Tests

```bash
go test ./tests/... -v
```

Expected: All 42 tests pass (no changes to model/controller).

### Playwright Tests (Optional for this story)

```bash
./test.sh
```

Expected: All 32 Playwright tests pass. These tests will continue to use the existing `server/` entry point for now. In Story 2.5, we'll verify they work with `cmd/web/` as well.

---

## Definition of Done

- [ ] `cmd/web/main.go` created with HTTP server code
- [ ] Default port changed to 8080
- [ ] Log message updated to "web mode server"
- [ ] Static file paths updated to `../../frontend/`
- [ ] All existing API routes preserved
- [ ] All handler functions copied from `server/main.go`
- [ ] Server starts successfully: `go run ./cmd/web`
- [ ] Browser loads spreadsheet at http://localhost:8080
- [ ] Sample data displays correctly
- [ ] Cell editing works
- [ ] File operations work (save/load)
- [ ] `go test ./tests/... -v` passes (all 42 tests)
- [ ] Story marked as "done" in sprint-status.yaml

---

## Notes for Developer

### Why Keep server/main.go?

We're not deleting `server/main.go` yet because:
1. Playwright tests currently use it (port 3000)
2. It's a safety fallback during migration
3. We'll deprecate it in Story 2.5 after verifying everything works

### Why Port 8080?

Port 8080 is the standard HTTP alternative port and is commonly used for web applications. Port 3000 was arbitrary. Using 8080 makes the web mode more recognizable as the "standard" HTTP server.

### Why ../../frontend/?

The directory structure is:
```
gosheet/
├── cmd/
│   └── web/
│       └── main.go  (we are here)
└── frontend/
    └── index.html   (we want to serve this)
```

From `cmd/web/main.go`, we need to go up two levels (`../../`) to reach the project root, then into `frontend/`.

### Future Refactoring (Story 2.2)

In Story 2.2, we'll:
- Create `cmd/web/api_http.go` with HttpAPI struct
- Wrap controller methods with the unified API
- Replace direct controller calls with API calls
- Return Response structs instead of raw JSON

For now, we're just moving the server to the correct location.

---

## Related Stories

**Previous Story:** 1.4 - Define FileService Interface (Epic 1 completed)  
**Next Story:** 2.2 - Implement HttpAPI Wrapper  
**Epic Goal:** Preserve existing web mode functionality with new architecture  
**Architecture Reference:** Section "Package-Based Separation" in architecture.md

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** Created `cmd/web/main.go` from `server/main.go` with all required changes. Default port 8080, log message "web mode server", all 11 API routes preserved. Static file path uses `frontend/` (relative to project root) because `go run ./cmd/web` runs with CWD=project root; `../../frontend/` would only work when CWD=cmd/web.  
**Challenges Encountered:** None.  
**Learnings for Next Story:** The web server runs successfully from project root. Story 2.2 will refactor handlers into HttpAPI wrapper.
