---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
epicCount: 7
totalFRs: 51
totalNFRs: 23
totalStories: 31
status: 'complete'
validationStatus: 'passed'
readyForDevelopment: true
completedDate: '2026-02-14'
---

# spreadsheet - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for spreadsheet, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements (51 FRs)

**File Management (11 FRs):**
- FR1: Users can create a new empty spreadsheet
- FR2: Users can open existing .sheet files from disk
- FR3: Users can save spreadsheets to disk with user-chosen file path
- FR4: Users can save spreadsheets with a new file name (Save As)
- FR5: Users can see accurate file status showing saved/unsaved state and real file path
- FR6: Users can see a list of recently opened files
- FR7: Users can import CSV files into a new spreadsheet
- FR8: Users can preview CSV data before importing
- FR9: Users can export spreadsheets to CSV format
- FR10: System warns users before closing unsaved changes
- FR11: System warns users before loading a new file with unsaved changes

**Spreadsheet Core (9 FRs):**
- FR12: Users can view a grid of cells with row and column headers
- FR13: Users can select cells by clicking
- FR14: Users can navigate cells using arrow keys, Tab, and Enter
- FR15: Users can edit cell values by typing
- FR16: Users can see cell values and computed results in the grid
- FR17: Users can see the selected cell's formula in the formula bar
- FR18: Users can edit formulas in the formula bar
- FR19: Users can delete cell contents using Delete or Backspace
- FR20: System supports spreadsheets with 5,000+ cells
- FR21: System displays progress indicator for large file operations

**Formula Engine (11 FRs):**
- FR22: Users can enter formulas starting with `=`
- FR23: System evaluates arithmetic operations (+, -, *, /, %)
- FR24: System evaluates cell references (e.g., A1, B2)
- FR25: System evaluates range references (e.g., A1:A10)
- FR26: System evaluates numeric functions (SUM, AVG, MIN, MAX, COUNT)
- FR27: System evaluates string functions (CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID)
- FR28: System evaluates comparison operators (=, !=, <, >, <=, >=)
- FR29: System tracks formula dependencies and recalculates only affected cells
- FR30: System detects circular references and displays error messages
- FR31: System normalizes formulas (uppercase cell references, remove extra spaces)
- FR32: System displays error messages in cells for invalid formulas

**Data Import/Export (6 FRs):**
- FR33: Users can import CSV files containing data
- FR34: System displays clear messaging that CSV import is data-only (formulas not preserved)
- FR35: System imports CSV data into grid cells
- FR36: System marks imported data as unsaved until user saves as .sheet format
- FR37: Users can export current spreadsheet to CSV format
- FR38: System exports computed values to CSV (formulas are evaluated, not exported)

**macOS Integration (8 FRs):**
- FR39: Users can access File menu (New, Open, Save, Save As, Import CSV, Export CSV, Recent Files, Close, Quit)
- FR40: Users can access Edit menu (Cut, Copy, Paste, Select All) - Note: Undo/Redo deferred to Phase 2
- FR41: Users can access Help menu (About)
- FR42: Users can trigger actions via keyboard shortcuts (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+W, Cmd+Q, Cmd+X/C/V)
- FR43: Users can double-click .sheet files to open them in the app
- FR44: Users can see recent files in dock menu (right-click app icon)
- FR45: System displays custom icon for .sheet files in Finder
- FR46: System displays app icon in dock

**Application Lifecycle (5 FRs):**
- FR47: System launches in <1 second
- FR48: System displays welcome screen on first launch with options to create, open, or import
- FR49: System displays recent files on welcome screen
- FR50: System closes gracefully when user quits
- FR51: System supports single window (one spreadsheet at a time in MVP)

### Non-Functional Requirements (23 NFRs)

**Performance (7 NFRs):**
- NFR-P1: Application launch time shall be less than 1 second on modern macOS hardware
- NFR-P2: Empty spreadsheet grid shall display instantly (<100ms) after launch
- NFR-P3: File load operations for spreadsheets with 5,000 cells shall complete within 3 seconds
- NFR-P4: Formula recalculation for 250 dependent cells shall complete within 200ms
- NFR-P5: CSV import for 500 rows shall complete within 1 second
- NFR-P6: UI interactions (cell selection, navigation) shall feel responsive with <50ms latency
- NFR-P7: Memory usage shall remain under 200MB for typical spreadsheets (<1,000 cells)

**Reliability (7 NFRs):**
- NFR-R1: File save operations shall not corrupt or lose data under any circumstances
- NFR-R2: File status display shall accurately reflect saved/unsaved state at all times
- NFR-R3: Application shall not crash when encountering circular references or invalid formulas
- NFR-R4: Application shall gracefully handle file I/O errors with clear error messages
- NFR-R5: Unsaved changes warning shall trigger before any data loss scenario (close, quit, load)
- NFR-R6: All 42 Go unit tests shall pass before any release
- NFR-R7: All 32 Playwright UI tests shall pass in web mode before any release

**Usability (5 NFRs):**
- NFR-U1: Application shall follow macOS Human Interface Guidelines for native apps
- NFR-U2: Keyboard shortcuts shall follow macOS conventions (Cmd+S, Cmd+O, etc.)
- NFR-U3: File dialogs shall use native macOS dialogs (not custom implementations)
- NFR-U4: Error messages shall be clear and actionable for users
- NFR-U5: Application shall provide visual feedback for long operations (progress indicators)

**Maintainability (5 NFRs):**
- NFR-M1: Codebase shall support dual-mode builds (native and web) via build flags
- NFR-M2: Core business logic shall be shared between native and web modes
- NFR-M3: Playwright test infrastructure shall remain functional in web mode
- NFR-M4: Code changes shall not break existing unit or UI tests
- NFR-M5: Architecture shall support future addition of features without major refactoring

**Compatibility (4 NFRs):**
- NFR-C1: Application shall run on macOS 11 (Big Sur) and later
- NFR-C2: Application shall support both Intel and Apple Silicon architectures (Universal binary)
- NFR-C3: File format (.sheet) shall remain compatible with existing files
- NFR-C4: CSV import/export shall follow standard CSV format (RFC 4180)

**Security & Data Integrity (6 NFRs):**
- NFR-S1: Application shall not transmit any data over the network (100% local operation)
- NFR-S2: File operations shall respect macOS file system permissions
- NFR-S3: Application shall prevent infinite loops in formula evaluation (circular reference detection)
- NFR-S4: Application shall not crash due to malformed formulas or invalid input
- NFR-S5: Saved files shall not contain deleted cell data (proper data cleanup on save)
- NFR-S6: File serialization shall only include active cell data, not historical or deleted content

### Additional Requirements from Architecture

**Architectural Requirements:**
- Manual Wails v3 integration (not standard template) - Generate reference template for learning
- Unified API Layer - Create `api/` package with SpreadsheetAPI and FileService interfaces
- Structured JSON responses with error codes (CIRCULAR_REF, FILE_NOT_FOUND, etc.)
- Package-based separation - `cmd/native/` and `cmd/web/` entry points
- Mode-aware file service - Native dialogs vs browser File API
- Wails v3.0.0-alpha.67 - Specific version with macOS stability fixes
- Universal binary support - Intel + Apple Silicon
- Preserve existing test suite - All 42 Go + 32 Playwright tests must pass
- Thread-safe controller methods - Verify for concurrent IPC access
- Recent files list storage - Persist and display in welcome screen and dock

