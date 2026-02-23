---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments: 
  - 'specs/PRODUCT_BRIEF.md'
  - './BMAD.md'
briefCount: 1
projectDocsCount: 1
researchCount: 0
brainstormingCount: 0
workflowType: 'prd'
classification:
  projectType: 'desktop_app'
  domain: 'general'
  complexity: 'medium'
  projectContext: 'brownfield'
  keyInsights:
    - 'Dual-mode architecture: web for testing, native for users'
    - 'Web mode is test harness only, not deployment target'
    - 'Native app is sole user-facing product'
    - 'Wails v3 for native macOS wrapper'
    - 'Maintain Playwright test infrastructure'
---

# Product Requirements Document - Native macOS Spreadsheet App

**Project:** GoSheet Native App Conversion  
**Author:** Yaron  
**Date:** 2026-02-14  
**Status:** Validated - Ready for Architecture  
**Version:** 1.1  
**Validation Date:** 2026-02-14

## Executive Summary

**Project Context:** Brownfield architectural migration of existing web-based spreadsheet application to native macOS desktop app using Wails v3.

**Core Problem:** Current web-based implementation has fundamental limitations in file operations - backend cannot track actual file paths or know if files were truly saved due to browser File API constraints. This creates unreliable file status tracking and user confusion about data safety.

**Solution:** Convert to native macOS app using Wails v3 wrapper while maintaining dual-mode architecture (native for users, web mode for Playwright testing).

**Key Objectives:**
- Fix file operations with native macOS dialogs and direct file I/O
- Provide accurate file status tracking with real file paths
- Deliver polished native macOS experience (menu bar, keyboard shortcuts, dock integration)
- Preserve all existing functionality (42 Go unit tests, 32 Playwright UI tests)
- Maintain test infrastructure via dual-mode build system

**Target Users:** Developers and technical users who need lightweight, fast spreadsheet functionality with reliable file operations.

**Timeline:** 3-4 weeks for MVP

## Success Criteria

### User Success

Users can trust their data is safe:
- File status accurately shows saved/unsaved state with real file path
- Native macOS dialogs for all file operations (Save, Open, Import)
- Clear warnings before any data loss (close, quit, load with unsaved changes)
- Files save anywhere on disk with user-chosen paths

Users experience native macOS quality:
- App launches in <1 second
- Responsive UI (<50ms interaction latency)
- Standard keyboard shortcuts (Cmd+S/O/N/W/Q)
- Recent files accessible from welcome screen and dock menu

### Technical Success

File operations work correctly:
- Backend tracks actual file paths chosen by user
- Direct file I/O to user-selected locations
- Modified flag accurately reflects spreadsheet state
- No browser API limitations

Architecture preserved:
- All 42 Go unit tests pass
- All 32 Playwright UI tests pass in web mode
- Dual-mode build system functional
- All existing features work (formulas, dependency tracking, circular reference detection, normalization)

### Measurable Outcomes

**MVP Completion Criteria:**
- Native .app bundle builds and launches on macOS
- File dialogs are native macOS (not browser-based)
- File status shows real paths (e.g., "Saved: ~/Documents/budget.sheet")
- Performance targets met (launch <1s, load 5K cells <3s, recalc <200ms)
- All tests pass (42 Go unit + 32 Playwright UI)
- CSV import/export functional
- CSV import/export functional

## Product Scope

### MVP - Phase 1 (Native App Foundation)

**Core Objective:** Convert web-based spreadsheet to native macOS app with reliable file operations.

**File Operations:**
- Native macOS dialogs (Save, Save As, Open, Import CSV, Export CSV)
- Direct file I/O to user-chosen paths
- Accurate file status with real paths
- CSV import with preview (data-only, formulas not preserved)
- CSV export with computed values (formulas evaluated, not exported)

**macOS Integration:**
- Menu bar (File, Edit, Help menus)
- Keyboard shortcuts (Cmd+N/O/S/W/Q, Cmd+X/C/V)
- File associations (.sheet extension)
- Dock integration with recent files
- Custom file icon
- .app bundle packaging

