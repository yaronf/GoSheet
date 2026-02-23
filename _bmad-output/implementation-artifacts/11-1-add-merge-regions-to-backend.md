# Story 11.1: Add Merge Regions to Backend Model and File Format

**Epic:** 11 - Cell Merging  
**Story:** 11.1  
**Estimated Effort:** 4-6 hours  
**Status:** backlog  
**Created:** 2026-02-23

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
- Spreadsheet model has `Cells map[int]map[int]*Cell` only
- File format (gob) serializes cells only; version 1.0

**Desired State:**
- MergeRegion struct and Spreadsheet.Merges field
- File format v1.1 with Merges; backward compatible load for v1.0

---

## Acceptance Criteria

1. **MergeRegion struct**
   - [ ] `MergeRegion` has `StartRow`, `StartCol`, `RowSpan`, `ColSpan` (all int)
   - [ ] Anchor is (StartRow, StartCol); covered cells are StartRow..StartRow+RowSpan-1, StartCol..StartCol+ColSpan-1

2. **Spreadsheet model**
   - [ ] `Spreadsheet` has `Merges []MergeRegion` field
   - [ ] `NewSpreadsheet()` initializes `Merges` as empty slice

3. **File format**
   - [ ] File header version supports `1.1` (or similar)
   - [ ] Save encodes `Merges` after cells
   - [ ] Load decodes `Merges`; v1.0 files load with empty Merges
   - [ ] `SaveToFile`, `LoadFromFile`, `SaveToBytes`, `LoadFromBytes` updated

4. **Tests**
   - [ ] Go unit tests pass
   - [ ] Add tests for save/load with merge regions
   - [ ] Add tests for v1.0 backward compatibility

---

## Technical Requirements

### Model Changes

```go
type MergeRegion struct {
    StartRow, StartCol int
    RowSpan, ColSpan   int
}

type Spreadsheet struct {
    Cells   map[int]map[int]*Cell
    Merges  []MergeRegion  // NEW
    // ...
}
```

### File Format

- Version `1.0`: header + cells only
- Version `1.1`: header + cells + merges (optional field for compat)

---

## Dev Notes

### References

- [Source: _bmad-output/planning-artifacts/research/technical-cell-merging-research-2026-02-23.md]
- [Source: model/spreadsheet.go]
- [Source: model/file.go]