**Implementation Sequence (from Architecture):**
1. Create unified API interfaces (`api/` package)
2. Implement web mode API (wrap existing HTTP handlers)
3. Set up Wails project structure (reference template, wails.json, go.mod)
4. Implement native mode API (Wails IPC binding)
5. Update frontend for unified API (api-client.js with mode detection)
6. Implement macOS integration (menu bar, keyboard shortcuts, dock)
7. Test dual-mode functionality

### FR Coverage Map

**File Management (11 FRs):**
- FR1: Epic 4 - Create new empty spreadsheet
- FR2: Epic 4 - Open existing .sheet files
- FR3: Epic 4 - Save spreadsheets with user-chosen path
- FR4: Epic 4 - Save As with new file name
- FR5: Epic 4 - Accurate file status with real path
- FR6: Epic 6 - Recent files list
- FR7: Epic 5 - Import CSV files
- FR8: Epic 5 - Preview CSV data before importing
- FR9: Epic 5 - Export spreadsheets to CSV
- FR10: Epic 4 - Warn before closing unsaved changes
- FR11: Epic 4 - Warn before loading with unsaved changes

**Spreadsheet Core (9 FRs):**
- FR12: Epic 2, Epic 3 - View grid with row/column headers
- FR13: Epic 2, Epic 3 - Select cells by clicking
- FR14: Epic 2, Epic 3 - Navigate cells with arrow keys, Tab, Enter
- FR15: Epic 2, Epic 3 - Edit cell values by typing
- FR16: Epic 2, Epic 3 - See cell values and computed results
- FR17: Epic 2, Epic 3 - See selected cell's formula in formula bar
- FR18: Epic 2, Epic 3 - Edit formulas in formula bar
- FR19: Epic 2, Epic 3 - Delete cell contents with Delete/Backspace
- FR20: Epic 2, Epic 3 - Support 5,000+ cells
- FR21: Epic 3 - Progress indicator for large file operations

**Formula Engine (11 FRs):**
- FR22: Epic 2 - Enter formulas starting with `=`
- FR23: Epic 2 - Evaluate arithmetic operations (+, -, *, /, %)
- FR24: Epic 2 - Evaluate cell references (A1, B2)
- FR25: Epic 2 - Evaluate range references (A1:A10)
- FR26: Epic 2 - Evaluate numeric functions (SUM, AVG, MIN, MAX, COUNT)
- FR27: Epic 2 - Evaluate string functions (CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID)
- FR28: Epic 2 - Evaluate comparison operators (=, !=, <, >, <=, >=)
- FR29: Epic 2 - Track dependencies and recalculate only affected cells
- FR30: Epic 2 - Detect circular references and display errors
- FR31: Epic 2 - Normalize formulas (uppercase refs, remove spaces)
- FR32: Epic 2 - Display error messages in cells for invalid formulas

**Data Import/Export (6 FRs):**
- FR33: Epic 5 - Import CSV files containing data
- FR34: Epic 5 - Display messaging that CSV import is data-only
- FR35: Epic 5 - Import CSV data into grid cells
- FR36: Epic 5 - Mark imported data as unsaved
- FR37: Epic 5 - Export current spreadsheet to CSV
- FR38: Epic 5 - Export computed values to CSV (formulas evaluated)

**macOS Integration (8 FRs):**
- FR39: Epic 6 - File menu (New, Open, Save, Save As, Import CSV, Export CSV, Recent Files, Close, Quit)
- FR40: Epic 6 - Edit menu (Cut, Copy, Paste, Select All)
- FR41: Epic 6 - Help menu (About)
- FR42: Epic 6 - Keyboard shortcuts (Cmd+N/O/S/W/Q, Cmd+X/C/V)
- FR43: Epic 6 - Double-click .sheet files to open
- FR44: Epic 6 - Recent files in dock menu
- FR45: Epic 6 - Custom icon for .sheet files in Finder
- FR46: Epic 6 - App icon in dock

**Application Lifecycle (5 FRs):**
- FR47: Epic 3 - Launch in <1 second
- FR48: Epic 7 - Welcome screen on first launch
- FR49: Epic 7 - Display recent files on welcome screen
- FR50: Epic 7 - Close gracefully when user quits
- FR51: Epic 3 - Single window (one spreadsheet at a time)

**Non-Functional Requirements (23 NFRs):**
All NFRs are cross-cutting and verified across multiple epics:
- Performance (7 NFRs): Verified in Epics 3-7
- Reliability (7 NFRs): Verified in all epics (test preservation)
- Usability (5 NFRs): Verified in Epics 3-7
- Maintainability (5 NFRs): Verified in Epics 1-2 (dual-mode architecture)
- Compatibility (4 NFRs): Verified in Epics 3-7
- Security (6 NFRs): Verified in all epics

## Epic List

### Epic 1: Consistent Spreadsheet Actions & Error Handling
**Goal:** Establish a consistent contract for spreadsheet actions and error handling so the UI can reliably report success/failure and stay responsive.

**User Outcome:** Users see predictable behavior and clear, actionable errors when they perform spreadsheet actions (and later, the same UI can run in both web and native modes).

**FRs covered:** None directly (enabling requirement for reliable UI/API behavior)

**Architecture requirements covered:**
- Unified API Layer - Create `api/` package with SpreadsheetAPI and FileService interfaces
- Structured JSON responses with error codes (CIRCULAR_REF, FILE_NOT_FOUND, etc.)
- Package-based separation - `cmd/native/` and `cmd/web/` entry points
- Response struct with success, data, error, and code fields

**Why standalone:** Delivers a consistent action+error contract that the UI can depend on. This reduces regressions and makes subsequent epics implementable without redesigning frontend-backend interactions.

**Implementation notes:**
- Create `api/spreadsheet.go` with SpreadsheetAPI interface
- Create `api/fileservice.go` with FileService interface
- Create `api/response.go` with Response struct and error codes
- Define all API method signatures
- No implementations yet (Epic 2 and Epic 3)

---

### Epic 2: Web Mode Preservation
**Goal:** Existing web-based spreadsheet continues working with new API layer, all 74 tests pass.

**User Outcome:** Users can continue using the web version while native app is being built. Validates API design works correctly.

**FRs covered:** FR12-FR32 (Spreadsheet Core + Formula Engine - already implemented, now wrapped with new API)
- FR12-FR21: Grid display, cell selection, navigation, editing, formula bar, 5K+ cells, progress indicators
- FR22-FR32: Formulas, arithmetic, cell/range references, functions, dependencies, circular refs, normalization, errors

**Architecture requirements covered:**
- Implement web mode API (wrap existing HTTP handlers)
- Mode-aware file service (web mode with browser File API)
- Preserve existing test suite (42 Go + 32 Playwright tests)
- Thread-safe controller methods

**Why standalone:** Preserves existing functionality, validates API design, maintains test suite. Users can continue working in web mode.