**Preserve Existing Functionality:**
- Cell editing and navigation
- Formula engine (arithmetic, functions, cell/range references)
- Dependency tracking and smart recalculation
- Circular reference detection
- Formula normalization
- Binary file format

**Dual-Mode Architecture:**
- Native build (Wails v3) for users
- Web build (HTTP server) for Playwright testing
- Shared Go backend and frontend code
- Build flags to switch modes

**Out of Scope:**
- Auto-update (manual download only)
- Excel import (Growth feature)
- Multiple windows
- Quick Look preview
- Cloud sync
- Code signing and notarization (deferred to Phase 2)
- Undo/Redo (deferred to Phase 2 - requires command pattern and history management)

### Phase 2 - Growth Features

- Code signing with Apple Developer ID and notarization
- Undo/Redo with full command history (Cmd+Z/Cmd+Shift+Z)
- Auto-update mechanism
- Excel (.xlsx) import with basic formula support
- Quick Look preview for .sheet files
- Spotlight search integration
- Enhanced dock features (badges, progress)
- macOS Services integration

### Phase 3 - Future Vision

- Multiple windows
- Auto-save
- File watching (external change detection)
- Touch Bar support
- Advanced import/export
- Cross-platform (Windows, Linux)

## User Journeys

### Journey 1: First-Time User - Sarah Discovers a Better Way

**Sarah** is a data scientist who's tired of waiting 30 seconds for Excel to launch just to calculate a quick average. She's heard about lightweight alternatives and downloads your app.

**Opening Scene:**
Sarah double-clicks the app icon for the first time. A **welcome screen** appears:
- Clean, minimal design
- "Create New Spreadsheet" button
- "Open Existing File" button
- "Import from CSV" option
- Quick tip: "Tip: Use Cmd+N for new spreadsheet"

**Rising Action:**
She clicks "Create New Spreadsheet" and sees an empty grid instantly. She:
1. Enters quarterly revenue numbers in column A (Q1-Q4)
2. Types `=AVG(A1:A4)` in B1
3. Sees the result instantly
4. Thinks: "That was fast"

**Critical Moment:**
She needs to save her work. She hits Cmd+S:
- Native macOS Save dialog appears (not a browser download!)
- She picks ~/Documents/Q1-revenue.sheet
- File status shows "Saved: ~/Documents/Q1-revenue.sheet"
- She **trusts** it's saved (no confusion like the web version)

**Resolution:**
Sarah closes the app confidently. Next time she opens it, the welcome screen shows "Recent Files" with Q1-revenue.sheet at the top. She's found her new go-to tool for quick calculations.

**Requirements revealed:**
- Welcome screen with clear actions and recent files
- Instant empty grid display
- Intuitive formula entry
- Native Save dialog (Cmd+S)
- Accurate file status with real file path
- Recent files list on welcome screen

### Journey 2: Power User - Marcus Manages Complex Dependencies

**Marcus** is a financial analyst building a complex budget model with **5,000+ cells** and **1,000+ formulas** that reference each other in chains 10+ levels deep. Excel is slow and crashes. He needs something that can handle real complexity.

**Opening Scene:**
Marcus opens his existing budget.sheet file (5,000 cells, 1,000 formulas, deep dependency chains). The app:
- Shows progress indicator: "Loading... rebuilding dependency graph"
- Loads in 2-3 seconds (acceptable for this size)
- All formulas recalculate correctly in topological order
- Dependency graph rebuilt from formulas
- File status: "Saved: ~/Documents/budget.sheet"

**Rising Action:**
Marcus updates a key assumption in cell A1 (annual growth rate from 3% to 5%). This triggers:
1. Dependency tracking identifies 247 dependent cells (out of 1,000 formulas)
2. Topological sort determines calculation order
3. **Only those 247 cells recalculate** (not all 1,000)
4. Results update in <200ms
5. File status immediately changes to "Unsaved changes"

