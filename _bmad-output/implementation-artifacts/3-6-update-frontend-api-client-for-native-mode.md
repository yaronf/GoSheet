# Story 3.6: Update Frontend API Client for Native Mode

**Epic:** 3 - Native App Foundation  
**Story ID:** 3.6  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** the frontend API client to support native mode  
**So that** the same frontend code works in both native and web modes

---

## Acceptance Criteria

**Given** the WailsAPI is implemented and bound to Wails runtime  
**When** I update frontend/api-client.js  
**Then** in native mode (window.wails exists), it uses Call.ByName("main.WailsAPI.MethodName", args)  
**And** all functions return Promises that resolve to the Response object  
**And** mode detection logs which mode is active  
**And** GetCellFormula, DeleteCell, LoadFile, SaveFile wrappers added

---

## Implementation

- Added WailsCall helper: Call.ByName("main.WailsAPI." + method, ...args)
- Updated all API functions to use WailsCall in native mode
- Added console.log for mode detection
- Added GetCellFormula, DeleteCell, LoadFile, SaveFile
- Added /wails/runtime.js script to index.html for native mode

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** Wails v3 uses Call.ByName with full qualified method name. In web mode, /wails/runtime.js 404s (expected); isNativeMode stays false.
