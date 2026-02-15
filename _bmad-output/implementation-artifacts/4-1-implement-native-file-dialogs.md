# Story 4.1: Implement Native File Dialogs

**Epic:** 4 - Native File Operations  
**Story ID:** 4.1  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** user  
**I want** to use native macOS file dialogs  
**So that** I can choose where to save and open my spreadsheet files

---

## Business Context

This story implements the native file dialog functionality that enables users to select file paths for opening and saving .sheet files. The WailsFileService stub (Story 3.5) currently returns empty strings for both dialogs. This story replaces those stubs with real Wails v3 dialog calls that display native macOS UI.

**Why this matters:** Native file dialogs are a core requirement (FR3, NFR-U3) for the native app experience. Without them, users cannot choose where to save files or which files to open. This is the first step in Epic 4's native file operations.

**Previous Context:**
- Story 3.5 created WailsFileService stub with placeholder OpenFileDialog and SaveFileDialog
- The FileService interface (Story 1.4) defines the contract
- Wails v3 provides `app.Dialog.OpenFile()` and `app.Dialog.SaveFile()` with chainable configuration

---

## Acceptance Criteria

**Given** the WailsFileService stub exists  
**When** I implement `OpenFileDialog` in `cmd/native/fileservice_wails.go`  
**Then** it calls `wails.OpenFileDialog()` with filters for .sheet files  
**And** it returns the selected file path or error if cancelled  
**When** I implement `SaveFileDialog`  
**Then** it calls `wails.SaveFileDialog()` with default name and .sheet extension  
**And** it returns the selected file path or error if cancelled  
**And** both dialogs use native macOS UI (not browser-based) (FR3, NFR-U3)  
**And** dialogs respect macOS file system permissions (NFR-S2)

---

## Technical Approach

### Wails v3 Dialog API

Wails v3 uses a chainable dialog API via `app.Dialog`:

**OpenFileDialog:**
```go
path, err := app.Dialog.OpenFile().
    AddFilter("GoSheet", "*.sheet").
    PromptForSingleSelection()
// path = selected path, empty if cancelled
// err = nil when cancelled (empty path), non-nil on dialog failure
```

**SaveFileDialog:**
```go
path, err := app.Dialog.SaveFile().
    AddFilter("GoSheet", "*.sheet").
    SetFilename(defaultName).
    PromptForSingleSelection()
// path = selected path, empty if cancelled
// err = nil when cancelled (empty path), non-nil on dialog failure
```

### WailsFileService Changes

The current WailsFileService stub has no app reference. To call dialogs, it needs access to the application:

1. **Add app reference to WailsFileService:**
   ```go
   type WailsFileService struct {
       app *application.App
   }
   ```

2. **Update constructor:**
   ```go
   func NewWailsFileService(app *application.App) *WailsFileService {
       return &WailsFileService{app: app}
   }
   ```

3. **Implement OpenFileDialog:** Use `app.Dialog.OpenFile()` with `.sheet` filter, call `PromptForSingleSelection()`, return (path, err). When user cancels, Wails typically returns ("", nil).

4. **Implement SaveFileDialog:** Use `app.Dialog.SaveFile()` with `.sheet` filter and `SetFilename(defaultName)`, call `PromptForSingleSelection()`, return (path, err).

### File Location Note

The architecture specifies `cmd/native/fileservice_wails.go`. The current codebase has `fileservice_wails.go` at project root (created in Story 3.5). Implement in the existing file location unless the project has been restructured.

---

## Implementation Checklist

- [x] Add `app *application.App` field to WailsFileService struct
- [x] Update `NewWailsFileService` to accept and store app reference
- [x] Implement `OpenFileDialog`: call `app.Dialog.OpenFile().AddFilter("GoSheet", "*.sheet").PromptForSingleSelection()`
- [x] Implement `SaveFileDialog`: call `app.Dialog.SaveFile().AddFilter("GoSheet", "*.sheet").SetFilename(defaultName).PromptForSingleSelection()`
- [x] Ensure empty path + nil error when user cancels (per FileService interface)
- [x] Wire WailsFileService into main.go if not already (pass app to constructor)
- [x] Remove TODO comments for OpenFileDialog and SaveFileDialog
- [x] Verify `go build` succeeds
- [x] Verify native app launches and dialogs appear when triggered

