# Sprint Change Proposal: CSV Import Architecture Correction

**Date:** 2026-02-15  
**Author:** BMAD Correct Course Workflow  
**Epic:** Epic 6 - CSV Import/Export  
**Affected Stories:** 6.1, 6.2  
**Change Scope:** Minor (Documentation correction before implementation)

---

## Section 1: Issue Summary

### Problem Statement

Stories 6.1 (Implement CSV Import Dialog) and 6.2 (Implement CSV Data Import) were designed with a content-based HTTP API architecture where:
- Frontend reads CSV file content using `fs.readFileSync`
- Frontend sends entire file content via HTTP POST to backend
- Backend receives and parses the content

This architecture is **inconsistent** with existing file operations (Open, Save) implemented in Epic 4, which use a path-based architecture where:
- Frontend gets file path from Electron dialog
- Frontend sends only the path to backend
- Backend handles all file I/O directly

### Discovery Context

- **When discovered:** During story review before implementation (Story 6.1 is in ready-for-dev status)
- **Discovered by:** User feedback during story creation
- **Impact:** Low - no code has been written yet, only documentation needs correction

### Evidence

1. **Story 6.1 Dev Notes (lines 74-107):** Shows `Frontend: Read file content (fs.readFileSync)` and `POST /api/csv/parse with file content`
2. **Story 6.1 API Endpoint (lines 154-184):** Request includes `"content"` field with entire CSV
3. **Story 6.2 API Endpoint (lines 80-97):** Also uses `"content"` field
4. **Existing file operations:** Epic 4 stories use path-only approach consistently

---

## Section 2: Impact Analysis

### Epic Impact

**Epic 6: CSV Import/Export**
- **Status:** Can proceed with architectural corrections
- **Stories affected:** 6.1 (ready-for-dev), 6.2 (backlog)
- **Stories unaffected:** 6.3 (already uses correct path-based approach), 6.4 (no changes needed)
- **Timeline impact:** None - correction before implementation
- **Scope impact:** None - same functionality, better architecture

### Story Impact

**Story 6.1: Implement CSV Import Dialog**
- Architecture section needs update
- IPC flow diagram needs update
- API endpoint design needs update (`/api/csv/parse` → `/api/csv/preview`, content → path)
- Frontend implementation notes need update (remove file reading)
- Backend implementation notes need update (add file reading)

**Story 6.2: Implement CSV Data Import**
- Import flow description needs minor update
- API endpoint design needs update (content → path)
- Frontend implementation notes need update
- Backend implementation notes need update (add file reading)

### Artifact Conflicts

**PRD:** No conflicts - PRD doesn't specify implementation details  
**Architecture:** No conflicts - this is implementation-level detail  
**UI/UX:** No conflicts - user experience unchanged  
**Other artifacts:** No conflicts

### Technical Impact

**Positive impacts:**
- Maintains architectural consistency across all file operations
- Simpler implementation (no frontend file reading)
- Better separation of concerns (backend owns file I/O)
- More efficient (no large content over HTTP)
- Easier to add file size limits and validation in backend

**No negative impacts identified**

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment (Option 1)

**Approach:** Update Stories 6.1 and 6.2 documentation to use path-based architecture before implementation begins.

### Rationale

**Implementation Effort:**
- **Effort:** Minimal - only story documentation needs updating
- **Timeline:** No delay - correction before implementation
- **Risk:** Very low - clarifies architecture before coding begins

**Technical Benefits:**
- Maintains consistency with existing file operations (Open, Save)
- Simpler frontend implementation (no file reading logic)
- Better architecture (backend handles all file I/O)
- More efficient (no large payloads over HTTP)

**Team Impact:**
- Positive - provides clearer, more consistent guidance
- Prevents rework that would be needed if implemented as originally documented
- Demonstrates proactive architecture review

**Long-term Sustainability:**
- High - establishes consistent pattern for all file operations
- Easier to maintain and extend
- Better separation of concerns

