# Story 2.3: Implement Web Mode FileService

**Epic:** 2 - Web Mode Preservation  
**Story ID:** 2.3  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** a web mode FileService that implements the api.FileService interface  
**So that** file operations are abstracted for future native mode integration

---

## Business Context

This story creates the web mode implementation of the `FileService` interface defined in Epic 1 (Story 1.4). The FileService abstracts file dialogs and I/O to support both web mode (browser upload/download) and native mode (Wails dialogs with direct disk access).

In web mode:
- **OpenFileDialog**: Not applicable—file selection happens via browser file input; the backend receives files through `/api/file/upload`
- **SaveFileDialog**: Not applicable—save triggers browser download via `/api/file/download`
- **ReadFile**: Reads from temp storage (files uploaded via browser)
- **WriteFile**: Writes to temp storage for download

**Why this matters:** The dual-mode architecture requires both web and native modes to implement the same interfaces. This story delivers the web mode FileService, enabling future refactoring of the controller to use FileService for file operations.

**Previous Context:**
- Story 1.4 defined the `FileService` interface with OpenFileDialog, SaveFileDialog, ReadFile, WriteFile
- Story 2.1 created cmd/web/main.go with handleUploadFile and handleDownloadFile
- Story 2.2 created HttpAPI for SpreadsheetAPI

---

## Acceptance Criteria

**Given** the FileService interface is defined and upload/download handlers exist in main.go  
**When** I create `cmd/web/fileservice_http.go`  
**Then** it defines a struct that implements `api.FileService` interface  
**And** OpenFileDialog returns an error in web mode (file selection is via browser upload)  
**And** SaveFileDialog returns an error in web mode (save is via browser download)  
**And** ReadFile uses os.ReadFile for paths (e.g., /tmp/gosheet_upload.gosheet)  
**And** WriteFile uses os.WriteFile for paths (e.g., /tmp/gosheet_download.gosheet)  
**And** the implementation aligns with existing upload/download handler logic  
**And** `go build ./cmd/web` succeeds

---

## Technical Requirements

### FileService Interface (from api/fileservice.go)

```go
type FileService interface {
    OpenFileDialog(filters []string) (path string, err error)
    SaveFileDialog(defaultName string) (path string, err error)
    ReadFile(path string) ([]byte, error)
    WriteFile(path string, data []byte) error
}
```

### Web Mode Behavior

| Method | Web Mode Implementation |
|--------|-------------------------|
| OpenFileDialog | Return ("", err) - file selection is via /api/file/upload |
| SaveFileDialog | Return ("", err) - save is via /api/file/download |
| ReadFile | os.ReadFile(path) - reads from temp storage |
| WriteFile | os.WriteFile(path, data, 0644) - writes to temp storage |

### Integration with Existing Handlers

The upload handler (handleUploadFile) writes to `/tmp/gosheet_upload.gosheet` and calls ctrl.LoadFile.  
The download handler (handleDownloadFile) calls ctrl.SaveFile to `/tmp/gosheet_download.gosheet` and serves it.

The FileService ReadFile/WriteFile provide the low-level I/O that could be used by future refactored code. The controller currently uses model.LoadFromFile/SaveToFile directly.

---

## Implementation Guide

### Step 1: Create HttpFileService struct

```go
package main

import (
    "errors"
    "os"

    "gosheet/api"
)

// ErrWebModeNoDialog indicates that file dialogs are not supported in web mode.
var ErrWebModeNoDialog = errors.New("file dialogs not supported in web mode; use /api/file/upload and /api/file/download")

// HttpFileService implements api.FileService for web mode.
type HttpFileService struct{}

// NewHttpFileService creates a FileService for web mode.
func NewHttpFileService() *HttpFileService {
    return &HttpFileService{}
}

// Compile-time check
var _ api.FileService = (*HttpFileService)(nil)
```

### Step 2: Implement OpenFileDialog and SaveFileDialog

Return error for both—web mode uses browser upload/download, not server-side dialogs.

### Step 3: Implement ReadFile and WriteFile

Use os.ReadFile and os.WriteFile. These support paths used by the upload/download handlers.

---

## Definition of Done

- [x] `cmd/web/fileservice_http.go` created
- [x] Implements all 4 FileService methods
- [x] OpenFileDialog and SaveFileDialog return ErrWebModeNoDialog
- [x] ReadFile and WriteFile use os package
- [x] `go build ./cmd/web` succeeds
- [x] Story marked "done" in sprint-status.yaml

---

## Related Stories

**Previous Story:** 2.2 - Implement HttpAPI Wrapper  
**Next Story:** 2.4 - Update Frontend for Unified API  
**Epic Goal:** Preserve web mode with unified API layer

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** Created `cmd/web/fileservice_http.go` with HttpFileService implementing api.FileService. OpenFileDialog and SaveFileDialog return ErrWebModeNoDialog since web mode uses /api/file/upload and /api/file/download. ReadFile and WriteFile delegate to os.ReadFile and os.WriteFile for temp file I/O.  
**Challenges Encountered:** None.  
**Learnings for Next Story:** FileService is ready for use when controller is refactored in Epic 4.
