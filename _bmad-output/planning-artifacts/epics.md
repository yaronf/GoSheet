---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation', 'epic-5-inserted', 'electron-migration-update', 'epic-9-added', 'epic-11-added', 'epics-14-19-added', 'epic-21-added', 'epic-22-added', 'epic-23-added']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-15.md'
  - '_bmad-output/planning-artifacts/electron-migration-analysis.md'
  - '_bmad-output/planning-artifacts/research/technical-cell-merging-research-2026-02-23.md'
  - '_bmad-output/implementation-artifacts/TECHNICAL-DEBT.md'
  - '_bmad-output/planning-artifacts/backlog.md'
  - '_bmad-output/planning-artifacts/research/technical-agent-access-layer-research.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-13.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-15.md'
epicCount: 23
totalFRs: 51
totalNFRs: 23
totalStories: 61
status: 'updated'
validationStatus: 'passed'
readyForDevelopment: true
completedDate: '2026-02-14'
lastUpdated: '2026-03-15'
updateReason: 'Added Epic 23 (Spreadsheet UX Enhancements); Epic 22 complete'
---

# spreadsheet - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for spreadsheet, decomposing the requirements from the PRD and Architecture into implementable stories.

**MAJOR REVISION (2026-02-15):**
This document was originally written for Wails v3 dual-mode architecture. During Epic 5 implementation, we discovered that pyax (macOS Accessibility API) cannot access Wails WebView content, making automated UI testing impossible. After comprehensive analysis, we pivoted to Electron with Playwright native integration.

**Changes Made:**
- ✅ **Epic 2**: Marked as OBSOLETE (web mode no longer needed)
- ✅ **Epic 3**: Complete rewrite for Electron (7 new stories)
- ✅ **Epic 4**: Marked as ADAPTED (backend 100% reusable, frontend IPC updates in Epic 3)
- ✅ **Epic 5**: Complete replacement (pyax → Playwright Electron, 6 new stories)
- ✅ **Epics 6-8**: Unchanged (CSV, macOS integration, welcome screen)

**See Also:**
- `sprint-change-proposal-2026-02-15.md` - Full migration rationale and impact analysis
- `electron-migration-analysis.md` - Technical deep dive on Electron vs Wails
- `architecture.md` - Updated architecture document

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
- FR33: Epic 6 - Import CSV files containing data (SHIFTED from Epic 5)
- FR34: Epic 6 - Display messaging that CSV import is data-only (SHIFTED from Epic 5)
- FR35: Epic 6 - Import CSV data into grid cells (SHIFTED from Epic 5)
- FR36: Epic 6 - Mark imported data as unsaved (SHIFTED from Epic 5)
- FR37: Epic 6 - Export current spreadsheet to CSV (SHIFTED from Epic 5)
- FR38: Epic 6 - Export computed values to CSV (formulas evaluated) (SHIFTED from Epic 5)

**macOS Integration (8 FRs):**
- FR39: Epic 7 - File menu (New, Open, Save, Save As, Import CSV, Export CSV, Recent Files, Close, Quit) (SHIFTED from Epic 6)
- FR40: Epic 7 - Edit menu (Cut, Copy, Paste, Select All) (SHIFTED from Epic 6)
- FR41: Epic 7 - Help menu (About) (SHIFTED from Epic 6)
- FR42: Epic 7 - Keyboard shortcuts (Cmd+N/O/S/W/Q, Cmd+X/C/V) (SHIFTED from Epic 6)
- FR43: Epic 7 - Double-click .sheet files to open (SHIFTED from Epic 6)
- FR44: Epic 7 - Recent files in dock menu (SHIFTED from Epic 6)
- FR45: Epic 7 - Custom icon for .sheet files in Finder (SHIFTED from Epic 6)
- FR46: Epic 7 - App icon in dock (SHIFTED from Epic 6)

**Application Lifecycle (5 FRs):**
- FR47: Epic 3 - Launch in <1 second
- FR48: Epic 8 - Welcome screen on first launch (SHIFTED from Epic 7)
- FR49: Epic 8 - Display recent files on welcome screen (SHIFTED from Epic 7)
- FR50: Epic 8 - Close gracefully when user quits (SHIFTED from Epic 7)
- FR51: Epic 3 - Single window (one spreadsheet at a time)

**Non-Functional Requirements (23 NFRs):**
All NFRs are cross-cutting and verified across multiple epics:
- Performance (7 NFRs): Verified in Epics 3-7
- Reliability (7 NFRs): Verified in all epics (test preservation, Epic 5 Playwright testing)
- Usability (5 NFRs): Verified in Epics 3-7 (Electron dialogs acceptable per user)
- Maintainability (5 NFRs): Verified in Epics 3-5 (single-mode architecture, simpler than dual-mode)
- Compatibility (4 NFRs): Verified in Epics 3-7 (cross-platform ready)
- Security (6 NFRs): Verified in all epics

## Epic List

### Epic 1: Consistent Spreadsheet Actions & Error Handling [OBSOLETE - Not Needed for Electron]

**Status:** OBSOLETE as of 2026-02-15  
**Reason:** Electron single-mode architecture doesn't need API abstraction layer. HTTP API already provides consistent error handling.

**Original Goal:** Establish a consistent contract for spreadsheet actions and error handling so the UI can reliably report success/failure and stay responsive.

**Migration:** 
- HTTP API already provides structured JSON responses (existing)
- No need for separate API abstraction layer
- Frontend uses HTTP fetch directly (existing pattern)
- Error codes already defined in HTTP handlers

**FRs covered:** None directly (enabling requirement for reliable UI/API behavior)

**Architecture requirements covered:**
- HTTP JSON responses with error codes (existing, preserved)
- No package separation needed (single-mode architecture)

**Why obsolete:** The unified API layer was designed for dual-mode architecture (native Wails IPC + web HTTP). Electron uses HTTP for spreadsheet operations (existing) and IPC for file dialogs only (simple, no abstraction needed).

---

### Epic 2: Web Mode Preservation [OBSOLETE - Replaced by Electron]

**Status:** OBSOLETE as of 2026-02-15  
**Reason:** Electron architecture eliminates need for separate web mode. Playwright tests run natively against Electron app.

**Original Goal:** Existing web-based spreadsheet continues working with new API layer, all 74 tests pass.

**Migration:** 
- HTTP server code reused as embedded server in Electron
- Playwright tests migrated to Electron API (Epic 5)
- All 5 stories' work preserved in new architecture

**Stories (completed but obsolete):**
- 2.1-2.5: Code reused in Electron embedded server

**FRs covered:** FR12-FR32 (Spreadsheet Core + Formula Engine - already implemented, preserved in Electron)
- FR12-FR21: Grid display, cell selection, navigation, editing, formula bar, 5K+ cells, progress indicators
- FR22-FR32: Formulas, arithmetic, cell/range references, functions, dependencies, circular refs, normalization, errors

**Architecture requirements covered:**
- HTTP server preserved as embedded server in Electron
- All 42 Go unit tests preserved (no changes)
- All 32 Playwright UI tests ported to Electron API (Epic 5)

---

### Epic 3: Electron Desktop App [REVISED - Replaces Wails Implementation]

**Status:** REVISED as of 2026-02-15 (original Wails work obsolete)  
**Reason:** Electron provides better testability via Playwright native integration

**Goal:** Create Electron desktop app with embedded Go HTTP server

**User Outcome:** Users can launch GoSheet as desktop app with native-like dialogs

**FRs covered:** FR47, FR51, FR12-FR19, FR21
- FR47: Launch in <1 second
- FR51: Single window (one spreadsheet at a time)
- FR12-FR19: Grid display, cell selection, navigation, editing, formula bar, delete
- FR21: Progress indicator for large operations

**Architecture Benefits:**
- ✅ Playwright native Electron support (no pyax hacks)
- ✅ Simpler codebase (-700 lines vs dual-mode)
- ✅ Cross-platform ready (Windows, Linux, macOS)
- ✅ 100% Go backend reused (no changes needed)

**Architecture requirements covered:**
- Electron 28+ with embedded Go HTTP server
- Electron IPC for file dialogs
- Universal binary support (Intel + Apple Silicon)
- electron-builder for packaging

**Why standalone:** Delivers complete Electron foundation - app launches, displays grid, file dialogs work. All subsequent features build on this.

---

### Epic 4: Native File Operations [ADAPTED - Backend Reused, Frontend Updated]

**Status:** ADAPTED as of 2026-02-15  
**Backend Status:** ✅ 100% reusable (no changes needed)  
**Frontend Status:** ⚠️ Needs Electron IPC updates

**Goal:** Users can create, open, save, and manage .sheet files using Electron dialogs with accurate file status.

**User Outcome:** Users can trust their data is saved correctly with real file paths. Solves the core problem from the PRD.

**FRs covered:** FR1-FR5, FR10-FR11
- FR1: Create new empty spreadsheet
- FR2: Open existing .sheet files
- FR3: Save spreadsheets with user-chosen path
- FR4: Save As with new file name
- FR5: Accurate file status with real path
- FR10: Warn before closing unsaved changes
- FR11: Warn before loading with unsaved changes

**What's Reusable:**
- ✅ All Go backend code (controller methods, file I/O logic)
- ✅ File status tracking logic
- ✅ Unsaved changes detection
- ✅ Save/Open/SaveAs workflows

**What Needs Updating:**
- ⚠️ Frontend: Replace Wails IPC calls with Electron IPC (done in Story 3.5)
- ⚠️ Dialog triggering: Use window.electronAPI instead of Wails bindings

**Adaptation Status:**
- Stories 4.1-4.8: Backend code 100% reusable
- Frontend IPC updates: Covered by Story 3.5
- **Additional effort: 0 hours** (handled by Epic 3)

**Architecture requirements covered:**
- Electron IPC for file dialogs
- Electron dialogs (non-native but acceptable per user)
- Direct file I/O to user-chosen paths

**Why standalone:** Complete file workflow - New, Open, Save, Save As with accurate status and warnings. Users can fully manage their files.

**Implementation notes:**
- Backend file operations already implemented (Epic 4 completed)
- Frontend IPC updates completed in Epic 3, Story 3.5
- No additional implementation needed for this epic

---

### Epic 5: Playwright Electron Testing [REPLACED - pyax → Playwright]

**Status:** REPLACED as of 2026-02-15  
**Reason:** Discovery - pyax cannot test Wails WebView content (HTML/JS invisible to accessibility API)

**Critical Finding:**
- ❌ pyax can see native macOS windows but NOT WebView content
- ❌ HTML buttons, JavaScript events invisible to accessibility API
- ❌ Cannot click buttons, cannot test keyboard shortcuts in WebView
- ✅ Playwright has native Electron support (official API)

**Goal:** Automated Electron app testing using Playwright native integration

**User Outcome:** Developers can run automated UI tests against Electron app with full coverage

**FRs covered:** None directly (enabling requirement for reliable native feature development)

**NFRs covered:** NFR-R1-R7 (Reliability - automated test coverage for Electron app)

**Architecture Benefits:**
- ✅ Playwright `_electron` API (first-class support)
- ✅ Dialog stubbing via electron-playwright-helpers
- ✅ Can test all UI elements (buttons, inputs, everything)
- ✅ Can test keyboard shortcuts
- ✅ Can test IPC communication
- ✅ CI/CD friendly (headless mode, no accessibility permissions)

**Why standalone:** Epic 4 retrospective revealed that manual testing is not sustainable. The original pyax approach failed because WebView content is invisible to accessibility APIs. Playwright Electron provides official, native integration that solves this completely.

**Total Effort:** ~24 hours (3 days)

**Previous Work Status:**
- Stories 5.1-5.5 (pyax): Obsolete, replaced by Playwright approach
- Isolated test runner infrastructure: Reusable concept, different implementation

---

### Epic 6: CSV Import/Export (SHIFTED from Epic 5)
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

### Epic 7: macOS Integration & Polish [ADAPTED for Electron]

**Status:** ADAPTED as of 2026-02-15  
**Migration Status:** Needs updates for Electron APIs

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
- Electron built-in APIs for macOS integration (Menu, app.dock, etc.)
- Recent files list storage and display
- macOS HIG compliance

**Why standalone:** Delivers complete macOS native experience on top of working file operations. Users get all standard macOS features.

**Implementation notes:**
- Implement menu bar using `Menu.buildFromTemplate()`
- Bind keyboard shortcuts to menu items
- Configure file associations in `package.json` (electron-builder)
- Implement dock menu using `app.dock.setMenu()`
- Add app icon and custom .sheet file icon
- Implement recent files list persistence
- Test all keyboard shortcuts
- Verify macOS HIG compliance

---

### Epic 8: Welcome Screen & Lifecycle (SHIFTED from Epic 7)
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

## Epic 1: Consistent Spreadsheet Actions & Error Handling [OBSOLETE]

**Status:** OBSOLETE as of 2026-02-15  
**Reason:** Electron single-mode architecture doesn't need API abstraction layer

**Original Goal:** Establish a consistent contract for spreadsheet actions and error handling so the UI can reliably report success/failure and stay responsive.

**Migration:** HTTP API already provides structured JSON responses. No additional abstraction needed for Electron.

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

## Epic 3: Electron Desktop App [REVISED]

**Status:** REVISED as of 2026-02-15 (original Wails work obsolete)  
**Reason:** Electron provides better testability via Playwright native integration

