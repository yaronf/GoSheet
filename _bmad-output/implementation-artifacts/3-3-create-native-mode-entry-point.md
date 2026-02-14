# Story 3.3: Create Native Mode Entry Point

**Epic:** 3 - Native App Foundation  
**Story ID:** 3.3  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** a native mode entry point that initializes the Wails app  
**So that** the spreadsheet can run as a native macOS application

---

## Acceptance Criteria

**Given** wails.json is configured and Wails v3 dependency is added  
**When** I create the native entry point  
**Then** it initializes a Wails application with: App title "GoSheet", Window size 1200x800, Frameless false, Resizable true  
**And** it creates an instance of controller.AppController  
**And** it serves the frontend from frontend/ directory  
**And** it starts the Wails event loop  
**And** the app can be launched with `go run .` or `go build -o build/GoSheet .`

---

## Implementation

- Created main.go at project root (required for //go:embed all:frontend path)
- Uses application.New with Options: Name, Services (WailsAPI), Assets (BundledAssetFileServer)
- Window: 1200x800, Frameless false, DisableResize false
- Sample data loaded same as web mode
- Embed: all:frontend with fs.Sub for URL paths

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** Entry point at root due to Go embed restriction (paths cannot use ..). cmd/native removed; native app is main package at root.
