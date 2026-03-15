# Story 22.2: Replace gob with MessagePack Persistence

Status: done

## Story

As a developer or tool author using another language (Python, JavaScript, Rust, etc.),
I want `.sheet` files to use MessagePack encoding instead of Go's gob,
so that I can read and write GoSheet files from non-Go programs.

## Acceptance Criteria

1. **Given** a user saves a spreadsheet (Save or Save As)
   **When** the file is written to disk
   **Then** the file is MessagePack-encoded with version "2.0" in the header
   **And** the structure is: FileHeader, cells (as cellPersist map), merges, styles

2. **Given** a user opens a `.sheet` file
   **When** the file is MessagePack-encoded (v2.0)
   **Then** the spreadsheet loads correctly with all cells, merges, and styles
   **And** formula cells have ParsedFormula rebuilt from Value (same as today)

3. **Given** `SaveToBytes` or `LoadFromBytes` is called (e.g., via FileService for native dialogs)
   **When** the operation completes
   **Then** the bytes are MessagePack-encoded/decoded (not gob)

4. **Given** the `encoding/gob` import
   **When** the migration is complete
   **Then** gob is removed from `model/file.go` and `model/cell.go`

5. **Given** `atomicWriteFile` and the save path
   **When** Save is triggered
   **Then** atomic write behavior is unchanged (temp file + rename)

6. **Given** invalid or corrupt MessagePack data
   **When** `LoadFromFile` or `LoadFromBytes` is called
   **Then** a clear error is returned (no panic)

## Tasks / Subtasks

- [x] Task 1: Add MessagePack dependency (AC: 1, 2, 3)
  - [x] Run `go get github.com/vmihailenco/msgpack/v5`
  - [x] Verify dependency in `go.mod`

- [x] Task 2: Add msgpack struct tags to cellPersist (AC: 1, 2)
  - [x] In `model/cell.go`: add `msgpack` struct tags to `cellPersist` fields (or rely on default encoding; MessagePack encodes structs by field name by default)
  - [x] Remove `GobEncode` and `GobDecode` methods from `*Cell`
  - [x] Add helper to convert `map[int]map[int]*Cell` ↔ `map[int]map[int]*cellPersist` for encode/decode

- [x] Task 3: Implement MessagePack encode in model/file.go (AC: 1, 3)
  - [x] Create `encodeSpreadsheetMsgpack(w io.Writer, s *Spreadsheet, styles *StyleRegistry) error`
  - [x] Encode FileHeader with Version "2.0", CellCount
  - [x] Convert s.Cells to `map[int]map[int]*cellPersist`, encode
  - [x] Encode s.Merges, styles
  - [x] Use `msgpack.NewEncoder(w).Encode()` for each top-level value (or a single struct containing all)
  - [x] Replace `encodeSpreadsheet` (gob) usage in `SaveToFile` and `SaveToBytes` with MessagePack version

- [x] Task 4: Implement MessagePack decode in model/file.go (AC: 2, 3, 6)
  - [x] Create `decodeSpreadsheetMsgpack(r io.Reader, filePath string) (*Spreadsheet, error)`
  - [x] Decode FileHeader; validate Version == "2.0"
  - [x] Decode cells as `map[int]map[int]*cellPersist`, convert to `map[int]map[int]*Cell`
  - [x] Decode merges, styles
  - [x] Replace `decodeSpreadsheet` (gob) usage in `LoadFromFile` and `LoadFromBytes` with MessagePack version
  - [x] Remove `decodeSpreadsheet` (gob) and `encodeSpreadsheet` (gob)
  - [x] Remove `encoding/gob` import

- [x] Task 5: Rebuild ParsedFormula on load (AC: 2)
  - [x] Ensure `spreadsheet.go` post-load logic (e.g. `RebuildParsedFormulas`) still runs after MessagePack decode — verify existing flow
  - [x] ParsedFormula must remain nil in persisted data; rebuilt from Value after load

- [x] Task 6: Update tests in model/file_test.go (AC: 1, 2, 6)
  - [x] Update all tests that use gob to use MessagePack
  - [x] Tests that create gob bytes directly (e.g. `TestLoadFromBytes_InvalidVersion`, `TestLoadFromBytes_Truncated`) must be rewritten for MessagePack
  - [x] Ensure `TestSaveAndLoadWithData`, `TestSaveAndLoadWithMergeRegions`, `TestSaveAndLoadWithStyles` pass with MessagePack
  - [x] Add test for corrupt/invalid MessagePack data returning error

