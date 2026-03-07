# Story 16.1: Atomic File Writes

Status: done

## Story

As a user,
I want my spreadsheet files written safely to disk,
So that a crash or error during save never leaves a corrupt or incomplete file.

## Acceptance Criteria

1. **Given** a user triggers Save (Cmd+S or Save As)
   **When** the file is written
   **Then** the data is first written to a temporary file in the same directory, then renamed to the target path atomically using `os.Rename`
   **And** if the write fails mid-way, the original file remains intact and unmodified

2. **Given** the save operation completes successfully
   **When** the file is inspected
   **Then** it contains all expected cell data with no truncation or corruption

3. **Given** a Go unit test simulates a write failure (e.g. write to a directory path or unwritable location)
   **When** the atomic write is attempted
   **Then** the original file is not modified
   **And** an error is returned to the caller

4. **Given** `SaveToFile` is called and succeeds
   **When** the function returns
   **Then** `s.FilePath` is updated to the target path and `s.Modified` is `false` (same behaviour as today)

5. **Given** all existing `model/file_test.go` tests
   **When** run against the new implementation
   **Then** all tests pass with no changes to test logic

## Tasks / Subtasks

- [x] Task 1: Implement `atomicWriteFile` helper in `model/file.go` (AC: 1, 2, 3)
  - [x] Create temp file in same directory as target using `os.CreateTemp(dir, ".gosheet-tmp-*")`
  - [x] Write all gob content (header, cells, merges, styles) to temp file
  - [x] `Sync()` the temp file to flush OS buffers before rename
  - [x] `Close()` temp file, then `os.Rename(tmp, target)` atomically
  - [x] If any step fails, remove the temp file (cleanup) and return the error — original file untouched

- [x] Task 2: Update `SaveToFile` to use `atomicWriteFile` (AC: 1, 4)
  - [x] Replace the current `os.Create` + `gob.NewEncoder` + `defer file.Close()` block with a call to `atomicWriteFile`
  - [x] Keep the post-save metadata update (`s.FilePath = filepath; s.Modified = false`) after a successful write
  - [x] `SaveAs` delegates to `SaveToFile`, no changes needed there

- [x] Task 3: Update `SaveToBytes` — no atomicity change needed (AC: 5)
  - [x] `SaveToBytes` writes to an in-memory buffer; no temp-file logic required
  - [x] Verify no regression: `TestLoadFromBytesAndSaveToBytes` and related tests still pass

- [x] Task 4: Add/update unit tests in `model/file_test.go` (AC: 1, 2, 3)
  - [x] `TestAtomicWrite_SuccessLeavesNoTempFile`: after a successful save, no `.gosheet-tmp-*` files remain in the target directory
  - [x] `TestAtomicWrite_FailurePreservesOriginal`: write to a target, then attempt to overwrite with a path that will fail at the write step (e.g. write to a read-only dir after creating the temp); confirm original is unchanged
  - [x] All existing file tests continue to pass unchanged

## Dev Notes

### Current Save Path (to replace)

`model/file.go:SaveToFile` (lines 17–61):
```go
file, err := os.Create(filepath)   // ← creates/truncates target directly
...
encoder := gob.NewEncoder(file)
encoder.Encode(header)
encoder.Encode(s.Cells)
encoder.Encode(s.Merges)
encoder.Encode(styles)
```
If the process crashes after `os.Create` but before all data is written, the target file is left truncated and unreadable. This is the bug being fixed.

### Atomic Write Pattern (standard Go idiom)

```go
func atomicWriteFile(targetPath string, writeContent func(f *os.File) error) error {
    dir := filepath.Dir(targetPath)
    tmp, err := os.CreateTemp(dir, ".gosheet-tmp-*")
    if err != nil {
        return fmt.Errorf("failed to create temp file: %w", err)
    }
    tmpName := tmp.Name()
    defer func() {
        // cleanup: remove temp if still present (only if we didn't rename it)
        if _, statErr := os.Stat(tmpName); statErr == nil {
            os.Remove(tmpName)
        }
    }()

    if err := writeContent(tmp); err != nil {
        tmp.Close()
        return err
    }
    if err := tmp.Sync(); err != nil {
        tmp.Close()
        return fmt.Errorf("failed to sync temp file: %w", err)
    }
    if err := tmp.Close(); err != nil {
        return fmt.Errorf("failed to close temp file: %w", err)
    }
    if err := os.Rename(tmpName, targetPath); err != nil {
        return fmt.Errorf("failed to rename temp file: %w", err)
    }
    return nil
}
```

On macOS, `os.Rename` within the same filesystem is atomic (single syscall). The temp file must be on the same filesystem as the target — using `filepath.Dir(targetPath)` as the temp directory guarantees this.

### Key Constraint: Same Filesystem

The temp file **must** be created in the same directory as the target. Using `os.TempDir()` (i.e. `/tmp`) is WRONG because `/tmp` is typically a different filesystem (tmpfs) and `os.Rename` across filesystems is not atomic on macOS/Linux. Always use `filepath.Dir(targetPath)`.

### Encoding Structure (unchanged)

`SaveToFile` encodes in this order: `FileHeader` → `Cells` → `Merges` → `Styles`. The `atomicWriteFile` helper receives this as a closure — the structure does not change.

### `SaveToBytes` is unaffected

`SaveToBytes` writes to a `bytes.Buffer` in memory (for the Electron IPC save-dialog flow). It does not write to disk and needs no changes.

### Testing — No Sleeps

Use `t.TempDir()` for all temp directories. Do not use fixed sleeps. Failure injection: write to an unwritable path (e.g. `filepath.Join(t.TempDir(), "subdir", "file.gosheet")` where `subdir` doesn't exist) to confirm no original-file corruption.

### Project Structure Notes

- Only file to change: `model/file.go`
- Test file: `model/file_test.go` (add 1–2 new tests, no existing test changes)
- No controller or frontend changes needed — `SaveToFile` signature is unchanged

### References

- Current implementation: `model/file.go:17-61` (`SaveToFile`)
- Existing tests: `model/file_test.go` (full test suite, all use `t.TempDir()`)
- Epic 16 story spec: `_bmad-output/planning-artifacts/epics.md` §Story 16.1
- Go `os.Rename` atomicity: guaranteed within same filesystem on POSIX systems

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented `atomicWriteFile` helper in `model/file.go`: creates temp file in same dir as target, writes all gob content, Sync+Close, then os.Rename atomically. Deferred cleanup removes temp on any failure.
- Updated `SaveToFile` to use `atomicWriteFile`; post-write metadata update (`FilePath`, `Modified=false`) only runs on success.
- `SaveToBytes` and `SaveAs` unchanged — no atomicity needed for in-memory buffer path.
- Added `TestAtomicWrite_SuccessLeavesNoTempFile` and `TestAtomicWrite_FailurePreservesOriginal` to `model/file_test.go`.
- All model/controller/api tests pass. No regressions.
- Code review fixes applied: H1 (close-before-remove on Sync failure), M1 (log temp file remove errors at debug level), M2 (extracted `encodeSpreadsheet` helper shared by `SaveToFile` and `SaveToBytes`), L1 (renamed `filepath` params to `filePath` to avoid shadowing `path/filepath`), L2 (clarified test comment; added `TestAtomicWrite_OverwriteExistingFile` to cover successful overwrite path).

### File List

- `model/file.go` (modified)
- `model/file_test.go` (modified)