**Goal:** Create Electron desktop app with embedded Go HTTP server

**User Outcome:** Users can launch GoSheet as desktop app with native-like dialogs

**FRs covered:** FR47, FR51, FR12-FR19, FR21

**Architecture Benefits:**
- ✅ Playwright native Electron support (no pyax hacks)
- ✅ Simpler codebase (-700 lines vs dual-mode)
- ✅ Cross-platform ready (Windows, Linux, macOS)
- ✅ 100% Go backend reused (no changes needed)

**Architecture requirements covered:**
- Electron 28+ with embedded Go HTTP server
- Electron IPC for file dialogs
- Universal binary support (Intel + Apple Silicon)
- electron-builder for packaging

**Total Effort:** ~18 hours (2-3 days)

### Story 3.1: Create Electron Main Process

**Effort:** 4 hours (~200 lines)

As a developer,
I want to create the Electron main process that launches the Go server and creates the app window,
So that the Electron app can run with the embedded Go backend.

**Tasks:**
- Create `electron/main.js` with app lifecycle
- Implement Go server spawn as child process
- Create BrowserWindow with proper configuration
- Handle app quit and cleanup
- Port management for Go server

**Acceptance Criteria:**

**Given** Electron 28+ is installed and Go server binary exists
**When** I create `electron/main.js`
**Then** it initializes an Electron application with:
- App title: "GoSheet"
- Window size: 1200x800 (default)
- Resizable: true
- Preload script: `electron/preload.js`
**And** it spawns the Go HTTP server as a child process on port 3000
**And** it waits for server startup before creating the window
**And** it loads `http://localhost:3000` in the BrowserWindow
**And** it handles app quit by killing the Go server process
**And** the app can be launched with `npm start`
**And** the window opens showing the frontend from the Go server

### Story 3.2: Create Electron Preload Script

**Effort:** 2 hours (~50 lines)

As a developer,
I want to create a secure IPC bridge between the renderer and main process,
So that the frontend can safely call file dialog functions.

**Tasks:**
- Create `electron/preload.js` with contextBridge
- Expose file dialog APIs to renderer
- Implement secure IPC communication
- Document API surface for frontend

**Acceptance Criteria:**

**Given** the Electron main process exists
**When** I create `electron/preload.js`
**Then** it exposes `window.electronAPI` with:
- `openFileDialog()` - returns Promise<string|null>
- `saveFileDialog(defaultName)` - returns Promise<string|null>
**And** it uses `contextBridge.exposeInMainWorld` for security
**And** context isolation is maintained (no Node.js APIs leaked to renderer)
**And** the preload script is configured in BrowserWindow
**And** `window.electronAPI` is available in the renderer process

### Story 3.3: Integrate Go HTTP Server

**Effort:** 2 hours (~50 lines)

As a developer,
I want to embed the existing Go HTTP server in Electron as a child process,
So that the frontend can communicate with the backend via HTTP.

**Tasks:**
- Spawn Go server binary from Electron main
- Handle server startup and readiness
- Implement port management (dynamic or fixed)
- Handle server lifecycle (start, stop, restart)
- Log server output for debugging

**Acceptance Criteria:**

**Given** the Go server binary exists
**When** Electron main process starts
**Then** it spawns the Go server as a child process
**And** the server runs on port 3000 (or dynamically assigned)
**And** the main process waits for server readiness before creating the window
**And** the renderer can fetch from `http://localhost:3000`
**And** the server stops when Electron quits
**And** server output is logged to console for debugging

### Story 3.4: Implement Electron File Dialogs

**Effort:** 4 hours (~100 lines)

As a developer,
I want to implement file dialogs via Electron IPC,
So that users can open and save files with native-like dialogs.

**Tasks:**
- Implement IPC handler for `dialog:openFile`
- Implement IPC handler for `dialog:saveFile`
- Configure file filters (.sheet extension)
- Handle dialog cancellation
- Return file paths to renderer

**Acceptance Criteria:**

**Given** the preload script exposes dialog APIs
**When** I implement IPC handlers in `electron/main.js`
**Then** `dialog:openFile` handler:
- Shows Electron open dialog
- Filters for .sheet files
- Returns file path or null if cancelled
- Dialog is modal to main window
**And** `dialog:saveFile` handler:
- Shows Electron save dialog with default filename
- Filters for .sheet files
- Returns file path or null if cancelled
- Dialog is modal to main window
**And** both handlers use `ipcMain.handle` for async responses

### Story 3.5: Update Frontend for Electron IPC

**Effort:** 2 hours (~50 lines)

As a developer,
I want to update the frontend to use Electron IPC for file dialogs,
So that file operations work in the Electron app.

**Tasks:**
- Update `frontend/app.js` to use `window.electronAPI`
- Keep HTTP API for spreadsheet operations
- Add fallback for browser development mode
- Update file operation flows

**Acceptance Criteria:**

**Given** the Electron IPC is implemented
**When** I update `frontend/app.js`
**Then** file dialog functions use Electron IPC:
- `openFile()` calls `window.electronAPI.openFileDialog()`
- `saveFile()` calls `window.electronAPI.saveFileDialog()`
**And** spreadsheet operations still use HTTP fetch to localhost:3000
**And** there's a fallback for browser development mode (check if `window.electronAPI` exists)
**And** no Wails code remains
**And** file operations work end-to-end in Electron app

### Story 3.6: Configure electron-builder

**Effort:** 2 hours (~50 lines)

As a developer,
I want to configure electron-builder for packaging,
So that the app can be distributed as a macOS .app bundle.

**Tasks:**
- Create `package.json` with Electron dependencies
- Configure electron-builder for macOS
- Include Go server binary in package
- Set up .app bundle structure
- Configure code signing (if applicable)

**Acceptance Criteria:**

**Given** the Electron app is working in development
**When** I configure `package.json` and electron-builder
**Then** `package.json` includes:
- Electron 28+ dependency
- electron-builder dependency
- Scripts: `start`, `build`, `test`
**And** electron-builder config specifies:
- App name: "GoSheet"
- App ID: "com.gosheet.app"
- macOS category: productivity
- Universal binary (Intel + Apple Silicon)
- Go server binary included in resources
**And** `npm run build` creates `.app` bundle in `dist/mac/`
**And** the packaged app launches successfully

### Story 3.7: Verify Electron App Launches

**Effort:** 2 hours (testing)

As a developer,
I want to verify the Electron app works end-to-end,
So that users can launch the app and use basic features.

**Tasks:**
- Launch Electron app from package
- Verify Go server starts
- Verify UI loads and displays grid
- Test file dialogs (open, save)
- Test basic spreadsheet operations
- Verify app quits cleanly

**Acceptance Criteria:**

**Given** the Electron app is fully implemented
**When** I launch the app with `npm start`
**Then** the app launches in <1 second (FR47)
**And** the app runs as a single-window application (FR51)
**And** the UI displays correctly with spreadsheet grid (FR12)
**And** file dialogs work (open and save)
**And** I can enter data and formulas (FR15, FR22)
**And** formulas evaluate correctly (existing formula engine)
**And** I can save and load files
**And** no console errors appear
**And** the app quits cleanly without hanging
**And** the Go server process is killed on quit
**And** all 42 Go unit tests still pass

---

## Epic 4: Native File Operations [COMPLETED - Backend Reusable for Electron]

**Status:** COMPLETED (backend implementation done, frontend adapted in Epic 3)  
**Migration Status:** Backend 100% reusable, frontend IPC updated in Story 3.5

**Goal:** Users can create, open, save, and manage .sheet files using dialogs with accurate file status.

**User Outcome:** Users can trust their data is saved correctly with real file paths. Solves the core problem from the PRD.

**FRs covered:** FR1-FR5, FR10-FR11

**Architecture requirements covered:**
- File dialogs via Electron IPC (updated from Wails)
- Electron dialogs (non-native but acceptable per user)
- Direct file I/O to user-chosen paths

**Implementation Notes:**
The stories below were originally implemented for Wails but the Go backend code (controller methods, file I/O logic) is 100% reusable with Electron. Frontend IPC calls were updated in Epic 3, Story 3.5 to use `window.electronAPI` instead of Wails bindings.

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

## Epic 5: Native Testing Infrastructure

**Goal:** Automate testing of native macOS features to eliminate manual testing bottleneck.

**User Outcome:** Developers can confidently iterate on native features with automated test coverage.

**NFRs covered:** NFR-R1-R7 (Reliability - automated test coverage)

**Based on:** Technical Research (Feb 15, 2026)

### Story 5.1: Set Up Playwright Electron Environment

**Effort:** 2 hours

As a developer,
I want to configure Playwright for Electron testing,
So that I can write automated tests for the Electron app.

**Tasks:**
- Install @playwright/test
- Install electron-playwright-helpers
- Create test configuration
- Set up test fixtures for Electron app
- Document test execution

**Acceptance Criteria:**

