# Story 11.2: Add Merge API Endpoints

**Epic:** 11 - Cell Merging  
**Story:** 11.2  
**Estimated Effort:** 2-3 hours  
**Status:** backlog  
**Created:** 2026-02-23

---

## Story

As a frontend developer,
I want API endpoints to get, create, and remove merge regions,
So that the UI can sync merge state with the backend.

---

## Context

**Prerequisites:**
- Story 11.1 complete (MergeRegion in model, file format)

**Current State:**
- No API for merge operations

**Desired State:**
- GET merges, POST merge, POST unmerge endpoints

---

## Acceptance Criteria

1. **GetMergeRegions**
   - [ ] `GET /api/merges` (or equivalent) returns all merge regions
   - [ ] Response format: `[{startRow, startCol, rowSpan, colSpan}, ...]`
   - [ ] Empty array when no merges

2. **SetMerge**
   - [ ] `POST /api/merge` accepts `{startRow, startCol, rowSpan, colSpan}`
   - [ ] Creates merge region; returns success or error
   - [ ] Validates no overlapping regions
   - [ ] Validates range within grid bounds
   - [ ] Sets Modified = true

3. **Unmerge**
   - [ ] `POST /api/unmerge` accepts `{startRow, startCol}` (anchor)
   - [ ] Removes merge containing that anchor
   - [ ] Returns error if (startRow, startCol) is not an anchor
   - [ ] Sets Modified = true

4. **Integration**
   - [ ] Endpoints follow existing API patterns (server/main.go)
   - [ ] IPC/Electron preload if needed for native mode

---

## Technical Requirements

### API Contract

```
GET  /api/merges     -> { merges: [{startRow, startCol, rowSpan, colSpan}] }
POST /api/merge     -> body: {startRow, startCol, rowSpan, colSpan}
POST /api/unmerge   -> body: {startRow, startCol}
```

---

## Dev Notes

### References

- [Source: server/main.go] - Existing API patterns
- [Source: model/spreadsheet.go] - Spreadsheet.Merges
