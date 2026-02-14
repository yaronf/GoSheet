# Story 3.2: Create Wails Configuration

**Epic:** 3 - Native App Foundation  
**Story ID:** 3.2  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** to create a wails.json configuration for the spreadsheet app  
**So that** Wails can build the native macOS application

---

## Acceptance Criteria

**Given** the reference template patterns are understood  
**When** I create `wails.json` in the project root  
**Then** it configures: App name "GoSheet", frontend directory "./frontend", build directory "./build", macOS target 11+, universal binary  
**And** `go.mod` is updated with Wails v3.0.0-alpha.67 dependency  
**And** the configuration is validated with `go mod tidy`

---

## Implementation

- Created wails.json with name, outputfilename, assetdir, builddir, mac.minimumSystemVersion 11.0, mac.universalBinary true
- Updated go.mod: added github.com/wailsapp/wails/v3 v3.0.0-alpha.67
- Ran go mod tidy

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** wails.json created. Native app entry point placed at project root (main.go) for embed path constraints - frontend must be embeddable from the main package directory.