**Business Value:**
- No impact - same functionality delivered
- Same timeline - correction before implementation
- Better quality - consistent architecture

### Alternatives Considered

**Option 2: Potential Rollback**
- Status: Not viable
- Reason: No code has been written yet

**Option 3: PRD MVP Review**
- Status: Not viable
- Reason: MVP is achievable with corrected architecture; no scope change needed

---

## Section 4: Detailed Change Proposals

### Change 1: Story 6.1 - Architecture Section

**File:** `_bmad-output/implementation-artifacts/6-1-implement-csv-import-dialog.md`  
**Section:** Dev Notes → Architecture (lines 73-88)

**OLD:**
```
**Frontend (Electron):**
1. Add "Import CSV" button to toolbar
2. Click triggers Electron file dialog (filter: .csv)
3. User selects CSV file
4. Frontend reads file content
5. Send to backend `/api/csv/parse` endpoint
6. Display preview modal with parsed data
7. User clicks "Import" or "Cancel"

**Backend (Go):**
1. Add CSV parsing endpoint: `POST /api/csv/parse`
2. Parse CSV using Go's `encoding/csv` package (RFC 4180 compliant)
3. Return: row count, column count, preview data (first 10 rows)
4. Handle errors: file read, malformed CSV
```

**NEW:**
```
**Frontend (Electron):**
1. Add "Import CSV" button to toolbar
2. Click triggers Electron file dialog (filter: .csv)
3. User selects CSV file → get file path
4. Send file path to backend `/api/csv/preview` endpoint
5. Display preview modal with parsed data
6. User clicks "Import" or "Cancel"

**Backend (Go):**
1. Add CSV preview endpoint: `POST /api/csv/preview`
2. Receive file path, read file directly
3. Parse CSV using Go's `encoding/csv` package (RFC 4180 compliant)
4. Return: row count, column count, preview data (first 10 rows)
5. Handle errors: file read, malformed CSV
```

**Rationale:** Consistent with existing file operations where backend handles all file I/O.

---

### Change 2: Story 6.1 - IPC Flow

**File:** `_bmad-output/implementation-artifacts/6-1-implement-csv-import-dialog.md`  
**Section:** Dev Notes → IPC Flow (lines 90-107)

**OLD:**
```
User clicks "Import CSV"
  ↓
Frontend: window.electronAPI.openCSVDialog()
  ↓
Electron: showOpenDialog({ filters: [{ name: 'CSV', extensions: ['csv'] }] })
  ↓
User selects file
  ↓
Frontend: Read file content (fs.readFileSync)
  ↓
Frontend: POST /api/csv/parse with file content
  ↓
Backend: Parse CSV, return preview
  ↓
Frontend: Show preview modal
```

**NEW:**
```
User clicks "Import CSV"
  ↓
Frontend: window.electronAPI.openCSVDialog()
  ↓
Electron: showOpenDialog({ filters: [{ name: 'CSV', extensions: ['csv'] }] })
  ↓
User selects file → returns file path
  ↓
Frontend: POST /api/csv/preview with file path
  ↓
Backend: Read file, parse CSV, return preview
  ↓
Frontend: Show preview modal
```

**Rationale:** Removes frontend file reading step. Backend receives path and handles all file I/O.

---

### Change 3: Story 6.1 - API Endpoint

**File:** `_bmad-output/implementation-artifacts/6-1-implement-csv-import-dialog.md`  
**Section:** Dev Notes → API Endpoint (lines 154-184)

**OLD:**
```
**POST /api/csv/parse**

Request:
{
  "content": "Name,Age\nJohn,30\nJane,25"
}

Response:
{
  "rows": 2,
  "cols": 2,
  "preview": [
    ["Name", "Age"],
    ["John", "30"],
    ["Jane", "25"]
  ]
}
```

**NEW:**
```
**POST /api/csv/preview**

Request:
{
  "path": "/Users/user/Documents/data.csv"
}

Response:
{
  "rows": 2,
  "cols": 2,
  "preview": [
    ["Name", "Age"],
    ["John", "30"],
    ["Jane", "25"]
  ]
}
```