- [x] Task 7: Update controller and API tests (AC: 1, 2)
  - [x] `controller/controller_test.go`: `LoadFromBytes` tests use MessagePack fixtures
  - [x] `api/handlers_test.go`: upload/corrupt gob tests → MessagePack
  - [x] Run full test suite: `go test ./...`

## Dev Notes

### Encoding Structure (preserve order)

Current gob order: FileHeader → Cells → Merges → Styles. MessagePack should use the same logical structure. Options:
- **Option A:** Encode each as a separate `msgpack.Encode()` call (streaming)
- **Option B:** Define a `fileContent` struct with all fields, marshal once

Option B is simpler and ensures consistent structure. Example:

```go
type fileContentV2 struct {
    Version   string                      `msgpack:"version"`
    CellCount int                         `msgpack:"cell_count"`
    Cells     map[int]map[int]*cellPersist `msgpack:"cells"`
    Merges    []MergeRegion               `msgpack:"merges"`
    Styles    *StyleRegistry              `msgpack:"styles"`
}
```

### Cell Conversion

`*Cell` has `ParsedFormula` which must not be persisted (participle AST has unexported fields). The `cellPersist` struct already excludes it. For MessagePack:
- On encode: build `map[int]map[int]*cellPersist` from `s.Cells` by copying each Cell's persistable fields
- On decode: build `map[int]map[int]*Cell` from decoded cellPersist map; set `ParsedFormula = nil`; rebuild happens in spreadsheet post-load

### Map Key Encoding

MessagePack encodes map keys. Go's `map[int]map[int]*cellPersist` uses int keys. MessagePack/msgpack typically handles int keys. Verify `vmihailenco/msgpack` encodes `map[int]...` correctly (it should).

### atomicWriteFile

No changes. The `writeContent` callback still receives `*os.File`; we write MessagePack bytes instead of gob. Same pattern.

### MergeRegion and StyleRegistry

These structs have exported fields. MessagePack will encode them by default. Add `msgpack` tags if field names need to be stable for cross-language compatibility. For now, default encoding may suffice.

### References

- [Source: model/file.go] Current encode/decode implementation
- [Source: model/cell.go] cellPersist, GobEncode/GobDecode
- [Source: model/spreadsheet.go] RebuildParsedFormulas / post-load logic
- [Source: sprint-change-proposal-2026-03-15.md] Epic 22 scope, no backward compat
- [vmihailenco/msgpack](https://github.com/vmihailenco/msgpack) — Go MessagePack library

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Replaced gob with MessagePack (vmihailenco/msgpack/v5). File format v2.0.
- Removed GobEncode/GobDecode from Cell; use cellPersist with msgpack tags.
- fileContentV2 struct: version, cell_count, cells (cellPersist map), merges, styles.
- cellsToPersist/cellsFromPersist helpers for Cell↔cellPersist conversion.
- Removed backward compatibility (v1.1/v1.2); TestLoadFromBytes_V1_1BackwardCompat deleted.
- All model, controller, api tests pass.

### File List

- model/cell.go — removed gob, added msgpack tags to cellPersist
- model/file.go — MessagePack encode/decode, cellsToPersist/cellsFromPersist
- model/file_test.go — updated for MessagePack, removed gob
- model/formula_abs_test.go — TestMessagePackRoundTripAbsRef
- model/formula_shift_test.go — TestInvalidRefsRoundTrip via SaveToBytes/LoadFromBytes
- controller/app.go — comment update
- controller/controller_test.go — invalid data test
- api/handlers_test.go — comment updates
- docs/FILE_FORMAT.md — format spec
- README.md — gob → MessagePack
- _bmad-output/planning-artifacts/specs/TECH_SPEC.md
- docs/USER_GUIDE.md
- _bmad-output/implementation-artifacts/1-4-define-fileservice-interface.md
- go.mod, go.sum — MessagePack dependency
- _bmad-output/planning-artifacts/sprint-change-proposal-2026-03-15.md
- _bmad-output/planning-artifacts/backlog.md, epics.md