**Implementation notes:**
- Create `cmd/web/main.go` (HTTP server entry point)
- Create `cmd/web/api_http.go` (HttpAPI implementation)
- Create `cmd/web/fileservice_http.go` (browser File API wrapper)
- Wrap existing controller methods with new API interfaces
- Verify all 42 Go unit tests pass
- Verify all 32 Playwright UI tests pass

---

### Epic 3: Native App Foundation
**Goal:** Native macOS app launches and displays spreadsheet grid with basic editing.

**User Outcome:** Users can launch a native .app and edit cells in a spreadsheet.

**FRs covered:** FR47, FR51, FR12-FR19, FR21
- FR47: Launch in <1 second
- FR51: Single window (one spreadsheet at a time)
- FR12-FR19: Grid display, cell selection, navigation, editing, formula bar, delete
- FR21: Progress indicator for large operations

**Architecture requirements covered:**
- Manual Wails v3 integration (generate reference template)
- Implement native mode API (Wails IPC binding)
- Update frontend for unified API (api-client.js with mode detection)
- Wails v3.0.0-alpha.67 specific version
- Universal binary support (Intel + Apple Silicon)

**Why standalone:** Delivers first native app experience - users can open app, see grid, and edit cells. Basic functionality works.

**Implementation notes:**
- Generate Wails reference template: `cd /tmp && wails3 init -n wails-reference -t vanilla`
- Create `wails.json` configuration
- Create `cmd/native/main.go` (Wails app initialization)
- Create `cmd/native/api_wails.go` (WailsAPI implementation)
- Create `cmd/native/fileservice_wails.go` (stub for now, Epic 4)
- Update `frontend/api-client.js` with mode detection
- Build and test native .app launches and displays grid

---

### Epic 4: Native File Operations
**Goal:** Users can create, open, save, and manage .sheet files using native macOS dialogs with accurate file status.

**User Outcome:** Users can trust their data is saved correctly with real file paths. Solves the core problem from the PRD.

**FRs covered:** FR1-FR5, FR10-FR11
- FR1: Create new empty spreadsheet
- FR2: Open existing .sheet files
- FR3: Save spreadsheets with user-chosen path
- FR4: Save As with new file name
- FR5: Accurate file status with real path
- FR10: Warn before closing unsaved changes
- FR11: Warn before loading with unsaved changes

**Architecture requirements covered:**
- Mode-aware file service (native mode with Wails dialogs)
- Native macOS dialogs (not browser-based)
- Direct file I/O to user-chosen paths

**Why standalone:** Complete file workflow - New, Open, Save, Save As with accurate status and warnings. Users can fully manage their files.

**Implementation notes:**
- Implement `cmd/native/fileservice_wails.go` with Wails OpenFileDialog and SaveFileDialog
- Add file status tracking in controller
- Add unsaved changes warnings before close/load/quit
- Test file operations with real file paths
- Verify file status accuracy

---

### Epic 5: CSV Import/Export
**Goal:** Users can import data from CSV files and export spreadsheets to CSV format.

**User Outcome:** Users can migrate data from other tools and share data with non-.sheet users.

**FRs covered:** FR7-FR9, FR33-FR38
- FR7: Import CSV files
- FR8: Preview CSV data before importing
- FR9: Export spreadsheets to CSV
- FR33: Import CSV files containing data
- FR34: Display messaging that CSV import is data-only
- FR35: Import CSV data into grid cells
- FR36: Mark imported data as unsaved
- FR37: Export current spreadsheet to CSV
- FR38: Export computed values (formulas evaluated)

**Architecture requirements covered:**
- CSV RFC 4180 compliance
- Data-only import (formulas not preserved)
- Computed values export (formulas evaluated)

**Why standalone:** Complete CSV workflow - import with preview, edit, export. Users can work with CSV data end-to-end.

**Implementation notes:**
- Add CSV import with preview dialog
- Add CSV export with computed values
- Add clear messaging about data-only import
- Test with 500 rows (<1s import per NFR-P5)
- Verify CSV RFC 4180 compliance

---

### Epic 6: macOS Integration & Polish
**Goal:** App feels like a native macOS application with menu bar, keyboard shortcuts, dock integration, and file associations.

**User Outcome:** Users get a polished native experience with standard macOS patterns.

**FRs covered:** FR39-FR46, FR6
- FR39: File menu (New, Open, Save, Save As, Import CSV, Export CSV, Recent Files, Close, Quit)
- FR40: Edit menu (Cut, Copy, Paste, Select All)
- FR41: Help menu (About)
- FR42: Keyboard shortcuts (Cmd+N/O/S/W/Q, Cmd+X/C/V)
- FR43: Double-click .sheet files to open
- FR44: Recent files in dock menu
- FR45: Custom icon for .sheet files in Finder
- FR46: App icon in dock
- FR6: Recent files list

**Architecture requirements covered:**
- Wails built-in APIs for macOS integration
- Recent files list storage and display
- macOS HIG compliance

**Why standalone:** Delivers complete macOS native experience on top of working file operations. Users get all standard macOS features.

**Implementation notes:**
- Implement menu bar with File, Edit, Help menus
- Bind keyboard shortcuts to menu items
- Configure file associations in wails.json (Info.plist)
- Implement dock menu with recent files
- Add app icon and custom .sheet file icon
- Implement recent files list persistence
- Test all keyboard shortcuts
- Verify macOS HIG compliance

---

### Epic 7: Welcome Screen & Lifecycle
**Goal:** Users see a welcoming first-run experience with easy access to recent files and common actions.

**User Outcome:** Users can quickly start new spreadsheets or resume work on recent files.

**FRs covered:** FR48-FR50
- FR48: Welcome screen on first launch with options to create, open, or import
- FR49: Display recent files on welcome screen
- FR50: Close gracefully when user quits

**Architecture requirements covered:**
- Welcome screen UX design
- Recent files display integration

**Why standalone:** Completes the user experience with onboarding and quick access to files. Final UX polish.

**Implementation notes:**
- Design and implement welcome screen UI
- Display recent files list on welcome screen
- Add "Create New", "Open Existing", "Import CSV" buttons
- Add quick tip about keyboard shortcuts
- Implement graceful shutdown
- Test first-run experience
- Verify recent files display correctly

---

## Epic 1: Consistent Spreadsheet Actions & Error Handling

**Goal:** Establish a consistent contract for spreadsheet actions and error handling so the UI can reliably report success/failure and stay responsive.

**User Outcome:** Users see predictable behavior and clear, actionable errors when they perform spreadsheet actions (and later, the same UI can run in both web and native modes).

**FRs covered:** None directly (enabling requirement for reliable UI/API behavior)

**Architecture requirements covered:**
- Unified API Layer - Create `api/` package with SpreadsheetAPI and FileService interfaces
- Structured JSON responses with error codes (CIRCULAR_REF, FILE_NOT_FOUND, etc.)
- Package-based separation - `cmd/native/` and `cmd/web/` entry points
- Response struct with success, data, error, and code fields

### Story 1.1: Create API Package Structure

As a developer,
I want a well-organized package structure for dual-mode architecture,
So that I can implement native and web modes independently while sharing core logic.

**Acceptance Criteria:**