**Rationale:** Endpoint receives file path instead of content. Backend reads and parses file. Renamed from `/parse` to `/preview` to better reflect its purpose.

---

### Change 4: Story 6.2 - Import Flow

**File:** `_bmad-output/implementation-artifacts/6-2-implement-csv-data-import.md`  
**Section:** Dev Notes → Import Flow (lines 69-76)

**OLD:**
```
1. **User clicks "Import" in preview modal**
2. **Check for unsaved changes** (if any, show confirmation dialog)
3. **Send import request** to backend with CSV content
4. **Backend clears spreadsheet** and imports CSV data
5. **Frontend refreshes grid** to show imported data
6. **Update file status** to "Untitled - Unsaved*"
```

**NEW:**
```
1. **User clicks "Import" in preview modal**
2. **Check for unsaved changes** (if any, show confirmation dialog)
3. **Send import request** to backend with CSV file path
4. **Backend reads file, clears spreadsheet** and imports CSV data
5. **Frontend refreshes grid** to show imported data
6. **Update file status** to "Untitled - Unsaved*"
```

**Rationale:** Backend receives file path (already available from preview step) instead of re-sending content.

---

### Change 5: Story 6.2 - API Endpoint

**File:** `_bmad-output/implementation-artifacts/6-2-implement-csv-data-import.md`  
**Section:** Dev Notes → API Endpoint (lines 78-97)

**OLD:**
```
**POST /api/csv/import**

Request:
{
  "content": "Name,Age,City\nJohn,30,NYC\nJane,25,SF"
}

Response:
{
  "success": true,
  "rows": 3,
  "cols": 3,
  "message": "Imported 3 rows, 3 columns"
}
```

**NEW:**
```
**POST /api/csv/import**

Request:
{
  "path": "/Users/user/Documents/data.csv"
}

Response:
{
  "success": true,
  "rows": 3,
  "cols": 3,
  "message": "Imported 3 rows, 3 columns"
}
```

**Rationale:** Endpoint receives file path instead of content. Backend reads file directly, consistent with preview endpoint.

---

## Section 5: Implementation Handoff

### Change Scope Classification

**Scope:** Minor - Documentation correction before implementation

### Handoff Recipients

**Primary:** Development team (Agent mode)  
**Responsibility:** Apply documented changes to Stories 6.1 and 6.2, then proceed with implementation

### Implementation Tasks

1. **Update Story 6.1 documentation:**
   - Apply Changes 1, 2, and 3 to story file
   - Update any code examples to reflect path-based approach
   - Verify consistency throughout document

2. **Update Story 6.2 documentation:**
   - Apply Changes 4 and 5 to story file
   - Update frontend/backend implementation notes
   - Verify consistency throughout document

3. **Verify Story 6.3:**
   - Confirm it already uses correct path-based approach (it does)
   - No changes needed

4. **Proceed with implementation:**
   - Story 6.1 ready for implementation with corrected architecture
   - Follow updated documentation for consistent implementation

### Success Criteria

- ✅ All 5 changes applied to story documents
- ✅ Stories 6.1 and 6.2 use path-based architecture consistently
- ✅ Architecture matches existing file operations (Open, Save)
- ✅ No functionality changes - same user experience
- ✅ Implementation proceeds without architectural confusion

### Timeline

- **Change application:** Immediate (documentation update)
- **Implementation impact:** None - correction before coding begins
- **Epic 6 timeline:** Unchanged

---

## Approval and Next Steps

**Status:** ✅ Approved and Implemented

**Implementation Complete:**
1. ✅ Applied all 5 changes to story documents
2. ✅ Stories 6.1 and 6.2 now use path-based architecture
3. ✅ Architecture consistent with existing file operations
4. ✅ Ready to proceed with Story 6.1 implementation

**Change Log:**
- 2026-02-15: Sprint Change Proposal created via Correct Course workflow
- 2026-02-15: Approved by user and implemented
