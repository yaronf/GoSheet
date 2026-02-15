# Story 4.6: Implement Save As

**Epic:** 4 - Native File Operations  
**Story ID:** 4.6  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** user  
**I want** to save my spreadsheet with a new file name  
**So that** I can create copies or save to different locations

---

## Business Context

Add SaveAs() to WailsAPI that always shows SaveFileDialog with current filename as default. Serializes and writes file. Updates file status and path.

---

## Acceptance Criteria

**Given** the native app is running with a spreadsheet open  
**When** I trigger Save As  
**Then** a native macOS Save dialog appears (FR4, NFR-U3)  
**And** if a file path is set, the dialog suggests the current filename  
**And** if no file path is set, the dialog suggests "Untitled.sheet"  
**When** I choose a new path and click Save  
**Then** the spreadsheet is saved to the new path  
**And** the file status shows "Saved: <new file path>" (FR5)  
**And** the modified flag is set to false  
**And** subsequent saves use the new path  

---

## Technical Approach

- SaveAs() always calls SaveFileDialog with defaultName = current filename or "Untitled.sheet"
- Same serialize + WriteFile flow as SaveFile
- Update current path after save

---

## Implementation Checklist

- [x] Implement SaveAs() - always dialog, default current filename
- [x] Serialize, WriteFile, update path and modified
- [x] Build and verify

---

## Story Completion Notes

**Implemented:** 2026-02-15

- SaveAs() always calls SaveFileDialog with defaultName = current filename or "Untitled.sheet"
- Delegates to SaveFile(path) for serialize/write/update