**Given** the existing spreadsheet codebase
**When** I set up the new package structure
**Then** the following directories exist:
- `api/` (for shared interfaces and types)
- `cmd/native/` (for Wails v3 entry point)
- `cmd/web/` (for HTTP server entry point)
**And** existing `model/`, `controller/`, `frontend/`, `tests/`, `playwright_tests/` directories are preserved
**And** `go.mod` is updated with placeholder for Wails v3 dependency (will be added in Epic 3)
**And** `.gitignore` is updated to ignore `build/bin/` and temp files
**And** all existing 42 Go unit tests still pass

### Story 1.2: Define Response Struct with Error Codes

As a developer,
I want a standardized API response format with error codes,
So that both native and web modes return consistent, testable responses.

**Acceptance Criteria:**

**Given** the `api/` package exists
**When** I create `api/response.go`
**Then** it defines a `Response` struct with fields:
- `Success bool` (indicates operation success/failure)
- `Data interface{}` (optional data payload)
- `Error string` (optional error message)
- `Code string` (optional error code for testing)
**And** the following error codes are defined as constants:
- `CIRCULAR_REF` - Circular reference detected in formula
- `INVALID_FORMULA` - Formula parse error
- `EMPTY_CELL_REF` - Reference to empty cell
- `FILE_NOT_FOUND` - File doesn't exist
- `FILE_READ_ERROR` - Cannot read file
- `FILE_WRITE_ERROR` - Cannot write file
- `INVALID_CELL_REF` - Invalid cell reference
- `PARSE_ERROR` - General parsing error
**And** the file includes documentation comments explaining when to use each error code
**And** example usage is documented in comments

### Story 1.3: Define SpreadsheetAPI Interface

As a developer,
I want a unified SpreadsheetAPI interface,
So that native and web modes can implement the same contract for all spreadsheet operations.

**Acceptance Criteria:**

**Given** the `api/` package and Response struct exist
**When** I create `api/spreadsheet.go`
**Then** it defines a `SpreadsheetAPI` interface with the following methods (all returning `Response`):
- `SetCellValue(row, col int, value string) Response` - Set cell value or formula
- `GetCellValue(row, col int) Response` - Get cell value and computed result
- `GetCellFormula(row, col int) Response` - Get cell formula (if any)
- `DeleteCell(row, col int) Response` - Delete cell contents
- `NewSpreadsheet() Response` - Create new empty spreadsheet
- `LoadFile(path string) Response` - Load .sheet file from disk
- `SaveFile(path string) Response` - Save spreadsheet to disk
- `GetFileStatus() Response` - Get current file status (saved/unsaved, path)
- `GetAllCells() Response` - Get all non-empty cells for rendering
- `ImportCSV(path string) Response` - Import CSV file (Epic 5)
- `ExportCSV(path string) Response` - Export to CSV file (Epic 5)
**And** each method is documented with:
- Purpose and behavior
- Expected Response.Data structure
- Possible error codes
**And** the interface follows Go naming conventions (PascalCase for exported)

### Story 1.4: Define FileService Interface

As a developer,
I want a unified FileService interface,
So that native and web modes can implement file dialogs and I/O independently.

**Acceptance Criteria:**

**Given** the `api/` package and Response struct exist
**When** I create `api/fileservice.go`
**Then** it defines a `FileService` interface with the following methods:
- `OpenFileDialog(filters []string) (path string, err error)` - Show open file dialog
- `SaveFileDialog(defaultName string) (path string, err error)` - Show save file dialog
- `ReadFile(path string) ([]byte, error)` - Read file contents
- `WriteFile(path string, data []byte) error` - Write file contents
**And** each method is documented with:
- Purpose and behavior
- Parameters and return values
- Mode-specific implementation notes (native vs web)
**And** the file includes documentation explaining:
- Native mode uses Wails dialogs with real file paths
- Web mode uses browser File API with temp files for testing
**And** the interface follows Go naming conventions


---

## Epic 2: Web Mode Preservation

**Goal:** Existing web-based spreadsheet continues working with new API layer, all 74 tests pass.

**User Outcome:** Users can continue using the web version while native app is being built. Validates API design works correctly.

**FRs covered:** FR12-FR32 (Spreadsheet Core + Formula Engine - already implemented, now wrapped with new API)

**Architecture requirements covered:**
- Implement web mode API (wrap existing HTTP handlers)
- Mode-aware file service (web mode with browser File API)
- Preserve existing test suite (42 Go + 32 Playwright tests)
- Thread-safe controller methods

### Story 2.1: Create Web Mode Entry Point

As a developer,
I want a web mode entry point that initializes the HTTP server,
So that the existing web-based spreadsheet continues to work with the new architecture.

**Acceptance Criteria:**

**Given** the API interfaces are defined
**When** I create `cmd/web/main.go`
**Then** it initializes an HTTP server on port 8080
**And** it creates an instance of `controller.AppController`
**And** it serves static files from `frontend/` directory
**And** it registers an `/api/` route namespace (handler registration and implementations are added in later stories)
**And** it starts the server with graceful shutdown handling
**And** the server can be started with `go run ./cmd/web`
**And** the server logs startup message with port number

### Story 2.2: Implement HttpAPI Wrapper

As a developer,
I want an HttpAPI implementation that wraps existing controller methods,
So that the web mode uses the unified API interface.

**Acceptance Criteria:**

**Given** the web mode entry point exists and SpreadsheetAPI interface is defined
**When** I create `cmd/web/api_http.go`
**Then** it defines an `HttpAPI` struct that implements `SpreadsheetAPI` interface
**And** it wraps the existing `controller.AppController` instance
**And** each API method:
- Calls the corresponding controller method
- Converts Go errors to `Response` struct with appropriate error codes
- Returns `Response` with success=true and data on success
- Returns `Response` with success=false, error message, and error code on failure
**And** HTTP handlers are registered for each API method:
- `POST /api/set-cell` → SetCellValue
- `GET /api/get-cell` → GetCellValue
- `GET /api/get-formula` → GetCellFormula
- `DELETE /api/delete-cell` → DeleteCell
- `POST /api/new` → NewSpreadsheet
- `POST /api/load` → LoadFile
- `POST /api/save` → SaveFile
- `GET /api/status` → GetFileStatus
- `GET /api/cells` → GetAllCells
**And** all handlers return JSON responses matching the `Response` struct format
**And** error codes are correctly mapped (e.g., circular ref errors → CIRCULAR_REF code)

### Story 2.3: Implement Web Mode FileService

As a developer,
I want a web mode FileService implementation using browser File API,
So that file operations work in web mode for Playwright testing.

**Acceptance Criteria:**

**Given** the FileService interface is defined
**When** I create `cmd/web/fileservice_http.go`
**Then** it defines an `HttpFileService` struct that implements `FileService` interface
**And** `OpenFileDialog` returns an HTTP endpoint for file upload
**And** `SaveFileDialog` returns an HTTP endpoint for file download
**And** `ReadFile` reads from temp storage (uploaded files)
**And** `WriteFile` writes to temp storage (for download)
**And** HTTP handlers are registered:
- `POST /api/upload` - Handles file uploads (for Open/Import)
- `GET /api/download` - Handles file downloads (for Save/Export)
**And** temp files are cleaned up after operations
**And** the implementation maintains the existing web mode behavior for Playwright tests