**Critical Moment - Error Recovery:**
Marcus accidentally creates a circular reference while refactoring (A10=B10, B10=C10, C10=A10). The app:
- Detects the cycle **before** it's added to the graph
- Shows "#ERROR: Circular reference: A10 → B10 → C10 → A10" in the cell
- Doesn't freeze, crash, or corrupt the file
- File status stays "Unsaved changes" (not saved with error)
- Marcus fixes it by changing C10's formula

**Resolution:**
Marcus saves his work (Cmd+S), sees "Saved: ~/Documents/budget.sheet", and continues working. He's found a tool that:
- Handles 5,000+ cells without breaking
- Recalculates smartly (only affected cells)
- Catches errors before they corrupt data
- Gives him confidence in file status

**Requirements revealed:**
- Handle 5,000+ cells efficiently
- Progress indicator for large file loads
- Smart recalculation with dependency tracking
- Circular reference detection with clear errors
- Accurate file status even during errors
- Performance that scales with complexity

### Journey 3: Migration User - Elena Imports Raw Data

**Elena** is a project manager with years of data in CSV files. She wants to try your app for new projects and needs to import some historical data.

**Opening Scene:**
Elena opens the app for the first time. The welcome screen shows:
- "Create New Spreadsheet"
- **"Import from CSV"**
- "Open Existing File"

**Rising Action - CSV Import:**
Elena clicks "Import from CSV" and selects her sales-data.csv (500 rows, 10 columns of raw data):
1. Native macOS file picker appears
2. She selects the CSV file
3. App shows preview: "Found 500 rows, 10 columns. Import?"
4. Clear note: "CSV import is data-only. Formulas are not preserved."
5. She clicks "Import"
6. Data loads into grid instantly
7. File status: "Unsaved changes"

**Critical Moment:**
Elena realizes she needs to add formulas to calculate totals. She:
1. Adds `=SUM(B2:B501)` to calculate total sales
2. Adds other formulas for analysis
3. Saves as sales-analysis.sheet

**Resolution:**
Elena understands the workflow:
- ✅ Import raw data from CSV easily
- ✅ Add formulas in the app
- ✅ Save in native format with formulas preserved
- 📝 Note: For Excel files with formulas, she'll wait for future Excel import feature

**Requirements revealed:**
- CSV import for data-only use cases
- File preview before import
- Clear messaging: "CSV = data only"
- Fast import (500 rows in <1 second)
- Save imported data in native format
- Import doesn't corrupt data

### Journey Requirements Summary

**Core Capabilities (MVP):**
- Welcome screen with Recent Files list
- Native file dialogs (Save, Save As, Open, Import CSV)
- Accurate file status with real file paths at all times
- Fast load/save for large files (5,000+ cells)
- Smart recalculation using dependency tracking
- Circular reference detection and clear error messages
- CSV import (data-only, no formulas)
- Progress indicators for long operations

**Performance Targets:**
- App launch: <1 second
- Empty grid display: instant
- Large file load (5,000 cells): <3 seconds with progress indicator
- Recalculation: <200ms for 250 dependent cells
- CSV import: <1 second for 500 rows

**Error Handling:**
- Circular reference errors don't corrupt files
- Clear error messages in cells
- File status accurate even during errors
- Graceful degradation for large files

## Technical Architecture

### Platform

**Target:** macOS only (macOS 11+ Big Sur)  
**Architecture:** Universal binary (Intel + Apple Silicon)  
**Future:** Windows/Linux possible via Wails v3 (Phase 3)

### Wails v3 Implementation

**Version:** Wails v3.0.0-alpha.67 (Feb 4, 2026)  
**Rationale:** Most stable recent alpha with critical macOS fixes (ghost windows, file input, drag-and-drop)

**Components:**
- Go backend (existing codebase preserved)
- Web frontend (HTML/CSS/JS - existing UI preserved)
- Native webview (system WebKit, no Chromium)
- IPC bridge (Go ↔ JavaScript)
- Native APIs (file dialogs, menus, dock)

