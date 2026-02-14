# Story 3.4: Implement WailsAPI with IPC Binding

**Epic:** 3 - Native App Foundation  
**Story ID:** 3.4  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** a WailsAPI implementation that exposes controller methods via IPC  
**So that** the frontend can call Go functions directly in native mode

---

## Acceptance Criteria

**Given** the native mode entry point exists and SpreadsheetAPI interface is defined  
**When** I create api_wails.go  
**Then** it defines WailsAPI struct implementing SpreadsheetAPI  
**And** it wraps controller.AppController  
**And** each API method calls the corresponding controller method and returns Response  
**And** all methods are exported (PascalCase) for Wails binding  
**And** the WailsAPI is bound via application.NewService in main.go  
**And** methods are callable from JavaScript via Call.ByName("main.WailsAPI.MethodName", args)

---

## Implementation

- Created api_wails.go at project root
- WailsAPI implements all SpreadsheetAPI methods: SetCellValue, GetCellValue, GetCellFormula, DeleteCell, GetCellRef, NewSpreadsheet, LoadFile, SaveFile, GetFileStatus, GetAllCells, ImportCSV, ExportCSV
- Mirrors HttpAPI logic from cmd/web/api_http.go
- Bound via application.NewService(wailsAPI) in main.go

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** Wails v3 uses Call.ByName with full method path "main.WailsAPI.MethodName". Frontend api-client uses WailsCall helper.