### Story 2.4: Update Frontend for Unified API

As a developer,
I want the frontend to use the unified API abstraction,
So that the same frontend code works in both native and web modes.

**Acceptance Criteria:**

**Given** the HttpAPI is implemented and working
**When** I create `frontend/api-client.js`
**Then** it detects the current mode:
- If `window.wails` exists → native mode
- Otherwise → web mode
**And** in web mode, it provides wrapper functions for all API methods:
- `api.setCellValue(row, col, value)` → `POST /api/set-cell`
- `api.getCellValue(row, col)` → `GET /api/get-cell`
- `api.getCellFormula(row, col)` → `GET /api/get-formula`
- `api.deleteCell(row, col)` → `DELETE /api/delete-cell`
- `api.newSpreadsheet()` → `POST /api/new`
- `api.loadFile(path)` → `POST /api/load`
- `api.saveFile(path)` → `POST /api/save`
- `api.getFileStatus()` → `GET /api/status`
- `api.getAllCells()` → `GET /api/cells`
**And** all functions return Promises that resolve to the Response object
**And** the existing `frontend/app.js` is updated to use `api-client.js` instead of direct fetch calls
**And** error handling uses `response.success`, `response.error`, and `response.code` fields
**And** the frontend displays error codes in development mode for debugging

### Story 2.5: Verify All Tests Pass

As a developer,
I want to verify that all existing tests still pass with the new API layer,
So that I can confirm no functionality was broken during refactoring.

**Acceptance Criteria:**

**Given** the web mode API is fully implemented
**When** I run the test suite
**Then** all 42 Go unit tests pass:
- `go test ./tests/...` completes successfully
- All formula tests pass (arithmetic, functions, cell refs, ranges)
- All dependency tracking tests pass
- All circular reference detection tests pass
- All normalization tests pass
**And** all 32 Playwright UI tests pass:
- `./test.sh` completes successfully
- All cell editing tests pass
- All formula evaluation tests pass
- All navigation tests pass
- All file operations tests pass (using web mode)
**And** no test output shows warnings or errors
**And** test coverage remains at existing levels
**And** a test report is generated showing all tests passed

---

## Epic 3: Native App Foundation

**Goal:** Native macOS app launches and displays spreadsheet grid with basic editing.

**User Outcome:** Users can launch a native .app and edit cells in a spreadsheet.

**FRs covered:** FR47, FR51, FR12-FR19, FR21

**Architecture requirements covered:**
- Manual Wails v3 integration (generate reference template)
- Implement native mode API (Wails IPC binding)
- Update frontend for unified API (api-client.js with mode detection)
- Wails v3.0.0-alpha.67 specific version
- Universal binary support (Intel + Apple Silicon)

### Story 3.1: Generate Wails Reference Template

As a developer,
I want to generate a Wails v3 reference template,
So that I can learn the patterns and configuration needed for integration.

**Acceptance Criteria:**

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

### Story 3.2: Create Wails Configuration

As a developer,
I want to create a wails.json configuration for the spreadsheet app,
So that Wails can build the native macOS application.

**Acceptance Criteria:**

**Given** the reference template patterns are understood
**When** I create `wails.json` in the project root
**Then** it configures:
- App name: "GoSheet"
- App ID: "com.gosheet.app"
- Frontend directory: "./frontend"
- Build directory: "./build"
- macOS target: macOS 11+ (Big Sur)
- Architecture: Universal binary (Intel + Apple Silicon)
- Entry point: "./cmd/native"
**And** `go.mod` is updated with Wails v3.0.0-alpha.67 dependency
**And** the configuration is validated with `wails3 doctor`

### Story 3.3: Create Native Mode Entry Point

As a developer,
I want a native mode entry point that initializes the Wails app,
So that the spreadsheet can run as a native macOS application.

**Acceptance Criteria:**

**Given** wails.json is configured and Wails v3 dependency is added
**When** I create `cmd/native/main.go`
**Then** it initializes a Wails application with:
- App title: "GoSheet"
- Window size: 1200x800 (default)
- Frameless: false (standard macOS window)
- Resizable: true
**And** it creates an instance of `controller.AppController`
**And** it serves the frontend from `frontend/` directory
**And** it starts the Wails event loop
**And** the app can be launched with `wails3 dev`
**And** an empty window opens showing the frontend

### Story 3.4: Implement WailsAPI with IPC Binding

As a developer,
I want a WailsAPI implementation that exposes controller methods via IPC,
So that the frontend can call Go functions directly in native mode.

**Acceptance Criteria:**

**Given** the native mode entry point exists and SpreadsheetAPI interface is defined
**When** I create `cmd/native/api_wails.go`
**Then** it defines a `WailsAPI` struct that implements `SpreadsheetAPI` interface
**And** it wraps the existing `controller.AppController` instance
**And** each API method:
- Calls the corresponding controller method
- Converts Go errors to `Response` struct with appropriate error codes
- Returns `Response` with success=true and data on success
- Returns `Response` with success=false, error message, and error code on failure
**And** all methods are exported (PascalCase) for Wails binding
**And** the WailsAPI is bound to the Wails runtime in `main.go`
**And** methods are callable from JavaScript via `window.wails.Call.*`

### Story 3.5: Create Native Mode FileService Stub

As a developer,
I want a native mode FileService stub,
So that the app compiles and runs (full implementation in Epic 4).

**Acceptance Criteria:**

**Given** the FileService interface is defined
**When** I create `cmd/native/fileservice_wails.go`
**Then** it defines a `WailsFileService` struct that implements `FileService` interface
**And** all methods return placeholder implementations:
- `OpenFileDialog` returns empty string and nil error
- `SaveFileDialog` returns empty string and nil error
- `ReadFile` returns empty byte slice and nil error
- `WriteFile` returns nil error
**And** the file includes TODO comments indicating full implementation in Epic 4
**And** the app compiles successfully with the stub

### Story 3.6: Update Frontend API Client for Native Mode

As a developer,
I want the frontend API client to support native mode,
So that the same frontend code works in both native and web modes.

**Acceptance Criteria:**

**Given** the WailsAPI is implemented and bound to Wails runtime
**When** I update `frontend/api-client.js`
**Then** in native mode (when `window.wails` exists), it provides wrapper functions:
- `api.setCellValue(row, col, value)` → `window.wails.Call.SetCellValue(row, col, value)`
- `api.getCellValue(row, col)` → `window.wails.Call.GetCellValue(row, col)`
- `api.getCellFormula(row, col)` → `window.wails.Call.GetCellFormula(row, col)`
- `api.deleteCell(row, col)` → `window.wails.Call.DeleteCell(row, col)`
- `api.newSpreadsheet()` → `window.wails.Call.NewSpreadsheet()`
- `api.loadFile(path)` → `window.wails.Call.LoadFile(path)`
- `api.saveFile(path)` → `window.wails.Call.SaveFile(path)`
- `api.getFileStatus()` → `window.wails.Call.GetFileStatus()`
- `api.getAllCells()` → `window.wails.Call.GetAllCells()`
**And** all functions return Promises that resolve to the Response object
**And** the mode detection logs which mode is active (for debugging)
**And** the frontend works identically in both modes

