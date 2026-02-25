# Story 11.1: Add Merge Regions to Backend Model and File Format

**Epic:** 11 - Cell Merging  
**Story:** 11.1  
**Estimated Effort:** 4-6 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-23  
**Last Updated:** 2026-02-25 (CS for Epic 11 — all stories)

---

## Story

As a developer,
I want the backend to store merge regions separately from cell values,
So that merged cells can persist across save/load and the file format supports the feature.

---

## Context

**Prerequisites:**
- Technical research: `research/technical-cell-merging-research-2026-02-23.md`

**Current State:**
- Spreadsheet model has `Cells map[int]map[int]*Cell` only; no merge metadata
- File format (gob) serializes header + cells only; version "1.0"
- `LoadFromFile`, `LoadFromBytes`, `SaveToFile`, `SaveToBytes` in `model/file.go`
- `FileHeader` has `Version` and `CellCount`; version check rejects non-"1.0"

**Desired State:**
- `MergeRegion` struct with `StartRow`, `StartCol`, `RowSpan`, `ColSpan`
- `Spreadsheet.Merges []MergeRegion` field
- File format v1.1: header + cells + merges
- v1.0 files load with empty Merges (backward compatible)

---

## Acceptance Criteria

1. **MergeRegion struct**
   - [ ] `MergeRegion` has `StartRow`, `StartCol`, `RowSpan`, `ColSpan` (all int)
   - [ ] Anchor is (StartRow, StartCol); covered cells are StartRow..StartRow+RowSpan-1, StartCol..StartCol+ColSpan-1

2. **Spreadsheet model**
   - [ ] `Spreadsheet` has `Merges []MergeRegion` field
   - [ ] `NewSpreadsheet()` initializes `Merges` as empty slice (or nil; empty on load)

3. **File format**
   - [ ] File header version supports "1.1" for save
   - [ ] Save encodes `Merges` after cells (when version 1.1)
   - [ ] Load decodes `Merges` for v1.1; v1.0 files load with empty Merges
   - [ ] `SaveToFile`, `LoadFromFile`, `SaveToBytes`, `LoadFromBytes` updated

4. **Tests**
   - [ ] Go unit tests pass (`go test ./model/...`)
   - [ ] Add tests for save/load with merge regions
   - [ ] Add tests for v1.0 backward compatibility (load old file → empty Merges)

---

## Tasks / Subtasks

- [ ] Task 1: Add MergeRegion and Spreadsheet.Merges (AC: 1, 2)
  - [ ] Define `MergeRegion` struct in `model/` (e.g. `model/merge.go` or in `spreadsheet.go`)
  - [ ] Add `Merges []MergeRegion` to `Spreadsheet`
  - [ ] Update `NewSpreadsheet()` to initialize `Merges` (empty slice)
  - [ ] Update `LoadFromFile` / `LoadFromBytes` to set `Merges` when constructing Spreadsheet (v1.0: empty)

- [ ] Task 2: Update file format for v1.1 (AC: 3)
  - [ ] In `SaveToFile` and `SaveToBytes`: use version "1.1", encode Merges after cells
  - [ ] In `LoadFromFile` and `LoadFromBytes`: accept "1.0" and "1.1"
  - [ ] For v1.0: decode cells only, set Merges = nil or empty
  - [ ] For v1.1: decode cells, then decode Merges

- [ ] Task 3: Add unit tests (AC: 4)
  - [ ] Test save/load round-trip with merge regions
  - [ ] Test v1.0 file loads with empty Merges (create minimal v1.0 gob, load, assert Merges empty)
  - [ ] Run `go test ./model/...` — all pass

---

## Dev Notes

### Architecture Compliance

- **model/** package: All data model changes go here. No API or frontend changes in this story.
- **File format**: Gob encoding. Do not change encoding format; only add fields. See `model/file.go`.
- **Backward compatibility**: Architecture requires existing .sheet files remain loadable. v1.0 → empty Merges.

### Technical Requirements

**MergeRegion struct** (from technical research):

```go
type MergeRegion struct {
    StartRow, StartCol int  // Anchor (top-left)
    RowSpan, ColSpan   int  // 1 = single cell (no merge)
}
```

**Spreadsheet** (add field):

```go
type Spreadsheet struct {
    Cells        map[int]map[int]*Cell
    Merges       []MergeRegion  // NEW
    Modified     bool
    FilePath     string
    Dependencies *DependencyGraph
}
```

**File format v1.1:**
- Header: `Version: "1.1"`, `CellCount`
- Block 1: cells (same as today)
- Block 2: merges (`[]MergeRegion`)

**File format v1.0:**
- Header: `Version: "1.0"`, `CellCount`
- Block 1: cells only
- Load: set `Merges = []MergeRegion{}` or nil

### File Structure

- **Modify**: `model/spreadsheet.go` (add Merges, NewSpreadsheet)
- **Modify**: `model/file.go` (SaveToFile, LoadFromFile, SaveToBytes, LoadFromBytes)
- **New** (optional): `model/merge.go` if you prefer separate file for MergeRegion
- **Modify**: `model/file_test.go` (add merge round-trip and v1.0 compat tests)

### Testing Standards

- Use `model/file_test.go` for file format tests (existing pattern: `TestSaveAndLoadWithData`, `TestLoadFromFile_InvalidVersion`)
- For v1.0 compat: create a minimal gob with version "1.0" and cells only, load via `LoadFromBytes`, assert `len(loaded.Merges) == 0`
- For merge round-trip: create Spreadsheet with Merges, SaveToBytes, LoadFromBytes, assert Merges match

### References

- [Source: _bmad-output/planning-artifacts/research/technical-cell-merging-research-2026-02-23.md] — data model, file format, semantics
- [Source: model/spreadsheet.go] — Spreadsheet struct, NewSpreadsheet
- [Source: model/file.go] — FileHeader, SaveToFile, LoadFromFile, SaveToBytes, LoadFromBytes
- [Source: model/file_test.go] — existing file format test patterns

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

### File List