**Dual-Mode Build System:**
- **Native mode:** Wails v3 wrapper (production deployment)
  - IPC bridge exposes controller methods to frontend (mirrors HTTP API)
  - JavaScript calls Go functions directly (e.g., `app.SetCell(row, col, value)`)
- **Web mode:** HTTP server (Playwright testing only)
  - REST API endpoints (e.g., `POST /api/set-cell`)
- Shared core logic (model, controller, frontend)
- Both modes call identical controller methods
- Build tags separate mode-specific code (file I/O, IPC vs HTTP)

### Data Storage

**File Format:** Binary serialization (.sheet extension) - existing format preserved  
**Storage:** Local disk, user-chosen paths  
**Network:** None (100% offline operation)

### Risk Mitigation

**Risk 1: Wails v3 Learning Curve**
- Start with "hello world" prototype
- Validate IPC with existing Go code early
- Prototype file dialogs first

**Risk 2: Dual-Mode Complexity**
- Use Go build tags for mode separation
- Share core logic, differ only in file I/O layer
- Test both modes continuously

**Risk 3: Playwright Compatibility**
- Preserve HTTP server mode for testing
- Run full test suite on every change
- Document test adaptations if needed

## Functional Requirements

### FR Capability Areas

#### 1. File Management

**FR1:** Users can create a new empty spreadsheet  
**FR2:** Users can open existing .sheet files from disk  
**FR3:** Users can save spreadsheets to disk with user-chosen file path  
**FR4:** Users can save spreadsheets with a new file name (Save As)  
**FR5:** Users can see accurate file status showing saved/unsaved state and real file path  
**FR6:** Users can see a list of recently opened files  
**FR7:** Users can import CSV files into a new spreadsheet  
**FR8:** Users can preview CSV data before importing  
**FR9:** Users can export spreadsheets to CSV format  
**FR10:** System warns users before closing unsaved changes  
**FR11:** System warns users before loading a new file with unsaved changes  

#### 2. Spreadsheet Core

**FR12:** Users can view a grid of cells with row and column headers  
**FR13:** Users can select cells by clicking  
**FR14:** Users can navigate cells using arrow keys, Tab, and Enter  
**FR15:** Users can edit cell values by typing  
**FR16:** Users can see cell values and computed results in the grid  
**FR17:** Users can see the selected cell's formula in the formula bar  
**FR18:** Users can edit formulas in the formula bar  
**FR19:** Users can delete cell contents using Delete or Backspace  
**FR20:** System supports spreadsheets with 5,000+ cells  
**FR21:** System displays progress indicator for large file operations  

#### 3. Formula Engine

**FR22:** Users can enter formulas starting with `=`  
**FR23:** System evaluates arithmetic operations (+, -, *, /, %)  
**FR24:** System evaluates cell references (e.g., A1, B2)  
**FR25:** System evaluates range references (e.g., A1:A10)  
**FR26:** System evaluates numeric functions (SUM, AVG, MIN, MAX, COUNT)  
**FR27:** System evaluates string functions (CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID)  
**FR28:** System evaluates comparison operators (=, !=, <, >, <=, >=)  
**FR29:** System tracks formula dependencies and recalculates only affected cells  
**FR30:** System detects circular references and displays error messages  
**FR31:** System normalizes formulas (uppercase cell references, remove extra spaces)  
**FR32:** System displays error messages in cells for invalid formulas  

#### 4. Data Import/Export

**FR33:** Users can import CSV files containing data  
**FR34:** System displays clear messaging that CSV import is data-only (formulas not preserved)  
**FR35:** System imports CSV data into grid cells  
**FR36:** System marks imported data as unsaved until user saves as .sheet format  
**FR37:** Users can export current spreadsheet to CSV format  
**FR38:** System exports computed values to CSV (formulas are evaluated, not exported)  

#### 5. macOS Integration

