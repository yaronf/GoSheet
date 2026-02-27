# Story 11.2: Add Merge API Endpoints

**Epic:** 11 - Cell Merging  
**Story:** 11.2  
**Estimated Effort:** 2-3 hours  
**Status:** done  
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
   - [x] `GET /api/merges` returns all merge regions
   - [x] Response: `{ success: true, data: { merges: [{startRow, startCol, rowSpan, colSpan}, ...] } }`
   - [x] Empty array when no merges

2. **SetMerge**
   - [x] `POST /api/merge` accepts `{startRow, startCol, rowSpan, colSpan}`
   - [x] Creates merge region; returns success or error
   - [x] Validates no overlapping regions
   - [x] Validates range within grid bounds (startRow/startCol >= 0, rowSpan/colSpan >= 1)
   - [x] Sets Modified = true

3. **Unmerge**
   - [x] `POST /api/unmerge` accepts `{startRow, startCol}` (anchor)
   - [x] Removes merge containing that anchor
   - [x] Returns error if (startRow, startCol) is not an anchor
   - [x] Sets Modified = true

4. **Integration**
   - [x] Endpoints follow existing patterns (HandleGetCellValue, HandleSetCellValue)
   - [x] Add to server/main.go, api-client.js, api-types.d.ts
   - [x] OpenAPI schema updated (optional but recommended)

---

## Tasks / Subtasks

- [x] Task 1: Controller merge methods (AC: 1, 2, 3)
  - [x] Add `GetMerges() []MergeRegion` to controller (reads Sheet.Merges)
  - [x] Add `SetMerge(startRow, startCol, rowSpan, colSpan) error` — validate, append to Merges, set Modified
  - [x] Add `Unmerge(startRow, startCol) error` — find and remove merge containing anchor
  - [x] Validation: no overlap with existing merges; bounds check

- [x] Task 2: API handlers (AC: 1, 2, 3)
  - [x] HandleGetMerges: GET /api/merges → JSON { merges: [...] }
  - [x] HandleSetMerge: POST /api/merge, decode body, call SetMerge
  - [x] HandleUnmerge: POST /api/unmerge, decode body, call Unmerge
  - [x] Register in server/main.go

- [x] Task 3: Frontend API client (AC: 4)
  - [x] Add getMerges(), setMerge(), unmerge() to api-client.js
  - [x] Add types to api-types.d.ts if using TypeScript/typed API

- [x] Task 4: Tests
  - [x] Add api/handlers_test.go tests for merge endpoints
  - [x] Add controller tests for SetMerge/Unmerge validation
  - [x] Go unit tests pass (user runs manually)

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

Cursor Composer

### Completion Notes List

- **2026-02-25 DS:** Implemented GetMerges, SetMerge, Unmerge in controller; HandleGetMerges, HandleSetMerge, HandleUnmerge in api; registered routes; added getMerges, setMerge, unmerge to frontend api-client.js; OpenAPI schema; controller and handler tests.

### File List

- controller/app.go (GetMerges, SetMerge, Unmerge, rectanglesOverlap)
- api/handlers.go (HandleGetMerges, HandleSetMerge, HandleUnmerge)
- api/handlers_test.go (TestHandleGetMerges, TestHandleSetMerge, TestHandleUnmerge)
- controller/controller_test.go (TestControllerGetMerges, TestControllerSetMerge, TestControllerUnmerge)
- server/main.go (merge route registration)
- frontend/api-client.js (GetMerges, SetMerge, Unmerge)
- api/openapi.yaml (merge paths and schemas)
- api/generated/types.go (regenerated)
- frontend/api-types.d.ts (regenerated)

---

## Senior Developer Review (AI)

**Date:** 2026-02-26  
**Outcome:** Approve

**Review summary:** Implementation verified. Controller methods with overlap validation, API handlers following existing patterns, routes registered, frontend client and OpenAPI schema complete. Go tests in handlers_test.go and controller_test.go cover merge endpoints.