**Given** I have Node.js 18+ installed
**When** I run `npm install --save-dev @playwright/test electron-playwright-helpers`
**Then** Playwright and helpers are installed successfully
**When** I create `playwright.config.js`
**Then** the config specifies:
- Test directory: `playwright_tests/`
- Timeout: 30 seconds
- Workers: 1 (Electron apps don't parallelize well)
**When** I create test fixtures in `playwright_tests/fixtures.js`
**Then** the file contains:
- `electronApp` fixture that launches Electron via `_electron.launch()`
- `window` fixture that gets first window via `electronApp.firstWindow()`
- Cleanup that closes app after tests
**When** I run `npx playwright test --list`
**Then** Playwright discovers tests
**And** a simple smoke test passes (app launches successfully)

### Story 5.2: Port Existing Playwright Tests to Electron API

**Effort:** 8 hours

As a developer,
I want to migrate the 32 existing browser Playwright tests to Electron API,
So that all test coverage is maintained in the Electron app.

**Tasks:**
- Update test imports (_electron API)
- Replace page.goto with electronApp.firstWindow()
- Update selectors if needed
- Verify all assertions work
- Run full test suite

**Acceptance Criteria:**

**Given** Playwright Electron environment is set up
**When** I update `playwright_tests/test_spreadsheet.py`
**Then** tests use `_electron.launch()` instead of browser navigation
**And** tests use `electronApp.firstWindow()` to get the window
**And** all 32 existing tests are ported:
- Cell selection and navigation tests
- Formula evaluation tests
- String function tests
- Formula bar tests
- File operation tests
- Circular reference tests
- All other existing tests
**When** I run `npm test`
**Then** all 32 ported tests pass
**And** no browser-specific code remains
**And** test coverage is maintained (same scenarios, same assertions)

### Story 5.3: Implement Dialog Stubbing Tests

**Effort:** 4 hours

As a developer,
I want to test file dialogs with stubbing,
So that tests don't show real dialogs and can run in CI/CD.

**Tasks:**
- Stub showOpenDialog with test paths
- Stub showSaveDialog with test paths
- Test dialog cancellation
- Verify file operations with stubbed dialogs

**Acceptance Criteria:**

**Given** Playwright tests are ported to Electron
**When** I create `playwright_tests/test_file_dialogs.spec.js`
**Then** the file contains dialog stubbing tests using electron-playwright-helpers
**And** test `can stub open dialog` exists:
- Stubs `showOpenDialog` to return `/tmp/test.sheet`
- Clicks Load button
- Verifies file was loaded (checks via HTTP API)
**And** test `can stub save dialog` exists:
- Stubs `showSaveDialog` to return `/tmp/saved.sheet`
- Clicks Save button
- Verifies file was saved
**And** test `can test dialog cancellation` exists:
- Stubs dialog to return null (cancelled)
- Clicks Load button
- Verifies app returns to normal state (no error)
**When** I run `npm test`
**Then** all dialog stubbing tests pass
**And** no real dialogs appear during tests
**And** file operations work with stubbed paths

### Story 5.4: Create File Operation Tests

**Effort:** 4 hours

As a developer,
I want end-to-end tests for file operations,
So that I can verify New, Open, Save, and Save As workflows work correctly.

**Tasks:**
- Test New spreadsheet workflow
- Test Open file workflow
- Test Save file workflow
- Test Save As workflow
- Test file status tracking
- Test unsaved changes warnings

**Acceptance Criteria:**

**Given** dialog stubbing is working
**When** I create `playwright_tests/test_file_operations.spec.js`
**Then** the file contains comprehensive file operation tests
**And** test `New spreadsheet workflow` exists:
- Stubs confirm dialog (unsaved changes warning)
- Clicks New button
- Verifies grid is cleared
- Verifies status shows "Unsaved"
**And** test `Open file workflow` exists:
- Stubs open dialog with test file path
- Clicks Load button
- Verifies file was loaded
- Verifies status shows file path
**And** test `Save file workflow` exists:
- Enters data in cells
- Stubs save dialog with test path
- Clicks Save button
- Verifies status shows "Saved"
**And** test `file status tracking` exists:
- Verifies status updates after save/load/edit
**When** I run `npm test`
**Then** all file operation tests pass
**And** edge cases are covered (cancellation, errors)

### Story 5.5: Verify All Tests Pass in Electron

**Effort:** 4 hours

As a developer,
I want to verify the complete test suite passes in Electron,
So that I can confirm full test coverage is maintained.

**Tasks:**
- Run complete test suite
- Fix Electron-specific issues
- Verify test coverage
- Document any limitations
- Update test documentation

**Acceptance Criteria:**

**Given** all tests are ported and dialog stubbing works
**When** I run `npm test`
**Then** all tests pass successfully:
- 32 ported Playwright tests (from browser version)
- Dialog stubbing tests
- File operation tests
- Keyboard shortcut tests (if added)
**And** test output shows 0 failures
**And** tests complete in < 60 seconds total
**And** test coverage is maintained (same scenarios as before)
**And** no flaky tests (run 3 times, all pass)
**When** I run `go test ./tests/...`
**Then** all 42 Go unit tests still pass (unchanged)
**And** I document test results in story completion notes
**And** I update README with Electron test instructions

### Story 5.6: Update CI/CD for Electron Testing

**Effort:** 2 hours

As a developer,
I want to automate test execution in CI/CD,
So that tests run automatically on every commit.

**Tasks:**
- Update test scripts in package.json
- Configure GitHub Actions (if applicable)
- Document test execution for team
- Set up test reporting

**Acceptance Criteria:**

**Given** all Electron tests pass locally
**When** I update `package.json` scripts
**Then** `npm test` runs Playwright Electron tests
**And** `npm run test:unit` runs Go unit tests
**And** `npm run test:all` runs both test suites
**When** I create `.github/workflows/test.yml` (if using GitHub)
**Then** the workflow:
- Runs on push and pull request
- Sets up Node.js 18+ and Go 1.x
- Installs dependencies
- Builds Go server binary
- Runs `npm test` (Playwright Electron)
- Runs `go test ./tests/...` (Go unit tests)
- Reports test results
**And** tests run in headless mode (no GUI needed)
**And** I document test execution in README
**And** team knows how to run tests locally and in CI

---

## Epic 6: CSV Import/Export (SHIFTED from Epic 5)

**Goal:** Users can import data from CSV files and export spreadsheets to CSV format.

**User Outcome:** Users can migrate data from other tools and share data with non-.sheet users.

**FRs covered:** FR7-FR9, FR33-FR38

**Architecture requirements covered:**
- CSV RFC 4180 compliance
- Data-only import (formulas not preserved)
- Computed values export (formulas evaluated)

### Story 6.1: Implement CSV Import Dialog

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

### Story 6.2: Implement CSV Data Import

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

### Story 6.3: Implement CSV Export Dialog

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

### Story 6.4: Verify CSV Round-Trip

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

## Epic 7: macOS Integration & Polish [ADAPTED for Electron]

**Status:** ADAPTED as of 2026-02-15  
**Migration Status:** Needs updates for Electron APIs

**Goal:** App feels like a native macOS application with menu bar, keyboard shortcuts, dock integration, and file associations.

**User Outcome:** Users get a polished native experience with standard macOS patterns.

**FRs covered:** FR39-FR46, FR6

**Architecture requirements covered:**
- Electron built-in APIs for macOS integration (Menu, app.dock, etc.)
- Recent files list storage and display
- macOS HIG compliance

**Implementation Notes:**
Stories below reference Wails APIs but will use Electron equivalents:
- `application.Menu` → `Menu.buildFromTemplate()`
- `application.DockMenu` → `app.dock.setMenu()`
- `wails.json` file associations → `package.json` electron-builder config

### Story 7.1: Implement File Menu

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

### Story 7.2: Implement Edit Menu

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

### Story 7.3: Implement Help Menu

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

### Story 7.4: Implement Keyboard Shortcuts

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

### Story 7.5: Implement Recent Files List

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

### Story 7.6: Implement Dock Integration

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

### Story 7.7: Implement File Associations

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

### Story 7.8: Add App and File Icons

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

## Epic 8: Welcome Screen & Lifecycle (SHIFTED from Epic 7)

**Goal:** Users see a welcoming first-run experience with easy access to recent files and common actions.

**User Outcome:** Users can quickly start new spreadsheets or resume work on recent files.

**FRs covered:** FR48-FR50

**Architecture requirements covered:**
- Welcome screen UX design
- Recent files display integration

### Story 8.1: Design Welcome Screen Layout

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

### Story 8.2: Implement Welcome Screen Display

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

### Story 8.3: Implement Graceful Shutdown

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

### Story 8.4: Verify Complete User Experience

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

---

## Epic 9: Documentation & Project Cleanup

**Goal:** Finalize the project for release by updating documentation to reflect the Electron architecture and removing obsolete files from the Wails migration.

**Business Value:** Professional, clean project ready for distribution with accurate documentation for users and developers.

**Dependencies:**
- Epic 7 complete (macOS integration features documented)
- Epic 8 complete (user experience finalized)

**Estimated Effort:** 3-5 hours

**PRD requirements covered:**
- NFR-M1: Comprehensive documentation
- Project maintainability and professionalism

**Architecture requirements covered:**
- Documentation accuracy
- Clean project structure
- Removal of obsolete Wails artifacts

### Story 9.1: Update README for Electron Architecture

As a developer or user,
I want the README to accurately reflect the current Electron-based architecture,
So that I understand how to build, test, and use the application.

**Acceptance Criteria:**

**Given** the project has migrated from Wails to Electron
**When** I read the README
**Then** the architecture section describes Electron (not Wails)
**And** the status section shows Epic 5 and Epic 6 as completed
**And** test counts are accurate (current Playwright + Go tests)
**And** packaging/distribution instructions are included
**And** the quick start section covers both development and packaged app usage
**And** all Wails references are removed
**And** the feature list includes dark mode and accessibility support
**And** the project structure diagram reflects current directories
**And** build commands use Makefile and npm scripts

### Story 9.2: Create User Documentation

As an end user,
I want comprehensive user documentation,
So that I can effectively use all features of the spreadsheet application.

**Acceptance Criteria:**

**Given** the application is feature-complete
**When** I read the user documentation
**Then** a USER_GUIDE.md file exists with the following sections:
- Getting Started (launching the app, welcome screen)
- Basic Operations (creating, opening, saving files)
- Spreadsheet Basics (cell selection, editing, navigation)
- Formulas (syntax, functions, cell references)
- Keyboard Shortcuts (complete list with descriptions)
- CSV Import/Export (data-only limitations)
- File Formats (.sheet vs .csv)
- Troubleshooting (common issues and solutions)
**And** all instructions are clear and include screenshots or examples
**And** the documentation is written for non-technical users

### Story 9.3: Remove Obsolete Wails Files

As a developer,
I want obsolete Wails files removed from the project,
So that the codebase is clean and doesn't confuse contributors.

**Acceptance Criteria:**

**Given** the project has fully migrated to Electron
**When** I review the project files
**Then** the following Wails files are deleted:
- `api_wails.go`
- `fileservice_wails.go`
- `main.go` (Wails entry point)
- `wails.json`
- `cmd/` directory (Wails CLI entry points)
- Old executables: `gosheet`, `web`
**And** `.gitignore` is updated to reflect Electron structure
**And** no Wails imports remain in Go code
**And** the project builds successfully after cleanup

### Story 9.4: Clean Up Debug and Test Artifacts

As a developer,
I want debug scripts and test artifacts removed,
So that the repository only contains production-ready code.

**Acceptance Criteria:**

**Given** the testing infrastructure is finalized
**When** I review the project files
**Then** the following debug files are deleted:
- `debug_app_ui.py`, `debug_app_ui2.py`, `debug_app_ui3.py`
- `debug_pyax.py`, `debug_pyax2.py`
- `test_file_dialog_manual.py`
**And** the following old test scripts are deleted:
- `test.sh`
- `test-electron-launch.sh`
- `run_native_tests.sh`
**And** the following old virtual environments are deleted:
- `venv/`
- `venv-native-tests/`
- `.venv/`
- `.venv-native-tests/`
**And** obsolete requirements files are deleted:
- `requirements-native.txt`
- `requirements-native-tests.txt`
**And** test artifacts are deleted:
- `test_data.csv`
- `test-results/` (if not needed)
- `playwright-report/` (if not needed)
**And** `.pytest_cache/` is added to `.gitignore`
**And** only production-ready test infrastructure remains

### Story 9.5: Organize Project Structure

As a developer,
I want a clean, well-organized project structure,
So that new contributors can easily navigate the codebase.

**Acceptance Criteria:**

**Given** obsolete files have been removed
**When** I review the project structure
**Then** the `specs/` directory is moved to `_bmad-output/planning-artifacts/specs/` or archived
**And** the `api/` directory is removed (only contains `.gitkeep` files)
**And** the `docs/` directory purpose is clarified or removed if empty
**And** the README project structure diagram matches the actual structure
**And** all directories have clear purposes
**And** the root directory contains only essential files:
  - Configuration files (package.json, go.mod, Makefile, etc.)
  - Documentation (README.md, USER_GUIDE.md, BMAD.md, etc.)
  - Source directories (electron/, frontend/, server/, model/, etc.)
  - Build/test directories (dist/, build/, playwright_tests/, tests/)
**And** a CONTRIBUTING.md file is created with development setup instructions

### Story 9.6: Add In-App Formula Reference

As an end user,
I want to access formula syntax and function reference from within the app,
So that I can write formulas without leaving the spreadsheet or opening external documentation.

**Acceptance Criteria:**

**Given** I am using GoSheet
**When** I choose Help → Formula Reference (or equivalent)
**Then** a modal or panel opens showing:
- Formula basics (= prefix, cell references, range references)
- Arithmetic operators (+, -, *, /, %) with examples
- Comparison operators (=, !=, <, >, <=, >=) with examples
- All supported functions with syntax and one example each:
  - Numeric: SUM, AVG, MIN, MAX, COUNT
  - String: CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID
**And** the content is scrollable and readable
**And** I can close the help and return to the spreadsheet
**And** the Help menu item is clearly labeled (e.g., "Formula Reference" or "Formula Help")

## Epic 11: Cell Merging

Users can merge adjacent cells horizontally or vertically to create combined cells (e.g., for headers or labels). Only the anchor (top-left) cell holds the value; covered cells are hidden. Merge regions persist in the file format.

**Source:** Technical research `research/technical-cell-merging-research-2026-02-23.md`

### Story 11.1: Add Merge Regions to Backend Model and File Format

As a developer,
I want the backend to store merge regions separately from cell values,
So that merged cells can persist across save/load and the file format supports the feature.

**Acceptance Criteria:**

**Given** the spreadsheet model
**When** I add merge region support
**Then** a `MergeRegion` struct exists with `StartRow`, `StartCol`, `RowSpan`, `ColSpan`
**And** `Spreadsheet` has a `Merges []MergeRegion` field
**And** the file format (gob) includes `Merges` in serialization
**And** file version is bumped to `1.1` for backward compatibility
**And** existing `.sheet` files (v1.0) load with empty Merges
**And** Go unit tests pass

### Story 11.2: Add Merge API Endpoints

As a frontend developer,
I want API endpoints to get, create, and remove merge regions,
So that the UI can sync merge state with the backend.

**Acceptance Criteria:**

**Given** the backend has merge region support
**When** I call the API
**Then** `GET /api/merges` returns all merge regions (or equivalent)
**And** `POST /api/merge` accepts `{startRow, startCol, rowSpan, colSpan}` and creates a merge
**And** `POST /api/unmerge` accepts `{startRow, startCol}` and removes the merge containing that anchor
**And** merge creation validates no overlapping regions
**And** merge creation validates range is within grid bounds
**And** API is documented or follows existing patterns

### Story 11.3: Implement Merge-Aware Grid Rendering

As a user,
I want merged cells to render with colspan/rowspan,
So that I see a single combined cell instead of multiple separate cells.

**Acceptance Criteria:**

**Given** the frontend has merge region data from the API
**When** `buildSpreadsheet()` runs
**Then** anchor cells use `td.colSpan` and `td.rowSpan` for merged regions
**And** covered cells are not rendered (no td in DOM for them)
**And** row rendering correctly handles rowspan (fewer td elements in rows below a rowspan)
**And** a `getCellElement(row, col)` helper returns the anchor's td when (row,col) is covered
**And** the grid displays correctly for horizontal merges (e.g., A1:C1)
**And** the grid displays correctly for vertical merges (e.g., A1:A3)
**And** the grid displays correctly for 2D merges (e.g., A1:B2)

### Story 11.4: Update Cell Logic for Merge-Aware Behavior

As a user,
I want selection, loading, and refresh to work correctly with merged cells,
So that I can interact with merged cells without errors.

**Acceptance Criteria:**

**Given** the grid has merged cells
**When** I click a merged cell (anchor or covered area)
**Then** `selectCell` maps covered (row,col) to the anchor and selects the anchor
**And** `loadCells()` and `refreshAllCells()` only update anchor cells (covered cells don't exist in DOM)
**And** formula bar shows the anchor cell's value when a merged cell is selected
**And** editing a merged cell updates the anchor
**And** no console errors or broken behavior when interacting with merged cells

### Story 11.5: Add Merge and Unmerge UI

As a user,
I want to merge and unmerge cells from the UI,
So that I can create headers or combined labels without editing files.

**Acceptance Criteria:**

**Given** I have selected a range of cells
**When** I choose "Merge cells" from Format menu or context menu
**Then** the selected range becomes one merged cell (anchor = top-left)
**And** the value from the anchor is preserved; other cells' values are discarded (or user is warned)
**And** the grid rebuilds to show the merged cell
**Given** I have selected a merged cell
**When** I choose "Unmerge"
**Then** the merge is removed and the anchor cell remains with its value
**And** the grid rebuilds to show individual cells
**And** Format menu (or equivalent) includes Merge cells and Unmerge items
**And** Merge is disabled if selection is invalid (e.g., single cell, overlapping merge)
**And** Unmerge is disabled if selection is not a merged cell

### Story 11.6: Keyboard Navigation and Edge Cases for Merged Cells

As a user,
I want keyboard navigation and edge cases to work correctly with merged cells,
So that I can use the spreadsheet normally when merges are present.

**Acceptance Criteria:**

**Given** the grid has merged cells
**When** I use arrow keys to navigate
**Then** arrow keys skip covered cells and land on the anchor or next unmerged cell
**And** Tab/Enter navigation respects merged regions
**And** formula references to merged ranges resolve to the anchor (e.g., `A1` for A1:C1)
**And** CSV export outputs the anchor value only for merged cells
**And** CSV import does not create merges (data goes to individual cells)
**And** existing Playwright tests pass (or are updated for merge-aware behavior)

---

## Epic 12: Named Styles (Title, Header, Total)

**Goal:** Users can apply named styles (Title, Header, Total) to cells and ranges for consistent, reusable formatting.

**User Outcome:** Users can format spreadsheets with semantic styles that improve readability and match professional spreadsheet conventions.

**Source:** Technical research `research/technical-named-styles-research-2026-02-23.md`

**Architecture requirements covered:**
- Style registry or index-based model (OOXML-style)
- Separation of style storage from content
- Title, Header, Total as built-in named styles
- Apply styles to cells and ranges

### Story 12.1: Add Style Registry and Named Styles

**Effort:** 6–8 hours

As a developer,
I want a style registry with Title, Header, and Total named styles,
So that cells and ranges can reference styles by ID and the foundation for style picker UI is in place.

**Acceptance Criteria:**

**Given** the spreadsheet model has no cell formatting today
**When** I implement the style registry
**Then** a shared style registry holds font, fill, border, and alignment definitions
**And** cells reference styles by index (styleId) rather than inline properties
**And** built-in named styles exist: Title, Header, Total
**And** styles can be applied to individual cells and ranges via API
**And** the .sheet file format is extended to persist styles (version bump)
**And** Go unit tests cover style registry, application, and save/load

### Story 12.2: Add Style Picker UI

**Effort:** 4–6 hours

As a user,
I want a style picker (dropdown or toolbar) to apply Title, Header, or Total to my selection,
So that I can format cells without using the API directly.

**Acceptance Criteria:**

**Given** Story 12.1 is complete (style registry and API exist)
**When** I select one or more cells
**Then** I can open a style picker (Format menu, toolbar, or context menu)
**And** the picker shows Title, Header, Total as options
**And** choosing an option applies that style to the selected range
**And** the grid renders styled cells (font, fill, border, alignment)
**And** Playwright tests cover style picker interaction

### Story 12.3: Style Optimization and Format Cleanup

**Effort:** 4–6 hours

As a developer,
I want format cleanup for unused cells and optional theme support,
So that large workbooks remain performant and styling stays maintainable.

**Acceptance Criteria:**

**Given** Stories 12.1 and 12.2 are complete
**When** cells retain formatting after data deletion
**Then** we can identify and remove unnecessary formatted cells (format cleanup)
**And** formatting is applied only to used ranges where practical
**And** (Optional) theme support allows changing colors/fonts across styles

---

## Epic 13: Spreadsheet UX & Polish

**Goal:** Improve spreadsheet usability with row/column operations, context menu, alignment, and bug fixes.

**User Outcome:** Users get Excel-like conveniences (insert rows/cols, context menu, alignment, quote prefix) and fewer bugs.

**Source:** `planning-artifacts/todo-2026-03-01.md`

### Story 13.1: Row/Column Selection and Insert

**Effort:** 4–6 hours

As a user,
I want to select a row or column and insert an empty row/column before it,
So that I can add data without manually shifting cells.

**Acceptance Criteria:**

**Given** I have a spreadsheet with data
**When** I select a row (or column)
**Then** I can trigger "Insert row above" (or "Insert column before")
**And** an empty row (or column) is inserted at the selection
**And** existing data shifts down (or right) as expected
**And** the selection moves to the new row/column

### Story 13.2: Context Menu (Right-Click)

**Effort:** 3–4 hours

As a user,
I want a context menu when right-clicking a cell,
So that I can access common actions (copy, paste, format, etc.) quickly.

**Acceptance Criteria:**

**Given** I have selected one or more cells
**When** I right-click on the selection
**Then** a context menu appears with relevant actions
**And** actions include at least: Copy, Paste, Format (styles), Clear
**And** choosing an action executes it on the selection

### Story 13.3: Edit/Add/Delete Styles

**Effort:** 4–6 hours

As a user,
I want to edit, add, or delete named styles,
So that I can customize formatting beyond the built-in Title, Header, Total.

**Acceptance Criteria:**

**Given** Story 12.x style registry exists
**When** I open a style management UI (e.g. Format → Manage Styles)
**Then** I can edit existing style definitions (font, fill, border, alignment)
**And** I can add new named styles
**And** I can delete custom styles (not built-in)
**And** changes apply to cells using those styles

### Story 13.4: UI Layout Compact (Fold Top Rows)

**Effort:** 2–3 hours

As a user,
I want the top toolbar compacted into one row,
So that more vertical space is available for the grid.

**Acceptance Criteria:**

**Given** the current layout has two rows (icons, file status, cell ref, formula bar)
**When** the layout is updated
**Then** these elements fold into a single compact row
**And** all functionality remains accessible
**And** the grid gains vertical space

### Story 13.5: Cell Hover for Long Content

**Effort:** 1–2 hours

As a user,
I want to see full content on hover when it doesn't fit in the cell,
So that I can read long error messages or text without editing.

**Acceptance Criteria:**

**Given** a cell displays truncated content (e.g. #ERROR with long message)
**When** I hover over the cell
**Then** a tooltip shows the full content
**And** the tooltip dismisses when I move the cursor away

### Story 13.6: Bug Fixes (Formula, Merge, Scroll)

**Effort:** 2–4 hours

As a developer,
I want critical bugs fixed,
So that the spreadsheet behaves correctly.

**Acceptance Criteria:**

**Given** the current implementation
**When** I enter "=" alone in a cell
**Then** it is rejected or treated as invalid (not as formula)
**When** I try to merge a range where more than one cell has content
**Then** merge is refused with a clear message
**When** I scroll down and new rows are added at the bottom
**Then** the view does not reset to the top

### Story 13.7: Quote Prefix for Text

**Effort:** 1–2 hours

As a user,
I want to prefix a value with "'" to force text format (Excel-style),
So that numbers like "001" or "3.14" display as text without conversion.

**Acceptance Criteria:**

**Given** I enter a value starting with "'" (e.g. '001)
**When** I confirm the cell
**Then** the cell displays the value without the leading quote
**And** the value is stored/treated as text (no numeric conversion)
**And** the leading quote is not shown in the cell

### Story 13.8: Alignment (Left/Right/Center)

**Effort:** 3–4 hours

As a user,
I want to set cell alignment (left, right, center),
So that I can format tables and headers.

**Acceptance Criteria:**

**Given** I select one or more cells
**When** I choose alignment (left, center, right) from Format menu or toolbar
**Then** the cell content aligns accordingly
**And** alignment persists in the style/cell model
**And** alignment is saved and loaded with the file

### Story 13.9: Merge Text Centering

**Effort:** 1 hour

As a user,
I want text in merged cells to be centered by default,
So that merged headers look clean.

**Acceptance Criteria:**

**Given** I merge a range of cells
**When** the merged cell has content
**Then** the content is centered within the merged region
**And** this applies to new merges and existing merged cells

### Story 13.10: RTL Support (Optional)

**Effort:** 4–6 hours

As a user,
I want right-to-left spreadsheet layout for RTL languages (e.g. Hebrew),
So that I can work in my language naturally.

**Acceptance Criteria:**

**Given** RTL mode is enabled (e.g. via setting or locale)
**When** the grid renders
**Then** columns flow right-to-left
**And** text alignment respects RTL
**And** formula bar and UI elements adapt

---

## Epic 14: Electron Platform Upgrade

**Goal:** Upgrade Electron from the EOL 30.5.1 to a current supported version (38+), resolving the security risk and unblocking future platform features.

**User Outcome:** Users run on a secure, actively-maintained runtime. All existing functionality and tests remain intact.

**Requirements covered:**
- TD1: Upgrade Electron from EOL 30.5.1 to 38+ (blocked by Playwright CDP compat — needs testing)

**Why standalone:** Security upgrade that is self-contained. Unblocks `app.getRecentDocuments()` for dock integration improvements.

**Implementation notes:**
- Test Electron 38+ with latest stable Playwright for CDP compatibility
- Verify all Playwright tests pass with no timeouts
- Verify file dialogs work, no zombie processes
- Update `package.json` and lock files

### Story 14.1: Pilot — Electron Upgrade Compatibility

As a developer,
I want to upgrade Electron to the latest stable version in a limited test and verify a representative subset of tests still pass,
So that I can confirm compatibility before committing to the full upgrade.

**Acceptance Criteria:**

**Given** Electron is bumped to the latest stable version (38+) in `package.json`
**When** `npm install` completes
**Then** the app launches without errors (`npm start`)

**Given** the upgraded Electron is installed
**When** `npm run test:electron` is run from Claude Code CLI in the Cursor terminal
**Then** a representative subset of tests pass: at least smoke, basic cell editing, file operations, and one menu test
**And** no `bad option` or CDP timeout errors appear

**Given** the upgraded Electron is installed
**When** the GitHub Actions CI workflow runs
**Then** the representative subset of tests passes in CI headlessly
**And** the CI log shows no version-related errors

**Given** the pilot succeeds
**When** this story is done
**Then** a brief note is added to this story documenting any API breakages found and how they were fixed (or deferred to Story 14.2)

---

### Story 14.2: Complete Electron Upgrade

As a developer,
I want the full Electron upgrade completed with all tests green,
So that the app runs on a secure, actively-maintained runtime.

**Acceptance Criteria:**

**Given** the pilot (Story 14.1) identified any breakages
**When** all API and behavior changes are addressed
**Then** `npm run test:electron` passes fully from Claude Code CLI in the Cursor terminal
**And** `npm run test` passes in CI (GitHub Actions)
**And** the `package.json` `electron` version is ≥ 38.0.0

**Given** the upgrade is complete
**When** `npm run build` is run
**Then** a valid `.app` bundle is produced in `dist/`

---

### Story 14.3: Port Chromium Click Tests to Electron

As a developer,
I want the 5 real-click tests (select, double-click edit, shift+click range) ported from the Chromium project to the Electron project,
So that the `chromium-web` project and `test_ui_interactions.spec.js` can be removed entirely.

**Acceptance Criteria:**

**Given** the 5 tests in `test_ui_interactions.spec.js` (single click selects, click updates formula bar, double click enters edit mode, shift+click extends selection, click away saves edit)
**When** each is ported to the Electron project
**Then** all 5 pass reliably in `npm run test:electron` with no flakiness (passes on 3 consecutive runs)

**Given** the Chromium project is removed from `playwright.config.js`
**When** `npm test` is run
**Then** only the electron project runs and all tests pass
**And** `test_ui_interactions.spec.js` and `playwright_tests/global-setup.js` and `playwright_tests/global-teardown.js` are deleted (or repurposed if still needed)

**Given** the CI workflow references `chromium` browser install
**When** the Chromium project is removed
**Then** the CI step `npx playwright install --with-deps chromium` is removed or replaced with Electron-only setup

---

### Story 14.4: Update Build and CI Configuration

As a developer,
I want the build pipeline and CI updated for the new Electron version,
So that packaged `.app` builds and all automated checks reflect the upgrade.

**Acceptance Criteria:**

**Given** Electron 38+ is installed and all tests ported (Stories 14.2, 14.3)
**When** `npm run build` is run
**Then** a valid `.app` bundle is produced in `dist/`
**And** `lipo -info` on the bundled Electron binary confirms the expected architecture(s)

**Given** the GitHub Actions CI workflow
**When** a PR is opened
**Then** the workflow installs the correct Electron version, runs `npm test`, and all tests pass
**And** the workflow does not reference the old Electron 30.5.1 version anywhere

**Given** `package.json` and `package-lock.json` are updated
**When** `npm install` is run on a clean checkout
**Then** the installed Electron version is ≥ 38.0.0 with no peer-dependency warnings

---

## Epic 15: Undo / Redo

**Goal:** Users can undo any reasonable editing operation, eliminating fear of accidental changes.

**User Outcome:** Cmd+Z undoes the last edit (cell value, format, insert/delete row/col). Cmd+Shift+Z redoes it. History is reasonable (e.g., last 100 operations).

**Requirements covered:**
- FB6: Unlimited undo for "reasonable" operations

**Why standalone:** Architecturally invasive (requires command pattern) but delivers complete, self-contained value. Explicitly deferred from Phase 1 in the PRD.

**Implementation notes:**
- Implement command pattern in Go backend or frontend (TBD in story design)
- Track edit operations: set cell, clear cell, insert/delete row/col, paste
- Expose undo/redo via IPC + keyboard shortcuts Cmd+Z / Cmd+Shift+Z
- Wire to Edit menu items

### Story 15.1: Command Pattern Infrastructure

As a developer,
I want a command pattern with Do/Undo support and a bounded history stack,
So that all mutating operations can be reversed reliably.

**Acceptance Criteria:**

**Given** the command pattern is implemented
**When** any mutating operation is executed
**Then** it is wrapped in a `Command` with `Do()` and `Undo()` methods and pushed onto the history stack

**Given** the history stack has reached its cap (100 operations)
**When** a new command is pushed
**Then** the oldest command is dropped from the stack

**Given** a command is undone
**When** another command is executed (not redo)
**Then** the redo stack is cleared (standard undo/redo branching behavior)

**Given** the history stack
**When** the spreadsheet file is closed or a new file is opened
**Then** the history stack is cleared

**Given** Go unit tests for the command infrastructure
**When** the tests run
**Then** push, undo, redo, cap enforcement, and redo-stack-clear behaviors all pass

---

### Story 15.2: Undo/Redo for Cell Edits and Deletion

As a user,
I want to undo and redo cell value changes and deletions with Cmd+Z / Cmd+Shift+Z,
So that I can recover from accidental edits or deletions instantly.

**Acceptance Criteria:**

**Given** a user types a new value into a cell and presses Enter
**When** the user presses Cmd+Z
**Then** the cell reverts to its previous value
**And** the grid updates immediately

**Given** a user deletes a cell's contents (Delete or Backspace)
**When** the user presses Cmd+Z
**Then** the deleted content is restored in the cell

**Given** a user edits multiple cells in sequence
**When** the user presses Cmd+Z repeatedly
**Then** each edit is undone in reverse order, one per key press

**Given** an undo has been performed
**When** the user presses Cmd+Shift+Z
**Then** the undone change is reapplied (redo)

**Given** the Edit menu
**When** undo is available
**Then** "Undo" is enabled and shows the operation name (e.g. "Undo Set Cell")
**And** "Redo" is enabled when a redo is available, disabled otherwise
**And** undo/redo toolbar buttons are visible and reflect the same enabled/disabled state

**Given** the history is empty (no edits made)
**When** the user presses Cmd+Z
**Then** nothing happens and "Undo" in the Edit menu is disabled

---

### Story 15.3: Undo/Redo for Structural Operations

As a user,
I want to undo and redo row/column insertions, deletions, and paste operations,
So that structural mistakes are as easy to recover from as cell edits.

**Acceptance Criteria:**

**Given** a user inserts a row
**When** the user presses Cmd+Z
**Then** the inserted row is removed and all cells return to their pre-insert positions

**Given** a user deletes a row
**When** the user presses Cmd+Z
**Then** the deleted row is restored with all its original cell values

**Given** a user inserts or deletes a column
**When** the user presses Cmd+Z
**Then** the operation is reversed correctly (column restored or removed)

**Given** a user pastes a rectangular range
**When** the user presses Cmd+Z
**Then** all pasted cells revert to their values before the paste

**Given** structural operations are undone/redone
**When** formula cells reference rows/columns affected by the operation
**Then** formula results update correctly to reflect the restored state

---

### Story 15.4: Undo/Redo for Formatting

As a user,
I want to undo and redo formatting changes (styles, alignment, merge/unmerge),
So that accidental formatting changes are as recoverable as data changes.

**Acceptance Criteria:**

**Given** a user applies a named style to a cell or range
**When** the user presses Cmd+Z
**Then** the previous style is restored

**Given** a user changes cell alignment (left/center/right)
**When** the user presses Cmd+Z
**Then** the previous alignment is restored

**Given** a user merges cells
**When** the user presses Cmd+Z
**Then** the cells are unmerged and their original individual values restored

**Given** a user unmerges cells
**When** the user presses Cmd+Z
**Then** the cells are re-merged in their previous state

**Given** a sequence of mixed operations (cell edit, format change, structural change)
**When** the user presses Cmd+Z repeatedly
**Then** all operations are undone in correct reverse order regardless of type

### Story 15.5: Formula Engine — AST as Canonical Runtime Representation

As a developer and user,
I want the formula engine to use a parsed AST as the canonical runtime representation,
So that structural operations produce correct results, `#REF!` displays properly, and formulas never need to be re-parsed unnecessarily.

**Background / Bug:**
`formula_shift.go` rewrites formula strings by regex-substituting `#REF!` as literal text when a referenced cell is deleted. The lexer has no `#REF!` token, so re-parsing fails. The cell shows a parse error instead of `#REF!`. Undo also cannot restore the original reference because original coordinates are discarded. Root cause: `Cell.Value` (string) is being used as both storage and mutable intermediate state — corrupting it breaks evaluation, dependency tracking, and undo.

**Acceptance Criteria:**

**Given** a formula references a cell in a row/column that is deleted
**When** the formula is evaluated
**Then** the cell displays `#REF!` (not a parse error string), with `#REF!` propagating through arithmetic

**Given** a formula references a range where deletion collapses it to zero size
**When** evaluated
**Then** the cell displays `#REF!`

**Given** a formula references a range where an interior row/column is deleted (range doesn't collapse)
**When** evaluated
**Then** the range shrinks by one and evaluates correctly — no `#REF!`

**Given** a formula contains a `#REF!` reference and the user presses Cmd+Z
**When** the deletion is undone
**Then** the formula is fully restored with valid cell references

**Given** any sequence of insert/delete operations
**When** `Cell.Value` is inspected at any point
**Then** it is always a valid, parseable formula string — never contains `#REF!` as literal text

**Given** a sheet is saved and reloaded
**When** formulas are re-parsed from `Cell.Value` strings on load
**Then** `#REF!` cells display correctly and all formula refs are correct

### Story 15.6: EvaluateFormula Returns Value Instead of String

As a developer,
I want `EvaluateFormula` to return a typed `Value` instead of `(string, bool, error)`,
So that callers never need to string-construct or re-parse evaluation results, and error types are handled via the type system rather than string conventions.

**Background:**
`EvaluateFormula` currently serialises its result to a string and returns a `bool` flag to distinguish errors. Callers then call `cell.SetError(result)` or `cell.SetComputed(result)`, which re-parses the string. This is a string round-trip where a typed `Value` is available. It also requires `SetError` to special-case strings that already start with `#` to avoid double-prefixing (introduced in Story 15.5 as a temporary fix).

**Acceptance Criteria:**

**Given** `EvaluateFormula` is called with any formula
**When** it returns
**Then** it returns `(model.Value, error)` — callers switch on `ErrorValue`, `RefErrorValue`, or a normal value

**Given** a formula evaluates to `#REF!`
**When** the controller sets the cell result
**Then** `cell.Computed == "#REF!"` without any string manipulation or special-casing in `SetError`

**Given** all existing formula evaluation tests
**When** run after this refactor
**Then** all pass with no behaviour change

---

## Epic 16: Data Safety & File Integrity

**Goal:** Users can trust their data is never lost or corrupted during save, can open files directly from the OS, and can view files safely in read-only mode.

**User Outcome:** Files are written atomically (no partial-write corruption), the app handles OS-level file open (CLI/Finder), and users can open a file without accidentally editing it.

**Requirements covered:**
- TD2: Fix `RecalculateAll()` stub in `model/spreadsheet.go` (sets #PENDING instead of recalculating)
- FB1: Open CSV/sheet files from CLI or double-click "Open With…" (saves as .sheet)
- FB7: Atomic file writes — minimize risk of data loss when modifying/writing files
- FB2: Read-only / view mode flag

**Why standalone:** Data integrity is foundational. None of these depend on later epics.

**Implementation notes:**
- Implement atomic write (write to temp file, rename on success)
- Handle `open-file` Electron event and CLI argv for file paths at launch
- Fix `RecalculateAll()` to perform actual recalculation
- Add read-only mode: disable editing UI, show indicator, wire to open dialog option

### Story 16.1: Atomic File Writes

As a user,
I want my spreadsheet files written safely to disk,
So that a crash or error during save never leaves a corrupt or incomplete file.

**Acceptance Criteria:**

**Given** a user triggers Save (Cmd+S or Save As)
**When** the file is written
**Then** the data is written to a temporary file first, then renamed to the target path atomically
**And** if the write fails mid-way, the original file remains intact and unmodified

**Given** the save operation completes successfully
**When** the file is inspected
**Then** it contains all the expected cell data with no truncation

**Given** a Go unit test simulates a write failure (e.g. disk full)
**When** the atomic write is attempted
**Then** the original file is not modified
**And** an error is returned to the caller

---

### Story 16.2: Fix RecalculateAll() Stub

As a user,
I want all formulas to recalculate correctly when a file is loaded or a full recalc is triggered,
So that I see accurate computed values rather than `#PENDING` placeholders.

**Research Reference:** `_bmad-output/planning-artifacts/research/algorithmic-research-chatgpt.md`
Covers: dependency DAG construction, topological sort for calculation chain, dirty-cell incremental recomputation, and parallel evaluation (not immediately relevant — only at very large scale). HyperFormula source and IronCalc are the most useful open-source references for the topsort implementation.

**Acceptance Criteria:**

**Given** a spreadsheet file with formulas is opened
**When** `RecalculateAll()` is called during load
**Then** all formula cells display their correct computed values
**And** no cell shows `#PENDING`

**Given** a spreadsheet with chained formula dependencies (e.g. B1=A1+1, C1=B1+1)
**When** `RecalculateAll()` is called
**Then** all dependent cells are evaluated in correct topological order
**And** results match the values produced by incremental recalculation

**Given** a circular reference exists in the spreadsheet
**When** `RecalculateAll()` is called
**Then** the circular reference cells display `#ERROR` (not `#PENDING`)
**And** non-circular cells still compute correctly

**Given** the existing Go unit tests
**When** `RecalculateAll()` is invoked in tests
**Then** all tests pass with no regressions

---

### Story 16.3: Open Files from CLI and Finder "Open With"

As a user,
I want to open `.sheet` and CSV files by double-clicking them in Finder or passing a path on the command line,
So that I can launch GoSheet directly into a file without going through the welcome screen.

**Acceptance Criteria:**

**Given** a `.sheet` file is double-clicked in Finder (or opened via "Open With > GoSheet")
**When** the app launches or is already running
**Then** the file opens in the spreadsheet view
**And** the file status bar shows the correct file path

**Given** the app is launched from the terminal with a file path argument (e.g. `open GoSheet.app --args /path/to/file.sheet`)
**When** the app starts
**Then** the specified file is loaded directly, bypassing the welcome screen

**Given** a CSV file is opened via CLI or "Open With"
**When** it loads
**Then** the CSV data is imported into a new spreadsheet
**And** the file status shows "Unsaved changes" (since it hasn't been saved as .sheet yet)

**Given** the file path provided does not exist
**When** the app attempts to open it
**Then** a clear error message is shown
**And** the app falls back to the welcome screen

---

### Story 16.4: Read-Only / View Mode

As a user,
I want to open a file in read-only mode,
So that I can view its contents without risk of accidentally modifying it.

**Acceptance Criteria:**

**Given** a user opens a file in read-only mode (via an "Open Read-Only" option in the file open dialog or menu)
**When** the file loads
**Then** all cell editing is disabled (typing, paste, delete have no effect)
**And** a visible "Read-Only" indicator is shown in the UI (e.g. in the status bar)

**Given** the app is in read-only mode
**When** the user attempts to trigger Save (Cmd+S)
**Then** no save occurs
**And** a brief notification or tooltip explains the file is read-only

**Given** the app is in read-only mode
**When** the user selects "Edit > Select All" or navigates cells
**Then** navigation and selection work normally (read-only does not block viewing)

**Given** a file is opened in read-only mode
**When** the user chooses "Save As" (Cmd+Shift+S)
**Then** Save As is permitted (creates a new writable copy)
**And** the new file opens in normal (editable) mode

---

### Story 16.5: Remove Fixed Port Dependency

As a developer,
I want the Go server and Electron host to communicate over a named pipe or ephemeral socket instead of a hardcoded TCP port,
So that multiple GoSheet instances can run simultaneously without port conflicts, and non-human (agent) API clients can connect locally without guessing a port number.

**Acceptance Criteria:**

**Given** the app is launched normally
**When** the Go server starts
**Then** it listens on a named pipe or OS-assigned ephemeral socket (not port 3000)
**And** the Electron main process receives the address from the server (e.g. via stdout or a known temp path) and passes it to the renderer

**Given** two GoSheet instances are launched at the same time
**When** both are running
**Then** each uses a separate socket/pipe with no port collision

**Given** the existing Playwright test suite
**When** tests run
**Then** all tests pass with no changes to test logic (the test helpers discover the address automatically)

**Relevant files:** `server/main.go`, `electron/main.js`

**Implementation note:** Once the port is ephemeral, the port-conflict reason for `app.requestSingleInstanceLock()` is gone. However, Story 16.7 re-introduces the lock (with a `second-instance` handler) for multi-window file forwarding — new Electron processes spawned by Finder forward their file path to the running instance.

---

### Story 16.6: Refactor Functions Exceeding Complexity Threshold

As a developer,
I want all Go functions with cyclomatic complexity >20 refactored to ≤20,
So that the codebase stays within the documented "must fix" threshold and future changes to these functions are less risky.

**Background:** The complexity baseline (established Story 10.3) sets a hard ceiling of 20. Epics 13 and 15 introduced structural operations, formula shifting, and cycle propagation that pushed 5 functions above this threshold. The threshold is enforced by `make complexity` (reports >15; violations >20 listed separately).

**Current violations (as of 2026-03-07):**

| Complexity | Function | File |
|---|---|---|
| 30 | `(*AppController).recalculateAllFormulas` | `controller/app.go` |
| 26 | `shiftRange` | `model/formula_shift.go` |
| 25 | `(*Server).HandleCSVExport` | `api/handlers.go` |
| 21 | `(*Spreadsheet).DeleteColumn` | `model/spreadsheet.go` |
| 21 | `(*Server).HandleGetAllCells` | `api/handlers.go` |
| 20 | `(*Spreadsheet).DeleteRow` | `model/spreadsheet.go` |

**Acceptance Criteria:**

**Given** `make complexity` is run after refactoring
**When** results are inspected
**Then** no function has cyclomatic complexity >20
**And** all existing Go tests still pass with no behaviour changes

**Given** each refactored function
**When** reviewed
**Then** extracted helpers are focused, named clearly, and covered by the existing test suite (no new behaviour added)

**Given** the complexity baseline document
**When** the story is complete
**Then** `_bmad-output/implementation-artifacts/complexity-baseline.md` is updated to reflect the new measurements

**Relevant files:** `controller/app.go`, `model/formula_shift.go`, `api/handlers.go`, `model/spreadsheet.go`

---

### Story 16.7: Multi-Window Support

As a user,
I want each file I open from Finder, CLI, or the Recent Files menu to open in its own window,
So that I can work with multiple spreadsheets simultaneously without one replacing the other.

**Background:** Currently GoSheet is single-window — opening a file replaces the current one. After Story 16.5 introduces ephemeral ports, each window has its own Go server. Story 16.7 completes the picture: Finder double-clicks and CLI launches open a new window in the existing process rather than spawning a duplicate process. This requires re-introducing `app.requestSingleInstanceLock()` with a `second-instance` handler that forwards the file path to the running instance. The `open-file` event continues to handle the packaged-app/registered file-association path.

**Acceptance Criteria:**

**Given** a GoSheet window is open with a file
**When** the user double-clicks a different `.sheet` file in Finder
**Then** a second GoSheet window opens with that file
**And** the first window remains open and unaffected

**Given** a GoSheet window is open
**When** the user opens a file via File → Open or File → Open Recent
**Then** the file opens in a new window
**And** the existing window remains open (no unsaved-changes prompt for the existing window)

**Given** GoSheet is launched from the CLI with a file path argument
**When** a GoSheet instance is already running
**Then** a new window opens with the specified file in the existing process
**And** the new launch exits immediately after forwarding the file path via `second-instance`

**Given** the user closes all windows
**When** the last window is closed
**Then** the app quits (existing macOS behaviour preserved)

**Given** a new window is opened
**When** the window initialises
**Then** it has its own Go server child process on its own ephemeral port (per Story 16.5)
**And** closing the window terminates that window's Go server process

**Relevant files:** `electron/main.js` (window creation, `open-file` handler, `startGoServer`), `electron/menu.js` (File → Open / Recent wiring)

**Implementation note:** File path routing uses two complementary mechanisms: `second-instance` (primary — dev mode and unregistered file associations; new process forwards argv to running instance) and `open-file` (packaged builds with registered `.sheet` association). Both call `createWindow(filePath)` with a dedup check. `requestSingleInstanceLock` must be skipped in `NODE_ENV=test` to avoid breaking Playwright (each test run launches a fresh instance).

---

### Story 16.8: Unified Logging (BE + FE + Main Process)

As a developer,
I want all log output — Go server, Electron main process, and renderer — to share a consistent format and destination,
So that I can diagnose issues across the full stack from a single log stream.

**Acceptance Criteria:**

**Given** the app is launched with `--verbose`
**When** any of the three layers (Go server, Electron main, renderer) emits a log
**Then** all lines share the format: `[ISO-timestamp] [LEVEL] [SOURCE] message`
**And** all lines appear in the terminal and, if `--log-file=<path>` is set, in the log file

**Given** the app is launched without `--verbose`
**When** a renderer `console.error` or `console.warn` fires
**Then** it is still forwarded to the main process log (errors/warnings always visible, debug logs gated behind `--verbose`)

**Given** `--log-file=<path>` is provided
**When** the app runs
**Then** all log output is appended to the file with timestamps (existing `--log-file` behaviour preserved)

**Relevant files:** `electron/main.js` (renderer `console-message` forwarding, Go stdout/stderr pipes), `server/main.go` (log format)

---

## 
: Selection & Range Operations

**Goal:** Users can select contiguous rectangular ranges naturally, copy/paste them, and navigate to precise ranges by address.

**User Outcome:** Multi-cell selection works intuitively via shift-click, drag, or typed address. Copy/paste operates on the full selection. "Select All" is replaced by a proper range address box.

**Requirements covered:**
- FB3: Row/column select aesthetics — remove cell borders when row/col is selected
- FB4: Select range naturally (click-drag or shift-click)
- FB5: Copy/paste range, row, or column (fixes current single-cell-only bug)
- FB9: Replace useless "Select All" with range address box (type e.g. A1:D7 to select)

**Why standalone:** Pure UI/interaction layer improvement. No dependency on later epics.

**Implementation notes:**
- Implement shift-click and click-drag range selection in `frontend/spreadsheet.js`
- Update copy/paste handlers to serialize/deserialize full rectangular selection as TSV
- Add range address box (name box) to toolbar/formula bar area
- Remove or repurpose "Select All" menu item
- Update row/col header highlight styles to remove inner cell borders

### Story 17.1: Range Selection (Shift-Click and Click-Drag)

As a user,
I want to select a rectangular range of cells by shift-clicking or dragging,
So that I can work with multiple cells at once without clicking each one individually.

**Acceptance Criteria:**

**Given** a user clicks a cell then shift-clicks another cell
**When** the shift-click is registered
**Then** the rectangular range between the two cells is selected and visually highlighted
**And** the range address is shown in the address box (e.g. `A1:D7`)

**Given** a user clicks and drags across cells
**When** the drag completes
**Then** the rectangle swept by the drag is selected
**And** the selection updates live as the drag proceeds

**Given** a range is selected
**When** the user presses an arrow key (without Shift)
**Then** the selection collapses to a single cell in the arrow direction

**Given** a row or column header is clicked
**When** the click is registered
**Then** the entire row or column is selected
**And** shift-clicking a second header extends the selection to cover both rows/columns

---

### Story 17.2: Row/Column Select Aesthetics

As a user,
I want the selected row or column to look clean and intentional,
So that I can clearly see what is selected without visual noise from cell borders.

**Acceptance Criteria:**

**Given** a full row is selected (via row header click)
**When** the grid renders
**Then** inner vertical cell borders within the selected row are suppressed
**And** the row highlight is a solid band, not a grid of individual boxes

**Given** a full column is selected (via column header click)
**When** the grid renders
**Then** inner horizontal cell borders within the selected column are suppressed
**And** the column highlight is a solid band

**Given** a rectangular range (not full row/col) is selected
**When** the grid renders
**Then** cell borders within the selection remain visible (only full row/col gets the clean look)

**Given** the selection is cleared (single cell clicked)
**When** the grid renders
**Then** all cell borders return to their normal appearance

---

### Story 17.3: Copy/Paste Rectangular Range

As a user,
I want to copy a selected range and paste it to another location,
So that I can duplicate blocks of data efficiently.

**Acceptance Criteria:**

**Given** a rectangular range is selected
**When** the user presses Cmd+C
**Then** all cell values in the range are copied to the clipboard as tab-separated values (TSV) with newlines between rows

**Given** the clipboard contains a copied range
**When** the user selects a target cell and presses Cmd+V
**Then** the range is pasted starting at the target cell, filling rightward and downward to match the copied dimensions

**Given** a single row is selected and copied
**When** pasted at a target cell
**Then** the row data fills horizontally from the target cell

**Given** a single column is selected and copied
**When** pasted at a target cell
**Then** the column data fills vertically from the target cell

**Given** the pasted range would extend beyond the current grid dimensions
**When** the paste occurs
**Then** the grid expands to accommodate the pasted data

---

### Story 17.4: Range Address Box — Type to Select

As a user,
I want to type a range address (e.g. `A1:D7`) to instantly select that rectangle,
So that I can navigate to and select precise ranges without dragging.

**Acceptance Criteria:**

**Given** a range address box is visible in the toolbar area
**When** the user clicks it and types a valid range address (e.g. `B3:F10`) and presses Enter
**Then** the specified range is selected and the grid scrolls to show it

**Given** the user types a single cell address (e.g. `C5`) in the address box and presses Enter
**When** Enter is pressed
**Then** the grid navigates to that cell and selects it

**Given** the user types an invalid address (e.g. `ZZZ999:ABC`) and presses Enter
**When** Enter is pressed
**Then** the input is highlighted as invalid and the current selection is unchanged

**Given** a range is selected (via click, drag, or shift-click)
**When** the selection changes
**Then** the address box updates to show the current range (e.g. `A1:D7` or just `B3` for a single cell)

**Given** the "Select All" menu item previously existed in Edit menu
**When** this story is complete
**Then** it is removed or replaced with a "Go to Range…" menu item that focuses the address box

---

### Story 17.5: Open-Ended Row/Column Range Selection

As a user,
I want row and column selections to use open-ended ranges (like Excel's `1:3` or `A:C`),
So that the selection always spans the full row/column regardless of how large the grid grows.

**Acceptance Criteria:**

**Given** a user clicks a row header
**When** the selection is applied
**Then** `appState.selectionRange` stores an open-ended row range (`endCol: Infinity`)
**And** the address box shows `1:1` (row number only, no column letters)

**Given** a user clicks a column header
**When** the selection is applied
**Then** `appState.selectionRange` stores an open-ended column range (`endRow: Infinity`)
**And** the address box shows `A:A` (column letter only, no row numbers)

**Given** an open-ended row range `1:3` is active
**When** the grid expands
**Then** the row highlight automatically covers all columns in the new grid without re-application logic

**Given** an open-ended column range `A:C` is active
**When** the grid expands
**Then** the column highlight automatically covers all rows in the new grid without re-application logic

**Given** a row or column range is active
**When** the address box is updated
**Then** it shows Excel-style notation: `1:1` for a single row, `2:5` for rows 2–5, `A:A` for a single column, `B:D` for columns B–D

---

## Epic 18: Formula Editing Enhancements

**Goal:** Users can click cells or drag ranges while editing a formula to insert references naturally.

**User Outcome:** While typing a formula, clicking a cell inserts its reference (e.g., `A3`) at the cursor position — matching the expected spreadsheet UX from Excel/Google Sheets.

**Requirements covered:**
- FB8: Select cells/ranges for inclusion in formula while editing

**Why standalone:** Isolated interaction enhancement to the formula bar editing flow.

**Implementation notes:**
- Detect when formula bar / cell is in edit mode with a leading `=`
- On cell click during edit mode: insert cell reference at cursor instead of navigating
- Support range selection (drag) during edit mode to insert range reference (e.g., `A1:B3`)
- Highlight referenced cells/ranges visually while editing

### Story 18.1: Click-to-Insert Cell Reference While Editing Formula

As a user,
I want to click a cell while editing a formula to insert its reference at the cursor,
So that I can build formulas by pointing rather than typing cell addresses manually.

**Acceptance Criteria:**

**Given** a cell is in edit mode with a formula starting with `=`
**When** the user clicks any other cell
**Then** the clicked cell's address (e.g. `B3`) is inserted at the current cursor position in the formula
**And** the formula edit mode remains active (the click does not commit or cancel the formula)

**Given** a formula is being edited and a cell reference is inserted by clicking
**When** the user clicks a different cell
**Then** the previously inserted reference is replaced with the new cell's address
**And** if the cursor has moved past the reference (e.g. user typed an operator after it), a new reference is appended at the cursor

**Given** a cell is in edit mode without a leading `=` (plain text entry)
**When** the user clicks another cell
**Then** normal navigation occurs (edit is committed, new cell is selected)

**Given** a cell reference is inserted by clicking
**When** the formula is committed (Enter or Tab)
**Then** the formula evaluates correctly using the clicked cell's value

---

### Story 18.2: Drag-to-Insert Range Reference While Editing Formula

As a user,
I want to drag across cells while editing a formula to insert a range reference,
So that I can reference ranges like `B2:D5` without typing the address manually.

**Acceptance Criteria:**

**Given** a cell is in edit mode with a formula starting with `=`
**When** the user clicks and drags across a rectangular range of cells
**Then** the range address (e.g. `B2:D5`) is inserted at the cursor position in the formula
**And** the dragged cells are highlighted with a distinct "reference selection" color (different from normal selection)

**Given** a range reference is inserted by dragging
**When** the drag ends
**Then** the formula editor cursor is positioned immediately after the inserted range reference
**And** the user can continue typing (e.g. add `+` or `)`)

**Given** a range reference has been inserted and the user drags again
**When** the second drag completes
**Then** the previous range reference at the cursor is replaced with the new range
**And** if the cursor has moved past the reference, a new range reference is inserted at the new cursor position

**Given** a range reference is inserted by dragging
**When** the formula is committed (Enter or Tab)
**Then** the formula evaluates correctly using the full range

---

## Epic 19: Formula Reference Shift & UI Menu Cleanup

**Goal:** Pasting ranges with formulas shifts cell references correctly; the Insert menu is folded into Edit; the toolbar is rationalized to reflect actual style capabilities.

**User Outcome:** Copy/paste of formula-containing ranges behaves like Excel/Google Sheets (references adjust relative to destination). The menu bar is less cluttered (no separate Insert menu). The toolbar reflects the real named-style system rather than showing ad-hoc alignment controls.

**Requirements covered:**
- FB: Copy/pasted formulas shift references relative to paste destination
- FB: Fold Insert menu into Edit menu (Insert Row Above/Below, Insert Column Left/Right)
- FB: Toolbar shows style buttons instead of alignment buttons; style buttons are dynamic (reflect named styles)

**Why standalone:** Three tightly related UI/UX polish items. Formula ref shift is a correctness bug with well-defined scope (AST walk + offset). Menu cleanup and toolbar are cosmetic/structural changes with no backend impact.

**Implementation notes:**
- Formula ref shift: walk the formula AST on paste, offset each `CellRef` and `RangeRef` node by `(destRow - srcRow, destCol - srcCol)`; update both `Raw` and `Computed` after re-evaluation; reuse existing `ShiftFormula` infrastructure from Undo/Redo (Epic 15.5) if applicable
- Insert menu fold: move "Insert Row Above", "Insert Row Below", "Insert Column Left", "Insert Column Right" into the Edit menu (below the cut/copy/paste group); remove the Insert menu entirely; update keyboard shortcuts if any
- Toolbar: remove the three alignment buttons (Left/Center/Right); add named-style buttons that are generated dynamically from the style registry; each button renders its own style as a preview (font weight, color, etc.); selecting a button applies that style to the current selection

---

### Story 19.1: Formula Reference Shift on Paste

As a user,
I want copied formulas to adjust their cell references when pasted to a new location,
So that relative formulas work correctly after copy/paste like in Excel or Google Sheets.

**Acceptance Criteria:**

**Given** cell A1 contains `=B1+C1`
**When** the user copies A1 and pastes into A2
**Then** A2 contains `=B2+C2` (references shifted down by 1 row)

**Given** cell A1 contains `=B1+C1`
**When** the user copies A1 and pastes into B1
**Then** B1 contains `=C1+D1` (references shifted right by 1 column)

**Given** a range A1:A3 contains formulas `=B1`, `=B2`, `=B3`
**When** the user copies A1:A3 and pastes into C1
**Then** C1:C3 contain `=D1`, `=D2`, `=D3` respectively

**Given** a formula contains an absolute reference (e.g. `=$B$1`)
**When** the formula is pasted to a new location
**Then** the absolute reference is unchanged

**Given** a formula reference would shift outside the valid grid (row < 0 or col < 0)
**When** the paste is performed
**Then** the shifted reference is replaced with `#REF!`

**Implementation notes:**
- Walk the parsed AST for each formula cell in the copied range
- For each `CellRef` / `RangeRef` node, apply `(row + rowOffset, col + colOffset)` unless the ref uses `$` anchoring
- Re-serialize the shifted AST back to a formula string
- Trigger re-evaluation after paste
- Reuse or extend `ShiftFormula` from `model/formula.go` (introduced in Story 15.5)

---

### Story 19.2: Absolute Cell References (`$` Anchoring)

As a user,
I want to write formulas with absolute references like `$A$1`, `$A1`, or `A$1`,
So that certain references don't shift when I copy/paste the formula to a new location.

**Acceptance Criteria:**

**Given** cell B1 contains `=$A$1+C1`
**When** the user copies B1 and pastes into B2
**Then** B2 contains `=$A$1+C2` (absolute row+col stays fixed; relative col shifts)

**Given** cell B1 contains `=$A1`
**When** the user copies B1 and pastes into C3
**Then** C3 contains `=$A3` (col is fixed; row shifts by 2)

**Given** cell B1 contains `=A$1`
**When** the user copies B1 and pastes into C3
**Then** C3 contains `=B$1` (row is fixed; col shifts by 1)

**Given** a formula with `$`-anchored references is saved and reloaded
**When** the file is opened
**Then** the formula displays and evaluates correctly

**Given** the user types `=$A$1` in the formula bar
**When** the formula is committed
**Then** the formula is stored and displayed as `=$A$1` (no normalization strips the `$`)

**Implementation notes:**
- Extend the Participle lexer grammar in `model/formula.go` to accept `$`-prefixed refs: `$A1`, `A$1`, `$A$1`
- Add `AbsRow bool` and `AbsCol bool` fields to `CellRef` (and correspondingly to `Range` start/end)
- `CoordsToRef` / `RefToCoords` must preserve `$` markers when serializing back to string
- `ShiftFormulaByOffset` (Story 19.1) must skip shift on any axis marked absolute
- Normalization (`NormalizeFormula`) must preserve `$` markers
- Gob encoding: `AbsRow`/`AbsCol` bool fields are zero-value safe — no file format version bump needed

---

### Story 19.3: Fold Insert Menu into Edit Menu

As a user,
I want the Insert row/column actions in the Edit menu rather than a separate Insert menu,
So that the menu bar is less cluttered and related editing actions are grouped together.

**Acceptance Criteria:**

**Given** the app is running
**When** the user opens the Edit menu
**Then** it contains "Insert Row Above", "Insert Row Below", "Insert Column Left", "Insert Column Right" grouped below the cut/copy/paste items (separated by a divider)

**Given** the app is running
**When** the user looks at the menu bar
**Then** there is no "Insert" menu

**Given** Insert actions were previously accessible via keyboard shortcut
**When** those shortcuts existed
**Then** they continue to work from the Edit menu

**Given** Insert actions are available in the context menu (right-click)
**When** the user right-clicks a cell
**Then** the context menu still shows the Insert row/column options (unchanged)

**Implementation notes:**
- Modify `electron/menu.js` (or wherever the app menu is built): remove the Insert submenu, add the four Insert items to the Edit menu template
- Add a `{ type: 'separator' }` before the insert group in Edit
- No backend changes needed; IPC channels remain the same

---

### Story 19.4: Toolbar Style Buttons

As a user,
I want the toolbar to show buttons for my named styles instead of alignment buttons,
So that I can apply styles with one click and the toolbar reflects what styles I actually have.

**Acceptance Criteria:**

**Given** the user has named styles defined (e.g. "Header", "Emphasis")
**When** the spreadsheet view loads
**Then** the toolbar shows one button per named style, rendered with that style's visual properties (font weight, color, etc.)

**Given** the toolbar shows style buttons
**When** the user clicks a style button
**Then** that named style is applied to the current cell/range selection

**Given** no named styles are defined
**When** the spreadsheet view loads
**Then** the toolbar shows no style buttons (or a placeholder "No styles" label)

**Given** the user adds or deletes a named style
**When** the change is saved
**Then** the toolbar updates to reflect the new style list without requiring a reload

**Given** the toolbar currently shows alignment buttons (Left/Center/Right)
**When** this story is implemented
**Then** those alignment buttons are removed from the toolbar

**Implementation notes:**
- Remove the three alignment `<button>` elements from the toolbar in `frontend/index.html`
- Add a `#toolbar-styles` container that is populated dynamically from the style registry
- On `loadCells` / style registry change, re-render the style buttons: one `<button>` per style, `data-style-name` attribute, inline style reflecting the style's properties
- Click handler: apply the named style to the current selection (reuse existing apply-style IPC path)
- Alignment is still accessible via the Format menu and cell editor; this story only removes it from the toolbar

---

### Story 19.5: Fix — Address Box Cannot Select Full Row/Column

As a user,
I want to type a full row or column address (e.g. `A:A` or `3:3`) in the address box to select the entire row or column,
So that I can select whole rows/columns by address the same way I can by clicking the header.

**Acceptance Criteria:**

**Given** the address box is focused
**When** the user types a full-column address like `B:B` and presses Enter
**Then** the entire column B is selected (all cells in that column)

**Given** the address box is focused
**When** the user types a full-row address like `2:2` and presses Enter
**Then** the entire row 2 is selected (all cells in that row)

**Given** the address box is focused
**When** the user types an invalid address (e.g. `ZZ:ZZ`, `0:0`)
**Then** no selection change occurs and the address box reverts to the current selection address

**Implementation notes:**
- The address box parse logic (Story 17.4) currently only handles `A1`, `A1:B2`, and named ranges — extend it to recognize `col:col` (e.g. `B:B`) and `row:row` (e.g. `3:3`) patterns
- Map `B:B` → select all rows in column B (open-ended column selection, same as clicking the column header)
- Map `3:3` → select all columns in row 3 (open-ended row selection)
- Reuse the open-ended range selection infrastructure from Story 17.5

---

### Story 19.6: Warn Before Pasting into Non-Empty Range

As a user,
I want a confirmation prompt when pasting a range that would overwrite existing cell values,
So that I don't accidentally destroy data I hadn't intended to replace.

**Acceptance Criteria:**

**Given** the user copies a range and attempts to paste it
**When** one or more destination cells already contain a non-empty value
**Then** a confirmation dialog appears: "This will overwrite N cell(s). Continue?"

**Given** the confirmation dialog is shown
**When** the user clicks "OK" / confirms
**Then** the paste proceeds and overwrites the existing values

**Given** the confirmation dialog is shown
**When** the user clicks "Cancel" / dismisses
**Then** the paste is aborted and no cells are changed

**Given** the destination range is entirely empty
**When** the user pastes
**Then** no confirmation is shown (paste proceeds immediately)

**Implementation notes:**
- Before writing paste results in the frontend paste handler, count non-empty cells in the destination range
- If count > 0, show the existing modal confirmation (reuse `#modal-overlay` pattern)
- Only count cells with a non-empty `textContent` / value; blank cells do not trigger the prompt
- This applies to rectangular range paste (Story 17.3); single-cell paste does not require confirmation

---

## Epic 20: Agentic API Access Layer

**Goal:** AI agents (and power users via scripts) can read spreadsheet data and apply changes through a structured, safe API. The user can discard everything an agent did in one operation. No human approval step is required per-change — the agent operates autonomously and the user's safety valve is session rollback.

**User Outcome:** The user creates an agent session from the toolbar/menu, copies a bootstrap URL, hands it to an AI tool, and lets the agent do its work. Agent changes appear live in the spreadsheet. The user can roll back the entire session with one click, or save the result as-is.

**Requirements covered:**
- See full technical design: `research/technical-epic20-agentic-api-design-2026-03-14.md`
- Bearer token auth retroactively secures the existing API
- Scoped agent tokens (R/O or R/W) issued by bootstrap token exchange
- Single agent session per file at a time
- Patch operations through existing command pattern; separate agent History instance
- Commit = checkpoint (collapses agent history into single undo unit in user history)
- End session / rollback callable by both agent and user
- Audit log in userData
- Agent bootstrapped via single URL (GET returns tool definitions + workbook context)

**Why standalone:** Builds on existing Go HTTP API and command/history infrastructure. Adds new `/api/agent/*` endpoints without modifying existing ones. Retroactively adds auth to all existing endpoints. Frontend adds session management UI.

**Implementation notes:**
- See `research/technical-epic20-agentic-api-design-2026-03-14.md` for full design
- Bootstrap token generated at Go server startup, passed to Electron on fd 3 alongside port
- All existing API calls gain `Authorization: Bearer <bootstrap-token>` from the renderer
- Agent tokens scoped to `/api/agent/*` only; agent tokens rejected on `/api/file/*`
- One `History` instance per agent session; `AgentCommitCommand` collapses it into user history on commit/end
- Tool definitions in OpenAI function calling schema (cross-vendor compatible)
- Audit log: append-only JSONL in `~/Library/Application Support/GoSheet/agent-audit.jsonl`

---

### Story 20.1: Bootstrap Token & Auth Middleware

As the app,
I want all HTTP API calls to require a bearer token,
So that the Go server is protected from local port scanning and unauthorized access.

**Acceptance Criteria:**

**Given** the Go server starts
**When** it is ready to accept connections
**Then** it generates a 32-byte CSPRNG bootstrap token (base64url encoded) and writes it to fd 3 as `TOKEN=<token>` alongside `PORT=<n>`

**Given** a request arrives at any `/api/*` endpoint without an `Authorization: Bearer <token>` header
**When** the token is missing or invalid
**Then** the server returns HTTP 401

**Given** Electron reads the token from fd 3
**When** the renderer makes any API call via `api-client.js`
**Then** the request includes `Authorization: Bearer <bootstrap-token>`

**Given** the server is in test mode (`NODE_ENV=test`)
**When** any request arrives
**Then** auth is bypassed (no token required) so existing Playwright tests are unaffected

**Implementation notes:**
- Add `generateToken()` to `server/main.go`: `crypto/rand` 32 bytes, `base64.URLEncoding.EncodeToString`
- Write `TOKEN=<token>\n` to fd 3 after `PORT=<n>\n`
- Add `authMiddleware` wrapper applied to all handlers in the mux; reads `Authorization` header, validates against the single bootstrap token stored in server state
- `NODE_ENV=test` or `--dev` flag skips auth entirely
- Electron `main.js`: parse `TOKEN=` line from fd 3 pipe alongside existing `PORT=` parsing; store in `windowRegistry` entry; inject into `BrowserWindow` via `additionalArguments` or pass to preload
- `api-client.js`: read token, add `Authorization` header to all `fetch` calls

---

### Story 20.2: Agent Token Issuance & Session Lifecycle

As the Go server,
I want to issue scoped agent tokens and manage session state,
So that agents have controlled, attributable access with enforced scope.

**Acceptance Criteria:**

**Given** a `POST /api/agent/token` request with a valid bootstrap token and `{ "scope": "rw" }`
**When** no agent session is currently active for this file
**Then** the server returns `{ "agentToken": "...", "agentId": "agt_<random>" }` and records a history marker

**Given** a `POST /api/agent/token` request
**When** an agent session is already active for this file
**Then** the server returns HTTP 409

**Given** a valid agent token
**When** it is used on a `/api/file/*` endpoint
**Then** the server returns HTTP 403 (agent tokens are blocked from file operations)

**Given** `POST /api/agent/commit` is called with a valid agent token
**When** the request is processed
**Then** all agent history since the last commit marker is collapsed into a single `AgentCommitCommand` and transferred to the user's undo history; a new marker is set; the token remains active; an `"outcome": "committed"` entry is written to the audit log

**Given** `POST /api/agent/end` is called (by agent or FE) with a valid agent token
**When** the request is processed
**Then** any uncommitted agent history is collapsed into the user's undo history; the token is revoked; a `"session_end"` entry is written to the audit log

**Given** `POST /api/agent/rollback` is called with a valid agent token
**When** the request is processed
**Then** the agent history stack is drained in reverse via `Undo()` calls back to the last commit marker (or session-open marker if no commit has occurred); the token is revoked; a `"rollback"` entry is written to the audit log

**Given** a revoked agent token
**When** it is used on any endpoint
**Then** the server returns HTTP 401

**Implementation notes:**
- Add `AgentSession` struct to controller: `{ token, agentId, scope, history *History, commitMarker int }`
- `AppController` holds `activeAgentSession *AgentSession` (one per controller instance = one per file)
- `AgentCommitCommand` implements `Command`: `Do()` is a no-op (already applied), `Undo()` calls `Undo()` on each constituent command in reverse; `Description()` returns "Agent: N patches, M cells changed"
- Rollback: drain `agentSession.history` in reverse, each patch command's `Undo()` restores prior cell state
- Audit log writer: append JSONL to `userData/agent-audit.jsonl`; non-blocking (goroutine)

---

### Story 20.3: Agent Read Endpoints

As an agent,
I want to read the workbook structure and cell data,
So that I can understand what I'm working with before proposing changes.

**Acceptance Criteria:**

**Given** `GET /api/agent/workbook` with a valid agent token (ro or rw)
**When** the request is processed
**Then** the response includes: file path, sheet dimensions (rows × cols), count of non-empty cells, and a list of non-empty row/col ranges (e.g. `[{"startRow":0,"startCol":0,"endRow":9,"endCol":3}]`)

**Given** `GET /api/agent/range?range=A1:D10` with a valid agent token
**When** the request is processed
**Then** the response includes for each cell in the range: row, col, A1 address, raw value, computed value, isFormula, styleId, alignment

**Given** a range query that exceeds 10,000 cells
**When** the request is processed
**Then** the server returns HTTP 400 with `"error": "range too large (max 10000 cells)"`

**Given** an R/O agent token
**When** `POST /api/agent/patch` is attempted
**Then** the server returns HTTP 403

**Implementation notes:**
- `GET /api/agent/workbook`: iterate `sheet.Cells`, compute bounding box and non-empty regions; no new model methods needed
- `GET /api/agent/range`: parse A1 notation (reuse/extend existing `parseCellRange` logic); iterate cells in range; return sparse array (omit empty cells or include with empty values — include for predictability)
- Max cells guard: `(endRow-startRow+1) * (endCol-startCol+1) > 10000` → 400
- Scope check middleware: `ro` tokens rejected on any `POST` agent endpoint

---

### Story 20.4: Agent Patch Endpoint

As an agent,
I want to submit a batch of operations that are applied atomically,
So that I can make multi-cell changes in a single call that is either fully applied or fully rejected.

**Acceptance Criteria:**

**Given** a `POST /api/agent/patch` with a valid rw token and a well-formed ops array
**When** all ops are valid
**Then** all ops are applied in order, recorded as a single entry in the agent history, the spreadsheet is marked modified, and the audit log records the patch

**Given** a patch where one op is invalid (e.g. out-of-bounds row, unknown op type)
**When** the request is processed
**Then** no ops are applied (atomic rejection), HTTP 400 is returned with the failing op index and reason

**Given** the following op types in a patch
**Then** each is supported:
- `SetCell`: `{ "op": "SetCell", "row": N, "col": N, "value": "..." }`
- `ClearRange`: `{ "op": "ClearRange", "startRow": N, "startCol": N, "endRow": N, "endCol": N }`
- `InsertRow`: `{ "op": "InsertRow", "row": N }`
- `DeleteRow`: `{ "op": "DeleteRow", "row": N }`
- `InsertColumn`: `{ "op": "InsertColumn", "col": N }`
- `DeleteColumn`: `{ "op": "DeleteColumn", "col": N }`
- `SetStyle`: `{ "op": "SetStyle", "row": N, "col": N, "styleId": N, "alignment": "..." }` (alignment optional)
- `AddStyle`: `{ "op": "AddStyle", "name": "...", "fontColor": "...", "fillColor": "..." }`
- `ClearFormat`: `{ "op": "ClearFormat", "startRow": N, "startCol": N, "endRow": N, "endCol": N }`

**Given** a patch `description` field
**When** the patch is applied
**Then** the description is recorded in the audit log; it does not appear in the user's undo stack

**Implementation notes:**
- Validate all ops before applying any (two-pass: validate then execute)
- Each op maps to an existing `Command` type; collect them all, then call `Do()` in sequence under the controller lock
- Wrap the entire set in an `AgentPatchCommand` that holds all constituent commands; push to `agentSession.history`
- `AgentPatchCommand.Undo()` calls constituent commands' `Undo()` in reverse
- `AddStyle` creates a new entry in the `StyleRegistry`; returns the new `styleId` in the response for subsequent `SetStyle` ops to reference
- Response: `{ "success": true, "patchId": "...", "cellsAffected": N }`

---

### Story 20.5: Bootstrap Endpoint & Tool Definitions

As an agent,
I want a single URL I can GET to receive everything I need to start working,
So that session setup requires no hardcoded knowledge of the API.

**Acceptance Criteria:**

**Given** `GET /api/agent/bootstrap?token=<agent-token>`
**When** the token is valid
**Then** the response includes:
- `tools`: array of tool definitions in OpenAI function calling schema (JSON Schema `input_schema`) for: `get_workbook`, `get_range`, `apply_patch`, `commit`, `end_session`, `rollback`
- `workbook`: file path, sheet dimensions, non-empty region summary (same as `GET /api/agent/workbook`)
- `session`: agentId, scope, baseUrl

**Given** the tool definitions in the response
**When** an LLM agent uses them directly
**Then** they accurately describe the required parameters, return shapes, and semantics of each endpoint

**Given** `GET /api/agent/bootstrap?token=<invalid-or-missing>`
**When** the request is processed
**Then** HTTP 401 is returned

**Implementation notes:**
- Tool definitions are static JSON embedded in the Go server (not generated at runtime); kept in a `agent_tools.go` file as a Go string constant or embedded file
- `baseUrl` in the response is `http://localhost:<port>` — the agent uses this for all subsequent calls
- The bootstrap endpoint is the only agent endpoint that accepts the token as a query param (for copy-paste UX); all other agent endpoints require the `Authorization: Bearer` header

---

### Story 20.6: Agent Session UI

As a user,
I want to create and manage agent sessions from the app UI,
So that I can hand an agent access to my spreadsheet and revoke it when done.

**Acceptance Criteria:**

**Given** the app is open with a spreadsheet
**When** the user clicks the toolbar "Agent" button or uses File → "Create Agent Session..."
**Then** a modal opens with a scope selector (R/O / R/W), a "Create Session" button, and instructions

**Given** the user selects a scope and clicks "Create Session"
**When** the session is created
**Then** the modal displays the full bootstrap URL with a copy button and the instruction "Paste this URL into your AI tool"

**Given** an agent session is active
**When** the user looks at the status bar
**Then** "Agent session active" is shown, with "End Session" and "Discard Session" buttons

**Given** the user clicks "End Session"
**When** the request completes
**Then** `POST /api/agent/end` is called, the session indicator clears, and any committed agent changes remain in the spreadsheet (marked unsaved)

**Given** the user clicks "Discard Session"
**When** the request completes
**Then** `POST /api/agent/rollback` is called, agent changes since the last commit are reverted, and the session indicator clears

**Given** the agent calls `POST /api/agent/end` autonomously
**When** the FE polls or receives notification
**Then** the session indicator clears without user action

**Implementation notes:**
- Toolbar button: add an "Agent" button (or key icon) to `frontend/index.html` toolbar; hide when session active (replace with "End" + "Discard" buttons)
- Modal: reuse existing `#modal-overlay` pattern; add `#agent-session-modal` with scope radio, create button, URL display, copy button
- Session polling: `GET /api/agent/session/status` returns `{ "active": bool, "agentId": "..." }`; poll every 5s while session is active to detect autonomous end; stop polling when session ends
- Add `GET /api/agent/session/status` endpoint (requires bootstrap token, not agent token)
- FE stores current agent session state in `appState` (`agentSessionActive`, `agentSessionId`)
- File → "Create Agent Session..." menu item added to Electron menu

---

### Story 20.7: Audit Log

As a user,
I want a persistent record of what agents have done to my spreadsheets,
So that I can review past agent activity.

**Acceptance Criteria:**

**Given** any of the following events occur: session open, patch applied, commit, end, rollback
**When** the event is processed
**Then** a JSONL record is appended to `~/Library/Application Support/GoSheet/agent-audit.jsonl`

**Given** the audit log record for a patch
**Then** it includes: `ts` (ISO 8601), `agentId`, `event` (`"patch"`), `filePath`, `description`, `opsCount`, `outcome` (`"applied"` or `"rejected"`)

**Given** the audit log record for session lifecycle events
**Then** it includes: `ts`, `agentId`, `event` (`"session_open"` | `"commit"` | `"end"` | `"rollback"`), `filePath`

**Given** the audit log file does not exist
**When** the first event is recorded
**Then** the file is created automatically

**Given** the audit log write fails (e.g. disk full)
**When** the write fails
**Then** the failure is logged at WARN level but does not affect the API response or spreadsheet state

**Implementation notes:**
- `audit.go` in `controller/`: `AuditLogger` struct with append-only file handle; write in a goroutine via a buffered channel (non-blocking to callers)
- File path: use Electron's `app.getPath('userData')` passed to Go server as a startup flag (`--userData=<path>`); fall back to `os.UserConfigDir()/GoSheet` if flag absent
- JSONL format: one JSON object per line, newline-terminated
- No rotation in v1 (file grows unbounded; acceptable for local app)

---

## Epic 21: UX Polish & Developer Experience

**Goal:** Address small UX and developer experience friction points that don't belong in other epics.

**Stories:**
- **21-1** Clear cell styling — Add "Clear Formatting" (Cmd+\\) to context menu, Format menu; removes styleId and alignment from selected cells
- **21-2** Rethink Clear / Clear Formatting naming — Audit "Clear" vs "Format Cleanup"; rename and reposition for clarity
- **21-3** Logging cleanup — Suppress INFO-level logs without `--verbose`; fix/suppress Electron CSP warning
- **21-4** Create debugging.md — Document debugging workflow, log forwarding, `--verbose` flag

**Source:** `sprint-change-proposal-2026-03-13.md`

---

## Epic 22: MessagePack File Format (Cross-Language)

**Goal:** Replace gob with MessagePack so `.sheet` files can be read/written by non-Go languages (Python, JavaScript, Rust, etc.).

**Requirements covered:**
- Cross-language file access (backlog item "Language-independent file format")
- No backward compatibility with gob (clean break)

**Stories:**
- **22-1** JavaScript frontend coverage — ✓ Done. Istanbul-based branch/line/function coverage for frontend JS (see `22-1-js-frontend-coverage.md`)
- **22-2** Replace gob with MessagePack persistence — ✓ Done. MessagePack v2.0; `docs/FILE_FORMAT.md`; see `22-2-replace-gob-with-msgpack-persistence.md`
- **22-3** Round-trip tests — Covered in 22-2
- **22-4** Update documentation — ✓ Done. `docs/FILE_FORMAT.md`, TECH_SPEC, README, USER_GUIDE, 1-4 updated

**Source:** `sprint-change-proposal-2026-03-15.md`

---

## Epic 23: Spreadsheet UX Enhancements

**Goal:** Improve font handling, cell formatting, copy/paste, recent files, and formula reference UX.

**Stories:**
- **23-1** Generic font fallback — Use fallback stack in `formatToCssPreview` and style preview when font not installed
- **23-2** Text wrapping within cell — Add wrap toggle; persist if needed; render with CSS
- **23-3** Copy/paste full rows/cols — Support open-ended selections; remove/raise guard; efficient batch API
- **23-4** Recent files error handling — Show error when file can't open; optionally remove from list; fix dialog visibility
- **23-5** Formula reference UX polish — Fix drag in formula bar; improve inline visibility when ref inserted

**Source:** `sprint-change-proposal-2026-03-15-epic23.md`
