# Story 4.5: Implement Save File

**Epic:** 4 - Native File Operations  
**Story ID:** 4.5  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** user  
**I want** to save my spreadsheet to disk  
**So that** my work is preserved and I can trust the file status

---

## Business Context

Add SaveFile() to WailsAPI that: if no current path, shows SaveFileDialog; serializes via model; writes via FileService.WriteFile; updates file status. Handles FILE_WRITE_ERROR.

---

## Acceptance Criteria

**Given** the native app is running with a spreadsheet open  
**When** I trigger Save and a file path is already set  
**Then** the spreadsheet is serialized and written to the existing path  
**And** the file status shows "Saved: <full file path>" (FR5)  
**And** the modified flag is set to false  
**When** I trigger Save and no file path is set (new spreadsheet)  
**Then** a native macOS Save dialog appears (FR3)  
**And** the dialog suggests "Untitled.sheet" as default name  
**When** I choose a path and click Save  
**Then** the file is saved to the chosen path  
**And** if the file can't be written, an error shows with FILE_WRITE_ERROR code  

---

## Technical Approach

- SaveFile() with no path param - uses current path or dialog
- If currentFilePath empty → SaveFileDialog("Untitled.sheet")
- Serialize: add model.SaveToBytes or use existing SaveToFile with bytes.Buffer
- FileService.WriteFile(path, data)
- Update ctrl.Sheet.FilePath, ctrl.Sheet.Modified = false

---

## Implementation Checklist

- [x] Add model.SaveToBytes for serialization
- [x] Implement SaveFile() - dialog if no path, serialize, WriteFile
- [x] Handle FILE_WRITE_ERROR
- [x] Build and verify

---

## Story Completion Notes

**Implemented:** 2026-02-15

- SaveFile(path): when path=="", uses GetFilePath() or SaveFileDialog("Untitled.sheet")
- Serializes via model.SaveToBytes(), writes via FileService.WriteFile
- Updates Sheet.FilePath and Sheet.Modified=false on success
- Handles FILE_WRITE_ERROR, user cancel returns success with no-op
