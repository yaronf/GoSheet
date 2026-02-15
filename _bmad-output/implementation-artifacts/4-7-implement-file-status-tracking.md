# Story 4.7: Implement File Status Tracking

**Epic:** 4 - Native File Operations  
**Story ID:** 4.7  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** user  
**I want** to see accurate file status at all times  
**So that** I know if my work is saved and where the file is located

---

## Business Context

Add file status tracking fields to WailsAPI (currentFilePath, isModified). Add GetFileStatus() returning status string. Update SetCellValue to set isModified=true. Ensure New/Open/Save methods maintain status correctly. The controller already tracks via Sheet.FilePath and Sheet.Modified - WailsAPI can delegate to controller or maintain its own. Per story: add fields to WailsAPI struct.

---

## Acceptance Criteria

**Given** the native app is running  
**When** I create a new spreadsheet → file status shows "Untitled - Unsaved" (FR5)  
**When** I edit any cell → file status shows "Untitled - Unsaved*" (modified indicator), modified flag true  
**When** I open a file → file status shows "Saved: <full file path>" (FR5)  
**When** I edit any cell after opening → file status shows "<filename> - Unsaved*", modified flag true  
**When** I save the file → file status shows "Saved: <full file path>", modified flag false  
**And** the file status is accurate at all times (NFR-R2)  

---

## Technical Approach

- Add currentFilePath string, isModified bool to WailsAPI (or use controller - story says add to WailsAPI)
- GetFileStatus() returns status string: "Untitled - Unsaved", "Untitled - Unsaved*", "Saved: <path>", "<filename> - Unsaved*"
- SetCellValue sets isModified = true (or ensure controller does - Sheet.SetCell already sets Modified=true)
- New/Open/Save update currentFilePath and isModified

---

## Implementation Checklist

- [x] Add currentFilePath, isModified to WailsAPI (or sync with controller)
- [x] GetFileStatus returns formatted status string
- [x] SetCellValue sets isModified = true
- [x] New/Open/Save maintain status
- [x] Build and verify

---

## Story Completion Notes

**Implemented:** 2026-02-15

- GetFileStatus returns status string: "Untitled - Unsaved", "Untitled - Unsaved*", "Saved: <path>", "<filename> - Unsaved*"
- Added hasUnsavedChanges to response for frontend compatibility
- Controller (Sheet.FilePath, Sheet.Modified) is source of truth; SetCellValue sets Modified via model.SetCell