### Story 3.7: Verify Native App Launches and Displays Grid

As a developer,
I want to verify the native app launches and displays the spreadsheet grid,
So that users can see and interact with cells.

**Acceptance Criteria:**

**Given** the native mode is fully implemented
**When** I run `wails3 dev`
**Then** the native app launches in <1 second (FR47)
**And** the app runs as a single-window application (FR51)
**And** opening files or creating a new spreadsheet reuses the existing window (no additional spreadsheet windows are created) (FR51)
**And** the app window displays the spreadsheet grid with row and column headers (FR12)
**And** I can click to select cells (FR13)
**And** I can navigate cells using arrow keys, Tab, and Enter (FR14)
**And** I can type to edit cell values (FR15)
**And** I can see cell values and computed results in the grid (FR16)
**And** I can see the selected cell's formula in the formula bar (FR17)
**And** I can edit formulas in the formula bar (FR18)
**And** I can delete cell contents using Delete or Backspace (FR19)
**And** formulas evaluate correctly (using existing formula engine)
**And** the app supports 5,000+ cells without performance issues (FR20)
**And** all 42 Go unit tests still pass

---

## Epic 4: Native File Operations

**Goal:** Users can create, open, save, and manage .sheet files using native macOS dialogs with accurate file status.

**User Outcome:** Users can trust their data is saved correctly with real file paths. Solves the core problem from the PRD.

**FRs covered:** FR1-FR5, FR10-FR11

**Architecture requirements covered:**
- Mode-aware file service (native mode with Wails dialogs)
- Native macOS dialogs (not browser-based)
- Direct file I/O to user-chosen paths

### Story 4.1: Implement Native File Dialogs

As a user,
I want to use native macOS file dialogs,
So that I can choose where to save and open my spreadsheet files.

**Acceptance Criteria:**

**Given** the WailsFileService stub exists
**When** I implement `OpenFileDialog` in `cmd/native/fileservice_wails.go`
**Then** it calls `wails.OpenFileDialog()` with filters for .sheet files
**And** it returns the selected file path or error if cancelled
**When** I implement `SaveFileDialog`
**Then** it calls `wails.SaveFileDialog()` with default name and .sheet extension
**And** it returns the selected file path or error if cancelled
**And** both dialogs use native macOS UI (not browser-based) (FR3, NFR-U3)
**And** dialogs respect macOS file system permissions (NFR-S2)

### Story 4.2: Implement Direct File I/O

As a developer,
I want direct file I/O operations,
So that the app can read and write .sheet files to user-chosen paths.

**Acceptance Criteria:**

**Given** the file dialog methods are implemented
**When** I implement `ReadFile` in `cmd/native/fileservice_wails.go`
**Then** it reads the file from the given path using Go's `os.ReadFile`
**And** it returns the file contents or error with FILE_READ_ERROR code
**When** I implement `WriteFile`
**Then** it writes data to the given path using Go's `os.WriteFile`
**And** it returns nil on success or error with FILE_WRITE_ERROR code
**And** file operations respect macOS permissions (NFR-S2)
**And** file operations never corrupt data (NFR-R1)

### Story 4.3: Implement New Spreadsheet

As a user,
I want to create a new empty spreadsheet,
So that I can start working with fresh data.

**Acceptance Criteria:**

**Given** the native app is running
**When** I trigger New Spreadsheet
**Then** the current spreadsheet is cleared (all cells deleted)
**And** the file status shows "Untitled - Unsaved" (FR5)
**And** the file path is empty (no file associated yet)
**And** the modified flag is false (new spreadsheet is not modified)

### Story 4.4: Implement Open File

As a user,
I want to open existing .sheet files from disk,
So that I can resume work on saved spreadsheets.

**Acceptance Criteria:**

**Given** the native app is running and file dialogs are implemented
**When** I trigger Open File
**Then** a native macOS Open dialog appears (FR2, NFR-U3)
**And** the dialog filters for .sheet files
**When** I select a file and click Open
**Then** the file is loaded using `FileService.ReadFile`
**And** the spreadsheet data is deserialized (existing `model/file.go`)
**And** the dependency graph is rebuilt from formulas
**And** all cells display correctly with computed values
**And** the file status shows "Saved: <full file path>" (FR5)
**And** the modified flag is false
**And** if there were unsaved changes before opening, a warning dialog appeared (FR11)
**And** if the file doesn't exist, an error shows with FILE_NOT_FOUND code (NFR-R4)
**And** if the file can't be read, an error shows with FILE_READ_ERROR code (NFR-R4)
**And** large files (5,000 cells) load in <3 seconds with progress indicator (FR21, NFR-P3)

### Story 4.5: Implement Save File

As a user,
I want to save my spreadsheet to disk,
So that my work is preserved and I can trust the file status.

**Acceptance Criteria:**

**Given** the native app is running with a spreadsheet open
**When** I trigger Save and a file path is already set
**Then** the spreadsheet is serialized (existing `model/file.go`)
**And** the file is written using `FileService.WriteFile` to the existing path
**And** the file status shows "Saved: <full file path>" (FR5)
**And** the modified flag is set to false
**And** the file is not corrupted (NFR-R1)
**When** I trigger Save and no file path is set (new spreadsheet)
**Then** a native macOS Save dialog appears (FR3, NFR-U3)
**And** the dialog suggests "Untitled.sheet" as default name
**When** I choose a path and click Save
**Then** the file is saved to the chosen path
**And** the file status shows "Saved: <full file path>" (FR5)
**And** the modified flag is set to false
**And** if the file can't be written, an error shows with FILE_WRITE_ERROR code (NFR-R4)

### Story 4.6: Implement Save As

As a user,
I want to save my spreadsheet with a new file name,
So that I can create copies or save to different locations.

**Acceptance Criteria:**

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

### Story 4.7: Implement File Status Tracking

As a user,
I want to see accurate file status at all times,
So that I know if my work is saved and where the file is located.

**Acceptance Criteria:**

**Given** the native app is running
**When** I create a new spreadsheet
**Then** the file status shows "Untitled - Unsaved" (FR5)
**When** I edit any cell
**Then** the file status shows "Untitled - Unsaved*" (modified indicator)
**And** the modified flag is true
**When** I open a file
**Then** the file status shows "Saved: <full file path>" (FR5)
**When** I edit any cell after opening
**Then** the file status shows "<filename> - Unsaved*" (modified indicator)
**And** the modified flag is true
**When** I save the file
**Then** the file status shows "Saved: <full file path>" (FR5)
**And** the modified flag is false
**And** the file status is accurate at all times (NFR-R2)
**And** the file status displays the real file path, not a temp path

### Story 4.8: Implement Unsaved Changes Warnings

As a user,
I want warnings before losing unsaved work,
So that I don't accidentally lose data.

**Acceptance Criteria:**

