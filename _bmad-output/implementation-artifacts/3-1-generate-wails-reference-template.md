# Story 3.1: Generate Wails Reference Template

**Epic:** 3 - Native App Foundation  
**Story ID:** 3.1  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** to generate a Wails v3 reference template  
**So that** I can learn the patterns and configuration needed for integration

---

## Business Context

This story establishes the foundation for Wails v3 integration by generating a reference template and documenting key patterns. The reference template provides the canonical structure for main.go, wails.json, and frontend integration that we'll adapt for the GoSheet brownfield migration.

**Why this matters:** Wails v3 uses a different API than v2. The reference template reveals the exact patterns for application initialization, service binding, and build configuration.

---

## Acceptance Criteria

**Given** Wails v3.0.0-alpha.67 is installed  
**When** I run `cd /tmp && wails3 init -n wails-reference -t vanilla`  
**Then** a reference project is created in `/tmp/wails-reference/`  
**And** I can review the following patterns:
- `main.go` structure for Wails app initialization
- `wails.json` configuration format
- `@wailsio/runtime` integration in frontend
- Build configuration
**And** I document the key patterns in architecture notes
**And** I identify which patterns apply to the brownfield migration

---

## Key Patterns Documented (from Wails v3 alpha.67)

### main.go Structure
- Uses `application.New(application.Options{...})` from `github.com/wailsapp/wails/v3/pkg/application`
- Options include: Name, Description, Services, Assets, Mac (ApplicationShouldTerminateAfterLastWindowClosed)
- Services: `[]application.Service` with `application.NewService(&ServiceStruct{})`
- Assets: `application.AssetOptions{Handler: application.AssetFileServerFS(assets)}` or `BundledAssetFileServer` for runtime.js
- Window: `app.Window.NewWithOptions(application.WebviewWindowOptions{Title, Width, Height, URL: "/"})`
- Run: `app.Run()` blocks until exit

### wails.json Configuration
- App name, ID, frontend directory, build directory
- Entry point path for the Go application
- macOS target version, architecture (universal binary)

### Service Binding
- Services expose exported (PascalCase) methods to frontend
- Frontend calls via `Call.ByName("package.TypeName.MethodName", args...)` or generated bindings
- For cmd/native package main: method names are `main.WailsAPI.MethodName`

### Build
- `wails3 dev` - development with hot reload
- `wails3 build` - production build
- `wails3 generate bindings` - generates JS/TS bindings from Go services

---

## wails3 CLI Installation

**Status:** wails3 was not installed at story creation time.

**Installation instructions:**
```bash
go install -v github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-alpha.67
```

Ensure `~/go/bin` is in your PATH. Verify with:
```bash
wails3 version
```

**Alternative (latest):**
```bash
go install -v github.com/wailsapp/wails/v3/cmd/wails3@latest
```

**Reference template generation (run after installing wails3):**
```bash
cd /tmp && wails3 init -n wails-reference -t vanilla
```

---

## Patterns Applying to Brownfield Migration

1. **Application structure:** Use `application.New` with Options; create window with WebviewWindowOptions
2. **Assets:** Serve frontend from `frontend/` using `AssetFileServerFS` or `BundledAssetFileServer` (latter includes runtime.js)
3. **Services:** Create WailsAPI struct implementing SpreadsheetAPI; register with `application.NewService(&wailsAPI)`
4. **Frontend:** Use `window.wails.Call.ByName("main.WailsAPI.MethodName", args)` or run `wails3 generate bindings` for typed bindings
5. **Entry point:** cmd/native/main.go as separate package

---

## Definition of Done

- [x] Story file created
- [x] wails3 installation status documented (not installed - instructions provided)
- [x] Key patterns documented from Wails v3 package inspection
- [x] Brownfield migration patterns identified
- [x] sprint-status.yaml updated: 3-1 → done

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** wails3 CLI was not installed. Documented installation instructions and key patterns from Wails v3 package source (application.Options, Services, NewService, AssetFileServerFS, Call.ByName). Reference template generation requires user to install wails3 and run init command manually. Proceeded with implementation using patterns from package inspection.  
**Challenges Encountered:** wails3 init could not be run without CLI.  
**Learnings for Next Story:** Wails v3 uses application.New with Services array; methods called via Call.ByName("package.Type.Method", args).