**FR39:** Users can access File menu (New, Open, Save, Save As, Import CSV, Export CSV, Recent Files, Close, Quit)  
**FR40:** Users can access Edit menu (Cut, Copy, Paste, Select All)  
**Note:** Undo/Redo deferred to Phase 2  
**FR41:** Users can access Help menu (About)  
**FR42:** Users can trigger actions via keyboard shortcuts (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+W, Cmd+Q, Cmd+X/C/V)  
**FR43:** Users can double-click .sheet files to open them in the app  
**FR44:** Users can see recent files in dock menu (right-click app icon)  
**FR45:** System displays custom icon for .sheet files in Finder  
**FR46:** System displays app icon in dock  

#### 6. Application Lifecycle

**FR47:** System launches in <1 second  
**FR48:** System displays welcome screen on first launch with options to create, open, or import  
**FR49:** System displays recent files on welcome screen  
**FR50:** System closes gracefully when user quits  
**FR51:** System supports single window (one spreadsheet at a time in MVP)

## Non-Functional Requirements

### Performance

**NFR-P1:** Application launch time shall be less than 1 second on modern macOS hardware  
**NFR-P2:** Empty spreadsheet grid shall display instantly (<100ms) after launch  
**NFR-P3:** File load operations for spreadsheets with 5,000 cells shall complete within 3 seconds  
**NFR-P4:** Formula recalculation for 250 dependent cells shall complete within 200ms  
**NFR-P5:** CSV import for 500 rows shall complete within 1 second  
**NFR-P6:** UI interactions (cell selection, navigation) shall feel responsive with <50ms latency  
**NFR-P7:** Memory usage shall remain under 200MB for typical spreadsheets (<1,000 cells)  

### Reliability

**NFR-R1:** File save operations shall not corrupt or lose data under any circumstances  
**NFR-R2:** File status display shall accurately reflect saved/unsaved state at all times  
**NFR-R3:** Application shall not crash when encountering circular references or invalid formulas  
**NFR-R4:** Application shall gracefully handle file I/O errors with clear error messages  
**NFR-R5:** Unsaved changes warning shall trigger before any data loss scenario (close, quit, load)  
**NFR-R6:** All 42 Go unit tests shall pass before any release  
**NFR-R7:** All 32 Playwright UI tests shall pass in web mode before any release  

### Usability

**NFR-U1:** Application shall follow macOS Human Interface Guidelines for native apps  
**NFR-U2:** Keyboard shortcuts shall follow macOS conventions (Cmd+S, Cmd+O, etc.)  
**NFR-U3:** File dialogs shall use native macOS dialogs (not custom implementations)  
**NFR-U4:** Error messages shall be clear and actionable for users  
**NFR-U5:** Application shall provide visual feedback for long operations (progress indicators)  

### Maintainability

**NFR-M1:** Codebase shall support dual-mode builds (native and web) via build flags  
**NFR-M2:** Core business logic shall be shared between native and web modes  
**NFR-M3:** Playwright test infrastructure shall remain functional in web mode  
**NFR-M4:** Code changes shall not break existing unit or UI tests  
**NFR-M5:** Architecture shall support future addition of features without major refactoring  

### Compatibility

**NFR-C1:** Application shall run on macOS 11 (Big Sur) and later  
**NFR-C2:** Application shall support both Intel and Apple Silicon architectures (Universal binary)  
**NFR-C3:** File format (.sheet) shall remain compatible with existing files  
**NFR-C4:** CSV import/export shall follow standard CSV format (RFC 4180)  

### Security & Data Integrity

**NFR-S1:** Application shall not transmit any data over the network (100% local operation)  
**NFR-S2:** File operations shall respect macOS file system permissions  
**NFR-S3:** Application shall prevent infinite loops in formula evaluation (circular reference detection)  
**NFR-S4:** Application shall not crash due to malformed formulas or invalid input  
**NFR-S5:** Saved files shall not contain deleted cell data (proper data cleanup on save)  
**NFR-S6:** File serialization shall only include active cell data, not historical or deleted content
