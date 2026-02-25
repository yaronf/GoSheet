# Story 11.2: Add Merge API Endpoints

**Epic:** 11 - Cell Merging  
**Story:** 11.2  
**Estimated Effort:** 2-3 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-23  
**Last Updated:** 2026-02-25 (CS for Epic 11)

---

## Story

As a frontend developer,
I want API endpoints to get, create, and remove merge regions,
So that the UI can sync merge state with the backend.

---

## Context

**Prerequisites:**
- Story 11.1 complete (MergeRegion in model, file format v1.1)

**Current State:**
- No API for merge operations
- API pattern: `api/handlers.go` Server methods, `server/main.go` registers routes, `frontend/api-client.js` fetchUnified

**Desired State:**
- GET /api/merges, POST /api/merge, POST /api/unmerge
- Controller methods: GetMerges, SetMerge, Unmerge

---

## Acceptance Criteria

1. **GetMergeRegions**
   - [ ] `GET /api/merges` returns all merge regions
   - [ ] Response: `{ success: true, data: { merges: [{startRow, startCol, rowSpan, colSpan}, ...] } }`
   - [ ] Empty array when no merges

2. **SetMerge**
   - [ ] `POST /api/merge` accepts `{startRow, startCol, rowSpan, colSpan}`
   - [ ] Creates merge region; returns success or error
   - [ ] Validates no overlapping regions
   - [ ] Validates range within grid bounds (startRow/startCol >= 0, rowSpan/colSpan >= 1)
   - [ ] Sets Modified = true

3. **Unmerge**
   - [ ] `POST /api/unmerge` accepts `{startRow, startCol}` (anchor)
   - [ ] Removes merge containing that anchor
   - [ ] Returns error if (startRow, startCol) is not an anchor
   - [ ] Sets Modified = true

4. **Integration**
   - [ ] Endpoints follow existing patterns (HandleGetCellValue, HandleSetCellValue)
   - [ ] Add to server/main.go, api-client.js, api-types.d.ts
   - [ ] OpenAPI schema updated (optional but recommended)

---

## Tasks / Subtasks

- [ ] Task 1: Controller merge methods (AC: 1, 2, 3)
  - [ ] Add `GetMerges() []MergeRegion` to controller (reads Sheet.Merges)
  - [ ] Add `SetMerge(startRow, startCol, rowSpan, colSpan) error` — validate, append to Merges, set Modified
  - [ ] Add `Unmerge(startRow, startCol) error` — find and remove merge containing anchor
  - [ ] Validation: no overlap with existing merges; bounds check

- [ ] Task 2: API handlers (AC: 1, 2, 3)
  - [ ] HandleGetMerges: GET /api/merges → JSON { merges: [...] }
  - [ ] HandleSetMerge: POST /api/merge, decode body, call SetMerge
  - [ ] HandleUnmerge: POST /api/unmerge, decode body, call Unmerge
  - [ ] Register in server/main.go

- [ ] Task 3: Frontend API client (AC: 4)
  - [ ] Add getMerges(), setMerge(), unmerge() to api-client.js
  - [ ] Add types to api-types.d.ts if using TypeScript/typed API

- [ ] Task 4: Tests
  - [ ] Add api/handlers_test.go tests for merge endpoints
  - [ ] Add controller tests for SetMerge/Unmerge validation
  - [ ] Go unit tests pass

---

## Dev Notes

### Architecture Compliance

- **Controller**: Add merge methods to `controller/app.go`; controller owns Sheet
- **API**: Follow pattern of HandleGetCellValue (GET) and HandleSetCellValue (POST with JSON body)
- **Response format**: Use `{ success: true, data: {...} }` for success; `http.Error` or JSON error for failures

### File Structure

- **Modify**: `controller/app.go` — GetMerges, SetMerge, Unmerge
- **Modify**: `api/handlers.go` — HandleGetMerges, HandleSetMerge, HandleUnmerge
- **Modify**: `server/main.go` — register /api/merges, /api/merge, /api/unmerge
- **Modify**: `frontend/api-client.js` — getMerges, setMerge, unmerge
- **Modify**: `frontend/api-types.d.ts` — add merge endpoint types (if applicable)
- **Modify**: `api/openapi.yaml` — add merge paths (optional)
- **Modify**: `api/handlers_test.go` — tests for merge handlers

### Overlap Validation

- For each existing merge M, check new merge N doesn't overlap: no cell in N's range is in M's range
- Two rectangles overlap if one contains a corner of the other or vice versa

### References

- [Source: api/handlers.go] — HandleGetCellValue, HandleSetCellValue patterns
- [Source: server/main.go] — route registration
- [Source: frontend/api-client.js] — fetchUnified, getCellValue, setCellValue
- [Source: controller/app.go] — SetCellValue, GetCellValue
- [Source: research/technical-cell-merging-research-2026-02-23.md]

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

### File List