**Given** the native app is running with unsaved changes (modified flag is true)
**When** I attempt to close the window
**Then** a warning dialog appears: "You have unsaved changes. Save before closing?" (FR10)
**And** the dialog offers: Save, Don't Save, Cancel
**When** I click Save, the file is saved (or Save dialog appears if no path)
**And** then the window closes
**When** I click Don't Save, the window closes without saving
**When** I click Cancel, the window stays open
**When** I attempt to quit the app with unsaved changes
**Then** the same warning appears (FR10, NFR-R5)
**When** I attempt to open a new file with unsaved changes
**Then** a warning appears: "You have unsaved changes. Save before opening?" (FR11)
**And** the same Save/Don't Save/Cancel options are offered
**When** I attempt to create a new spreadsheet with unsaved changes
**Then** the same warning appears (FR11, NFR-R5)
**And** warnings prevent data loss in all scenarios (NFR-R5)

---

## Epic 5: CSV Import/Export

**Goal:** Users can import data from CSV files and export spreadsheets to CSV format.

**User Outcome:** Users can migrate data from other tools and share data with non-.sheet users.

**FRs covered:** FR7-FR9, FR33-FR38

**Architecture requirements covered:**
- CSV RFC 4180 compliance
- Data-only import (formulas not preserved)
- Computed values export (formulas evaluated)

### Story 5.1: Implement CSV Import Dialog

As a user,
I want to import CSV files into a new spreadsheet,
So that I can work with data from other tools.

**Acceptance Criteria:**

**Given** the native app is running
**When** I trigger Import CSV
**Then** a native macOS Open dialog appears (FR7, NFR-U3)
**And** the dialog filters for .csv files
**When** I select a CSV file and click Open
**Then** the CSV file is read using `FileService.ReadFile`
**And** the CSV is parsed according to RFC 4180 (NFR-C4)
**And** a preview dialog appears showing:
- Number of rows and columns found (FR8)
- First 10 rows of data (preview)
- Message: "CSV import is data-only. Formulas are not preserved." (FR34)
- Import and Cancel buttons
**And** if the file can't be read, an error shows with FILE_READ_ERROR code
**And** if the CSV is malformed, an error shows with PARSE_ERROR code

### Story 5.2: Implement CSV Data Import

As a user,
I want to import CSV data into the spreadsheet grid,
So that I can edit and enhance the imported data.

**Acceptance Criteria:**

**Given** the CSV preview dialog is showing
**When** I click Import
**Then** the current spreadsheet is cleared (all cells deleted)
**And** CSV data is imported into grid cells starting at A1 (FR35)
**And** each CSV row becomes a spreadsheet row
**And** each CSV column becomes a spreadsheet column
**And** all values are imported as plain text (no formula interpretation)
**And** the file status shows "Untitled - Unsaved*" (FR36)
**And** the modified flag is true (data needs to be saved)
**And** the file path is empty (no .sheet file associated yet)
**And** imported data displays correctly in the grid
**And** 500 rows import in <1 second (NFR-P5)
**And** if there were unsaved changes before importing, a warning appeared first

### Story 5.3: Implement CSV Export Dialog

As a user,
I want to export my spreadsheet to CSV format,
So that I can share data with users who don't have the app.

**Acceptance Criteria:**

**Given** the native app is running with a spreadsheet open
**When** I trigger Export CSV
**Then** a native macOS Save dialog appears (FR9, FR37, NFR-U3)
**And** the dialog suggests "<current-filename>.csv" or "Untitled.csv"
**And** the dialog filters for .csv files
**When** I choose a path and click Save
**Then** the spreadsheet is exported to CSV format
**And** formulas are evaluated and only computed values are exported (FR38)
**And** the CSV follows RFC 4180 format (NFR-C4)
**And** the export completes successfully
**And** a success message appears: "Exported to <path>"
**And** if the file can't be written, an error shows with FILE_WRITE_ERROR code

### Story 5.4: Verify CSV Round-Trip

As a developer,
I want to verify CSV import/export works correctly,
So that users can reliably exchange data.

**Acceptance Criteria:**

**Given** the CSV import and export are implemented
**When** I import a CSV file with 500 rows and 10 columns
**Then** all data is imported correctly
**And** I can add formulas to calculate totals
**When** I export to CSV
**Then** the computed values are exported (formulas evaluated)
**And** the CSV can be opened in Excel or other tools
**And** the data matches the spreadsheet grid
**When** I re-import the exported CSV
**Then** the data matches (formulas are lost, only values remain)
**And** the round-trip preserves data integrity
**And** all Playwright tests for CSV operations pass

---

## Epic 6: macOS Integration & Polish

**Goal:** App feels like a native macOS application with menu bar, keyboard shortcuts, dock integration, and file associations.

**User Outcome:** Users get a polished native experience with standard macOS patterns.

**FRs covered:** FR39-FR46, FR6

**Architecture requirements covered:**
- Wails built-in APIs for macOS integration
- Recent files list storage and display
- macOS HIG compliance

### Story 6.1: Implement File Menu

As a user,
I want a File menu with standard macOS actions,
So that I can access file operations using familiar patterns.

**Acceptance Criteria:**

**Given** the native app is running
**When** I view the menu bar
**Then** a File menu is visible with the following items (FR39):
- New (Cmd+N)
- Open... (Cmd+O)
- Recent Files > (submenu; may be empty until populated)
- Save (Cmd+S)
- Save As... (Cmd+Shift+S)
- Import CSV...
- Export CSV...
- Close (Cmd+W)
- Quit (Cmd+Q)
**And** all menu items are implemented using Wails `application.Menu` API
**And** menu items trigger the corresponding API methods
**And** keyboard shortcuts work correctly (FR42, NFR-U2)
**And** the menu follows macOS HIG (NFR-U1)

### Story 6.2: Implement Edit Menu

As a user,
I want an Edit menu with standard macOS actions,
So that I can use familiar editing commands.

**Acceptance Criteria:**

**Given** the native app is running
**When** I view the menu bar
**Then** an Edit menu is visible with the following items (FR40):
- Cut (Cmd+X)
- Copy (Cmd+C)
- Paste (Cmd+V)
- Select All (Cmd+A)
**And** all menu items are implemented using Wails `application.Menu` API
**And** Cut/Copy/Paste work with cell values
**And** Select All selects all non-empty cells
**And** keyboard shortcuts work correctly (FR42, NFR-U2)
**And** the menu follows macOS HIG (NFR-U1)
**And** Undo/Redo are NOT included (deferred to Phase 2 per PRD)

### Story 6.3: Implement Help Menu

As a user,
I want a Help menu with app information,
So that I can learn about the application.

**Acceptance Criteria:**

**Given** the native app is running
**When** I view the menu bar
**Then** a Help menu is visible with the following items (FR41):
- About GoSheet
**When** I click About GoSheet
**Then** an About dialog appears showing:
- App name: "GoSheet"
- Version number (from build)
- Copyright information
- Brief description: "Lightweight, fast spreadsheet for macOS"
**And** the dialog follows macOS HIG (NFR-U1)

### Story 6.4: Implement Keyboard Shortcuts

As a user,
I want keyboard shortcuts for common actions,
So that I can work efficiently without using the mouse.

**Acceptance Criteria:**

