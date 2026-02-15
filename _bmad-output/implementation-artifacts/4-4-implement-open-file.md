# Story 4.4: Implement Open File

**Epic:** 4 - Native File Operations  
**Story ID:** 4.4  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** user  
**I want** to open existing .sheet files from disk  
**So that** I can resume work on saved spreadsheets

---

## Business Context

This story adds OpenFile() to WailsAPI that shows the native Open dialog, reads the file via FileService.ReadFile, deserializes using model, and rebuilds the dependency graph. Handles FILE_NOT_FOUND and FILE_READ_ERROR.

---

## Acceptance Criteria

**Given** the native app is running and file dialogs are implemented  
**When** I trigger Open File  
**Then** a native macOS Open dialog appears (FR2, NFR-U3)  
**And** the dialog filters for .sheet files  
**When** I select a file and click Open  
**Then** the file is loaded using FileService.ReadFile  
**And** the spreadsheet data is deserialized (model)  
**And** the dependency graph is rebuilt from formulas  
**And** the file status shows "Saved: <full file path>" (FR5)  
**And** the modified flag is false  
**And** if the file doesn't exist, an error shows with FILE_NOT_FOUND code  
**And** if the file can't be read, an error shows with FILE_READ_ERROR code  

---

## Technical Approach

- Add OpenFile() to WailsAPI (no path param - uses dialog)
- WailsAPI needs FileService reference - inject via constructor
- Flow: OpenFileDialog() → if path empty return success (cancelled) → ReadFile(path) → model.LoadFromBytes(data, path) → ctrl.Sheet = sheet, rebuild deps
- Add model.LoadFromBytes(data []byte, path string) for deserialization from bytes

---

## Implementation Checklist

- [x] Add FileService to WailsAPI, update NewWailsAPI
- [x] Add model.LoadFromBytes for deserialization
- [x] Implement OpenFile() with dialog, ReadFile, deserialize, rebuild deps
- [x] Handle FILE_NOT_FOUND, FILE_READ_ERROR, PARSE_ERROR
- [x] Build and verify

---

## Story Completion Notes

**Implemented:** 2026-02-15

- Added OpenFile() to WailsAPI: OpenFileDialog → ReadFile → model.LoadFromBytes → controller.LoadFromBytes
- Added model.LoadFromBytes and controller.LoadFromBytes for deserialization from FileService
- Handles FILE_NOT_FOUND, FILE_READ_ERROR, PARSE_ERROR
- Unsaved changes dialog before opening (Story 4.8)
- Build verified
