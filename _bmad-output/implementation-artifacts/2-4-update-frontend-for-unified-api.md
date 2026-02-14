# Story 2.4: Update Frontend for Unified API

**Epic:** 2 - Web Mode Preservation  
**Story ID:** 2.4  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** the frontend to use a unified API client with mode detection  
**So that** the same frontend works in both web mode (fetch) and native mode (Wails IPC)

---

## Business Context

This story creates the `api-client.js` module that abstracts API calls behind mode detection. When `window.wails` is present, the client will use Wails IPC (Epic 3). When absent (web mode), it uses fetch to the unified HTTP API (`/api/set-cell`, `/api/get-cell`, etc.).

**Why this matters:** The dual-mode architecture requires a single frontend codebase that works in both deployment modes. The api-client provides the abstraction layer, enabling Epic 3 to add native bindings without changing app.js.

**Previous Context:**
- Story 2.2 implemented unified API routes in cmd/web
- app.js currently uses legacy routes (/api/cell/set, /api/cells/all, etc.)
- Playwright tests expect existing behavior

---

## Acceptance Criteria

**Given** the unified API routes exist in cmd/web  
**When** I create `frontend/api-client.js`  
**Then** it detects mode via `typeof window.wails !== 'undefined'`  
**And** in web mode, it uses fetch to unified routes (/api/set-cell, /api/get-cell, etc.)  
**And** it exposes the same function signatures app.js expects  
**And** response formats are adapted (unified Response → legacy-shaped objects)  
**And** app.js is updated to use api-client instead of inline fetch  
**And** existing Playwright tests pass (32 tests)  
**And** file operations (upload/download) continue to use legacy routes (no unified equivalents)

---

## Technical Requirements

### Mode Detection

```javascript
const isNativeMode = typeof window !== 'undefined' && typeof window.wails !== 'undefined';
```

### API Mapping (Web Mode)

| Function       | Unified Route        | Method | Response Adaptation                    |
|----------------|----------------------|--------|----------------------------------------|
| GetCellValue   | /api/get-cell        | GET    | Return data.computed (display value)   |
| GetCellRawValue| /api/get-cell        | GET    | Return data.value (raw/formula)        |
| SetCellValue   | /api/set-cell        | POST   | Return {hasUnsavedChanges: data?.hasUnsavedChanges} |
| GetCellRef     | (client-side)        | -      | colToLetter(col) + (row+1)             |
| GetAllCells    | /api/cells           | GET    | Convert array to {ref: computed} map   |
| GetFileStatus  | /api/status          | GET    | Return {path, hasUnsavedChanges: data.modified} |
| NewFile        | /api/new             | POST   | Return {success: true}                 |
| DownloadFile   | /api/file/download   | GET    | No change (legacy)                    |
| UploadFile     | /api/file/upload     | POST   | No change (legacy)                     |

### Response Format

Unified API returns `{success, data, error, code}`. The api-client adapts to match what app.js expects.

---

## Implementation Guide

### Step 1: Create api-client.js

- Export functions: GetCellValue, GetCellRawValue, SetCellValue, GetCellRef, GetAllCells, GetFileStatus, NewFile, DownloadFile, UploadFile
- Each checks isNativeMode; if false, uses fetch to unified API
- Handle errors (success=false) by throwing

### Step 2: Update app.js

- Remove inline API function definitions
- Add `<script src="api-client.js"></script>` before app.js in index.html
- Ensure api-client defines the same global names (or use a namespace)

### Step 3: Adapt GetAllCells

Unified /api/cells returns `data: [{row, col, value, computed}, ...]`. Convert to `{A1: "10", A2: "20", ...}` using computed for display.

---

## Definition of Done

- [x] frontend/api-client.js created with mode detection
- [x] Web mode uses unified API routes
- [x] app.js uses api-client
- [x] Playwright tests pass
- [x] Story marked "done" in sprint-status.yaml

---

## Related Stories

**Previous Story:** 2.3 - Implement Web Mode FileService  
**Next Story:** 2.5 - Verify All Tests Pass  
**Epic Goal:** Preserve web mode with unified API layer

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** Created frontend/api-client.js with window.wails detection. Web mode uses fetch to /api/set-cell, /api/get-cell, /api/get-formula, /api/cells, /api/status, /api/new. Download and Upload use legacy /api/file/download and /api/file/upload. GetAllCells converts array response to {ref: computed} map for app.js compatibility. Updated index.html to load api-client.js before app.js. Removed duplicate API definitions from app.js.  
**Challenges Encountered:** None.  
**Learnings for Next Story:** api-client ready for Epic 3 Wails bindings.
