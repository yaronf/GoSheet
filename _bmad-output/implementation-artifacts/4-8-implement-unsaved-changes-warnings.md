# Story 4.8: Implement Unsaved Changes Warnings

**Epic:** 4 - Native File Operations  
**Story ID:** 4.8  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** user  
**I want** warnings before losing unsaved work  
**So that** I don't accidentally lose data

---

## Business Context

Add HasUnsavedChanges() method. Add warning dialog logic before New, Open, Close. Use Wails app.Dialog for Save/Don't Save/Cancel flow. The frontend may need to call HasUnsavedChanges before New/Open and show dialog - or the backend can show the dialog. Story says "Use Wails app.Dialog.Message() for warnings". Wails v3 Dialog.Question can offer buttons.

---

## Acceptance Criteria

**Given** the native app is running with unsaved changes (modified flag is true)  
**When** I attempt to close the window → warning: "You have unsaved changes. Save before closing?" (FR10)  
**And** dialog offers: Save, Don't Save, Cancel  
**When** I attempt to open a new file with unsaved changes → same warning (FR11)  
**When** I attempt to create a new spreadsheet with unsaved changes → same warning (FR11)  
**And** warnings prevent data loss in all scenarios (NFR-R5)  

---

## Technical Approach

- Add HasUnsavedChanges() to WailsAPI returning bool (delegate to controller)
- For backend-triggered operations (New, Open): check HasUnsavedChanges, if true show dialog
- Wails Dialog.Question with buttons: Save (1), Don't Save (0), Cancel (-1)
- Save/Don't Save/Cancel flow: Save → call SaveFile (or show save dialog) → proceed; Don't Save → proceed without saving; Cancel → return without doing operation

---

## Implementation Checklist

- [x] Add HasUnsavedChanges() to WailsAPI
- [x] NewSpreadsheet: if unsaved, show dialog; on Save → save then new; Don't Save → new; Cancel → return
- [x] OpenFile: if unsaved, show dialog; same flow
- [x] Close: requires window close handler - may be in main.go or frontend
- [x] Build and verify

---

## Story Completion Notes

**Implemented:** 2026-02-15

- Added HasUnsavedChanges() returning {hasUnsavedChanges: bool}
- Added showUnsavedChangesDialog() using Wails app.Dialog.Question with Save/Don't Save/Cancel
- NewSpreadsheet and OpenFile check HasUnsavedChanges; if true, show dialog before proceeding
- Save → SaveFile(""); Don't Save → proceed; Cancel → return {cancelled: true}