**Given** the native app is running
**When** I press keyboard shortcuts
**Then** the following shortcuts work correctly (FR42, NFR-U2):
- Cmd+N: New spreadsheet
- Cmd+O: Open file
- Cmd+S: Save file
- Cmd+Shift+S: Save As
- Cmd+W: Close window
- Cmd+Q: Quit app
- Cmd+X: Cut
- Cmd+C: Copy
- Cmd+V: Paste
- Cmd+A: Select All
**And** all shortcuts are bound using Wails `application.KeyBinding` API
**And** shortcuts follow macOS conventions (NFR-U2)
**And** shortcuts work even when menu bar is hidden

### Story 6.5: Implement Recent Files List

As a user,
I want to see a list of recently opened files,
So that I can quickly resume work on recent spreadsheets.

**Acceptance Criteria:**

**Given** the native app is running
**When** I open or save a file
**Then** the file path is added to the recent files list (FR6)
**And** the list stores up to 10 recent files
**And** the list is persisted to disk (in app data directory)
**When** I view File > Recent Files submenu
**Then** the submenu shows the 10 most recent files (FR6)
**And** each item shows the filename and parent directory
**When** I click a recent file
**Then** the file is opened (same as File > Open)
**And** if the file no longer exists, it's removed from the list
**And** the recent files list is also displayed in the dock menu (Story 6.6)

### Story 6.6: Implement Dock Integration

As a user,
I want dock integration with recent files,
So that I can quickly access recent spreadsheets from the dock.

**Acceptance Criteria:**

**Given** the native app is installed
**When** I right-click the app icon in the dock
**Then** a dock menu appears showing (FR44):
- Recent Files (list of up to 5 most recent files)
- New Spreadsheet
**And** the dock menu is implemented using Wails `application.DockMenu` API
**When** I click a recent file in the dock menu
**Then** the app launches (if not running) and opens the file
**When** I click New Spreadsheet
**Then** the app launches (if not running) and creates a new spreadsheet
**And** the app icon is visible in the dock (FR46)

### Story 6.7: Implement File Associations

As a user,
I want to double-click .sheet files to open them,
So that I can launch the app and open files in one action.

**Acceptance Criteria:**

**Given** the native app is installed
**When** I configure file associations in `wails.json`
**Then** the configuration specifies:
- File extension: .sheet
- File type: "GoSheet Spreadsheet"
- Icon: custom .sheet file icon (Story 6.8)
**And** the Wails build generates `Info.plist` with file associations
**When** I double-click a .sheet file in Finder
**Then** the app launches (if not running) (FR43)
**And** the file is opened automatically
**And** if the app is already running, the file opens in the current window
**And** file associations work on macOS 11+ (NFR-C1)

### Story 6.8: Add App and File Icons

As a user,
I want custom icons for the app and .sheet files,
So that the app looks polished and professional.

**Acceptance Criteria:**

**Given** the native app project is set up
**When** I add app icon assets
**Then** `build/appicon.png` contains the app icon (1024x1024)
**And** the Wails build generates all required icon sizes for macOS
**And** the app icon appears in the dock (FR46)
**And** the app icon appears in the menu bar (if applicable)
**When** I add file icon assets
**Then** `build/icons/sheet-icon.icns` contains the .sheet file icon
**And** the file icon is associated with .sheet files in `Info.plist`
**And** .sheet files display the custom icon in Finder (FR45)
**And** icons follow macOS design guidelines (NFR-U1)
**And** icons are placeholder/simple designs (can be refined later)

---

## Epic 7: Welcome Screen & Lifecycle

**Goal:** Users see a welcoming first-run experience with easy access to recent files and common actions.

**User Outcome:** Users can quickly start new spreadsheets or resume work on recent files.

**FRs covered:** FR48-FR50

**Architecture requirements covered:**
- Welcome screen UX design
- Recent files display integration

### Story 7.1: Design Welcome Screen Layout

As a user,
I want a clean welcome screen when I launch the app,
So that I can quickly choose what to do next.

**Acceptance Criteria:**

**Given** the native app is being designed
**When** I create the welcome screen layout
**Then** it includes the following elements (FR48):
- App title: "GoSheet"
- Subtitle: "Lightweight, fast spreadsheet for macOS"
- Three large buttons:
  - "Create New Spreadsheet" (primary action)
  - "Open Existing File"
  - "Import from CSV"
- Recent Files section (list of up to 5 recent files) (FR49)
- Quick tip: "Tip: Use Cmd+N for new spreadsheet"
**And** the layout is clean and minimal
**And** the design follows macOS HIG (NFR-U1)
**And** the layout is responsive to window resizing

### Story 7.2: Implement Welcome Screen Display

As a user,
I want the welcome screen to appear on first launch,
So that I can easily get started with the app.

**Acceptance Criteria:**

**Given** the welcome screen layout is designed
**When** I launch the app for the first time (no recent files)
**Then** the welcome screen is displayed (FR48)
**And** the three action buttons are visible and clickable
**And** the Recent Files section shows "No recent files"
**When** I launch the app after using it (with recent files)
**Then** the welcome screen is displayed (FR48)
**And** the Recent Files section shows up to 5 recent files (FR49)
**And** each recent file shows filename and parent directory
**When** I click "Create New Spreadsheet"
**Then** the welcome screen is replaced with an empty spreadsheet grid
**When** I click "Open Existing File"
**Then** the native Open dialog appears
**When** I click "Import from CSV"
**Then** the CSV import dialog appears
**When** I click a recent file
**Then** that file is opened

### Story 7.3: Implement Graceful Shutdown

As a user,
I want the app to close gracefully when I quit,
So that my settings and recent files are preserved.

**Acceptance Criteria:**

**Given** the native app is running
**When** I quit the app (Cmd+Q or File > Quit)
**Then** if there are unsaved changes, a warning appears (FR10, implemented in Epic 4)
**And** if I choose to quit, the app closes gracefully (FR50)
**And** the recent files list is saved to disk
**And** any temp files are cleaned up
**And** the app state is persisted (window size, position if applicable)
**When** I close the window (Cmd+W or red button)
**Then** if there are unsaved changes, a warning appears (FR10)
**And** if I choose to close, the window closes
**And** on macOS, closing the window quits the app (single window per PRD)
**And** the shutdown is graceful with no crashes or data loss

### Story 7.4: Verify Complete User Experience

As a developer,
I want to verify the complete user experience from launch to quit,
So that users have a polished, reliable application.

**Acceptance Criteria:**

**Given** all 7 epics are implemented
**When** I test the complete user journey
**Then** the app launches in <1 second (NFR-P1)
**And** the welcome screen appears with recent files
**And** I can create a new spreadsheet and edit cells
**And** I can save the file with a native dialog
**And** I can open the file later from recent files
**And** I can import CSV data and export to CSV
**And** all menu items and keyboard shortcuts work
**And** file associations work (double-click .sheet files)
**And** the app feels native and polished (NFR-U1)
**And** all 42 Go unit tests pass (NFR-R6)
**And** all 32 Playwright UI tests pass in web mode (NFR-R7)
**And** the app runs on macOS 11+ (NFR-C1)
**And** the app is a Universal binary (Intel + Apple Silicon) (NFR-C2)
**And** no data is ever corrupted or lost (NFR-R1)
**And** the app never crashes (NFR-R3, NFR-R4, NFR-S4)