---

## Testing Requirements

### Manual Testing

1. **Open File Dialog:**
   - Launch native app: `wails3 dev` or `wails3 build` + run
   - Trigger Open File (via future Story 4.4 or temporary test button)
   - Verify native macOS Open dialog appears
   - Verify filter shows .sheet files
   - Select a file → verify path is returned
   - Cancel dialog → verify empty path, no error

2. **Save File Dialog:**
   - Trigger Save File (via future Story 4.5 or temporary test button)
   - Verify native macOS Save dialog appears
   - Verify default filename "Untitled.sheet" (or passed defaultName)
   - Verify filter shows .sheet extension
   - Choose location and save → verify path is returned
   - Cancel dialog → verify empty path, no error

3. **Permissions:**
   - Verify dialogs respect macOS sandbox/permissions (e.g., cannot access restricted directories without user consent)

### Unit Tests

No new unit tests required for this story. Dialog behavior is inherently UI-driven and best verified manually. Story 4.2 (Direct File I/O) will add tests for ReadFile/WriteFile.

### Build Verification

```bash
wails3 build
# or
go build -o GoSheet .
```

Expected: Successful build with no errors.

---

## Definition of Done

- [ ] WailsFileService holds app reference
- [ ] OpenFileDialog calls Wails Dialog API with .sheet filter
- [ ] SaveFileDialog calls Wails Dialog API with .sheet filter and default filename
- [ ] Both methods return (path, err) per FileService interface
- [ ] User cancel returns ("", nil)
- [ ] Native macOS dialogs display (not browser-based)
- [ ] `wails3 build` or `go build` succeeds
- [ ] Story marked as "done" in sprint-status.yaml

---

## Notes for Developer

### Why App Reference?

Wails dialogs are invoked via `app.Dialog.OpenFile()` and `app.Dialog.SaveFile()`. The DialogManager is part of the App struct. WailsFileService must hold an app reference to access it.

### Cancel vs Error Semantics

Per api/fileservice.go: "path: Absolute file path selected by user (empty if cancelled), err: Error if dialog fails (nil if cancelled by user)". User cancel is NOT an error—return ("", nil). Only return non-nil error when the dialog itself fails (e.g., system error).

### Default Filename for Save

The FileService interface passes `defaultName` (e.g., "Untitled.sheet"). Use `SetFilename(defaultName)` so the save dialog suggests a sensible default. Ensure .sheet extension is included in the default.

### Integration with WailsAPI

WailsAPI.LoadFile and WailsAPI.SaveFile currently take path as a parameter. Story 4.4 and 4.5 will wire the flow: user triggers Open → call FileService.OpenFileDialog() → get path → call LoadFile(path). This story only implements the dialog methods; wiring happens in later stories.

---

## Related Stories

**Previous Story:** 3.7 - Verify Native App Launches and Displays Grid  
**Next Story:** 4.2 - Implement Direct File I/O  
**Epic Goal:** Users can create, open, save, and manage .sheet files using native macOS dialogs  
**Architecture Reference:** Decision 2 (File Dialog Strategy) in architecture.md

---

## Story Completion Notes

**Implemented:** 2026-02-15

- Added `app *application.App` field to WailsFileService struct
- Updated `NewWailsFileService(app *application.App)` to accept and store app reference
- Implemented `OpenFileDialog`: uses `app.Dialog.OpenFile().AddFilter("GoSheet", "*.sheet").PromptForSingleSelection()`
- Implemented `SaveFileDialog`: uses `app.Dialog.SaveFile().AddFilter("GoSheet", "*.sheet").SetFilename(defaultName).PromptForSingleSelection()`
- User cancel returns ("", nil) per FileService interface (Wails returns empty path with nil error)
- Wired WailsFileService via `app.RegisterService(application.NewService(NewWailsFileService(app)))` in main.go
- Build verified: `go build -o build/GoSheet .` succeeds
