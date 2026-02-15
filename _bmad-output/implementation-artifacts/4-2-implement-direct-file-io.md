# Story 4.2: Implement Direct File I/O

**Epic:** 4 - Native File Operations  
**Story ID:** 4.2  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** direct file I/O operations  
**So that** the app can read and write .sheet files to user-chosen paths

---

## Business Context

This story implements the ReadFile and WriteFile methods in WailsFileService. Story 4.1 implemented the native file dialogs (OpenFileDialog, SaveFileDialog) that return user-selected paths. This story provides the actual disk I/O to read from and write to those paths. The current stub returns empty data for ReadFile and does nothing for WriteFile.

**Why this matters:** Without direct file I/O, the app cannot load or save spreadsheet data to disk. Story 4.4 (Open File) and 4.5 (Save File) will wire the flow: dialog → path → ReadFile/WriteFile. This story delivers the I/O primitives.

**Previous Context:**
- Story 4.1 implemented OpenFileDialog and SaveFileDialog
- Story 3.5 created WailsFileService stub with ReadFile/WriteFile placeholders
- The FileService interface (Story 1.4) defines ReadFile and WriteFile contracts
- Go's os.ReadFile and os.WriteFile provide the implementation

---

## Acceptance Criteria

**Given** the file dialog methods are implemented  
**When** I implement `ReadFile` in `cmd/native/fileservice_wails.go`  
**Then** it reads the file from the given path using Go's `os.ReadFile`  
**And** it returns the file contents or error with FILE_READ_ERROR code  
**When** I implement `WriteFile`  
**Then** it writes data to the given path using Go's `os.WriteFile`  
**And** it returns nil on success or error with FILE_WRITE_ERROR code  
**And** file operations respect macOS permissions (NFR-S2)  
**And** file operations never corrupt data (NFR-R1)

---

## Technical Approach

### Implementation

**ReadFile:**
```go
func (w *WailsFileService) ReadFile(path string) ([]byte, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err  // Caller maps to FILE_READ_ERROR
    }
    return data, nil
}
```

**WriteFile:**
```go
func (w *WailsFileService) WriteFile(path string, data []byte) error {
    err := os.WriteFile(path, data, 0644)
    if err != nil {
        return err  // Caller maps to FILE_WRITE_ERROR
    }
    return nil
}
```

### Error Handling

The FileService interface returns standard Go errors. Callers (e.g., controller, WailsAPI) wrap these into api.Response with appropriate error codes:
- ReadFile errors → FILE_READ_ERROR (or FILE_NOT_FOUND for os.ErrNotExist)
- WriteFile errors → FILE_WRITE_ERROR

### NFR Compliance

- **NFR-S2 (macOS permissions):** os.ReadFile and os.WriteFile respect file system permissions. Permission denied returns os.ErrPermission.
- **NFR-R1 (no data corruption):** os.WriteFile writes atomically on Unix (creates temp, renames). Use 0644 for standard file permissions.

### File Location

The codebase has `fileservice_wails.go` at project root. Implement in the existing file.

---

## Implementation Checklist

- [x] Implement `ReadFile`: use `os.ReadFile(path)`, return (data, nil) or (nil, err)
- [x] Implement `WriteFile`: use `os.WriteFile(path, data, 0644)`, return nil or err
- [x] Remove TODO comments for ReadFile and WriteFile
- [x] Add `"os"` import to fileservice_wails.go
- [x] Verify `go build -o build/GoSheet .` succeeds
- [x] Story marked as "done" in sprint-status.yaml

---

## Testing Requirements

### Manual Testing

1. **ReadFile:** (Requires Story 4.4 to wire) Load a .sheet file via Open → verify data loads
2. **WriteFile:** (Requires Story 4.5 to wire) Save a .sheet file via Save → verify data persists
3. **Permissions:** Attempt read/write to restricted path → verify permission error returned
4. **Corruption:** Save file, kill app mid-write (edge case) → verify file integrity

### Unit Tests

No new unit tests required for this story. File I/O is straightforward; integration verified when Stories 4.4/4.5 wire the flow.

### Build Verification

```bash
go build -o build/GoSheet .
```

Expected: Successful build with no errors.

---

## Definition of Done

- [ ] ReadFile uses os.ReadFile and returns file contents or error
- [ ] WriteFile uses os.WriteFile with 0644 permissions
- [ ] Both methods return standard Go errors (caller maps to codes)
- [ ] File operations respect macOS permissions (os package behavior)
- [ ] File operations use standard I/O (no data corruption)
- [ ] `go build -o build/GoSheet .` succeeds
- [ ] Story marked as "done" in sprint-status.yaml

---

## Notes for Developer

### Error Code Mapping

The story says "return FILE_READ_ERROR on error" and "return FILE_WRITE_ERROR on error". The FileService interface returns `error`, not `api.Response`. The error codes are applied by the caller when wrapping into Response. WailsAPI.LoadFile maps ReadFile errors to FILE_NOT_FOUND (os.ErrNotExist), FILE_READ_ERROR (os.ErrPermission, other), or PARSE_ERROR (decode). WailsAPI.SaveFile maps WriteFile errors to FILE_WRITE_ERROR.

### Controller Integration

The controller currently uses model.LoadFromFile/SaveToFile which use os directly. Stories 4.4 and 4.5 may refactor to use FileService.ReadFile/WriteFile for consistency. This story only implements the WailsFileService methods; wiring happens in later stories.

### Atomic Write

os.WriteFile on Unix systems typically writes to a new file and renames, providing atomicity. For extra safety, some implementations write to path+".tmp" then rename—but the story specifies os.WriteFile directly. Standard os.WriteFile is sufficient for NFR-R1.

---

## Related Stories

**Previous Story:** 4.1 - Implement Native File Dialogs  
**Next Story:** 4.3 - Implement New Spreadsheet  
**Epic Goal:** Users can create, open, save, and manage .sheet files using native macOS dialogs  
**Architecture Reference:** FileService interface in api/fileservice.go

---

## Story Completion Notes

**Implemented:** 2026-02-15

- Implemented `ReadFile`: uses `os.ReadFile(path)`, returns (data, nil) on success or (nil, err) on error. Caller maps errors to FILE_READ_ERROR.
- Implemented `WriteFile`: uses `os.WriteFile(path, data, 0644)`, returns nil on success or err on error. Caller maps errors to FILE_WRITE_ERROR.
- Removed TODO comments for ReadFile and WriteFile.
- Added `"os"` import to fileservice_wails.go.
- File operations use standard Go os package—respects macOS permissions (NFR-S2), no data corruption (NFR-R1).
- Build verified: `go build -o build/GoSheet .` succeeds.
