# Story 4.3: Implement New Spreadsheet

**Epic:** 4 - Native File Operations  
**Story ID:** 4.3  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** user  
**I want** to create a new empty spreadsheet  
**So that** I can start working with fresh data

---

## Business Context

This story implements the New Spreadsheet functionality in the native app. When triggered, it clears all cells, resets file status to "Untitled - Unsaved", clears the file path, and sets modified=false. The WailsAPI already has NewSpreadsheet() calling ctrl.NewFile(); this story ensures it properly resets all state.

**Why this matters:** Users need to start fresh without remnants of previous data (FR1). Accurate file status is critical (FR5).

---

## Acceptance Criteria

**Given** the native app is running  
**When** I trigger New Spreadsheet  
**Then** the current spreadsheet is cleared (all cells deleted)  
**And** the file status shows "Untitled - Unsaved" (FR5)  
**And** the file path is empty (no file associated yet)  
**And** the modified flag is false (new spreadsheet is not modified)

---

## Technical Approach

- WailsAPI.NewSpreadsheet() calls ctrl.NewFile()
- controller.NewFile() replaces Sheet with model.NewSpreadsheet() which has empty Cells, Modified=false, FilePath=""
- Return api.NewSuccessResponse(nil)

---

## Implementation Checklist

- [x] Verify NewSpreadsheet() clears all cells via ctrl.NewFile()
- [x] Verify file status resets (path="", modified=false)
- [x] Return api.Response with success
- [x] Build: `go build -o build/GoSheet .`

---

## Story Completion Notes

**Implemented:** 2026-02-15

- NewSpreadsheet() calls ctrl.NewFile() which clears all cells, resets FilePath="", Modified=false
- Added unsaved changes dialog (Story 4.8) - if HasUnsavedChanges, shows Save/Don't Save/Cancel before proceeding
- Build verified: `go build -o build/GoSheet .` succeeds
