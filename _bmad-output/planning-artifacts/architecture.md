---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns', 'step-06-structure', 'step-07-validation', 'step-08-complete']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/prd-validation-report-2026-02-14.md'
  - 'BMAD.md'
workflowType: 'architecture'
project_name: 'spreadsheet'
user_name: 'Yaron'
date: '2026-02-14'
lastStep: 8
status: 'complete'
completedAt: '2026-02-14'
validationScore: '9.5/10'
---

# Architecture Decision Document - Native macOS Spreadsheet App

**Project:** GoSheet Native App Conversion  
**Architect:** Winston  
**Date:** 2026-02-14  
**Status:** Complete - Ready for Implementation  
**Quality Score:** 9.5/10

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements (51 FRs across 6 capability areas):**

1. **File Management (11 FRs)**: Native macOS dialogs for Save/Save As/Open/Import CSV/Export CSV, accurate file status with real paths, recent files list, unsaved changes warnings
2. **Spreadsheet Core (9 FRs)**: Grid with 5,000+ cells support, cell selection/navigation, editing, formula bar, progress indicators
3. **Formula Engine (11 FRs)**: Formulas starting with `=`, arithmetic operations, cell/range references, numeric functions (SUM, AVG, MIN, MAX, COUNT), string functions (CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID), comparison operators, dependency tracking, circular reference detection, formula normalization
4. **Data Import/Export (6 FRs)**: CSV import (data-only, no formulas), CSV export (computed values), preview dialogs, clear messaging
5. **macOS Integration (8 FRs)**: Menu bar (File, Edit, Help), keyboard shortcuts (Cmd+N/O/S/W/Q, Cmd+X/C/V), file associations (.sheet extension), dock integration with recent files, custom file icon
6. **Application Lifecycle (5 FRs)**: Launch <1s, welcome screen with recent files, graceful shutdown, single window (one spreadsheet at a time)

**Non-Functional Requirements (23 NFRs):**

- **Performance (7 NFRs)**: Launch <1s, grid display <100ms, load 5K cells <3s, recalc 250 cells <200ms, CSV import 500 rows <1s, UI latency <50ms, memory <200MB
- **Reliability (7 NFRs)**: No file corruption, accurate file status, no crashes on circular refs/invalid formulas, graceful file I/O errors, unsaved changes warnings, all 42 Go tests pass, all 32 Playwright tests pass
- **Usability (5 NFRs)**: macOS HIG compliance, standard keyboard shortcuts, native dialogs, clear error messages, progress indicators
- **Maintainability (5 NFRs)**: Dual-mode builds via build flags, shared core logic, functional Playwright tests in web mode, no broken tests, future-proof architecture
- **Compatibility (4 NFRs)**: macOS 11+, Universal binary (Intel + Apple Silicon), existing .sheet file format, CSV RFC 4180
- **Security & Data Integrity (6 NFRs)**: 100% local (no network), respect file permissions, prevent infinite loops (circular ref detection), no crashes on malformed input, no deleted data in saved files

**Scale & Complexity:**

- **Primary domain**: Desktop application (macOS native wrapper around web frontend)
- **Complexity level**: MEDIUM
  - Brownfield migration (existing codebase with 74 tests)
  - Dual-mode architecture (native for users, web for testing)
  - Wails v3 alpha (evolving API surface)
  - File I/O migration (browser API → native dialogs)
- **Estimated architectural components**: 8 major components
  1. Wails v3 wrapper layer
  2. IPC bridge (Go ↔ JavaScript)
  3. Native file dialogs (Save/Save As/Open/Import/Export)
  4. macOS menu bar integration
  5. Dock integration (recent files)
  6. Build system (dual-mode with build tags)
  7. Existing Go backend (model, controller, formula engine) - **preserved**
  8. Existing web frontend (HTML/CSS/JS) - **preserved**

### Technical Constraints & Dependencies

**Hard Constraints:**
- **Wails v3.0.0-alpha.67**: Specific version chosen for macOS stability (ghost windows fix, file input fix, drag-and-drop fix)
- **macOS 11+ (Big Sur)**: Minimum OS version, spans WebKit 611-619+
- **Universal binary**: Must support both Intel and Apple Silicon
- **Existing .sheet file format**: Binary serialization with gob encoding - cannot break compatibility
- **Test preservation**: All 42 Go unit tests + 32 Playwright UI tests must pass without modification
- **No network**: 100% offline operation (NFR-S1)

**Technology Stack (Existing):**
- **Backend**: Go 1.x with participle parser, gob serialization
- **Frontend**: Vanilla HTML/CSS/JavaScript (no build tools)
- **Testing**: Go unit tests + Playwright (Python)
- **HTTP Server**: Go net/http (for web mode)

**Dependencies:**
- Wails v3.0.0-alpha.67 (alpha stability risk)
- macOS WebKit (system webview, no Chromium)
- Go build tags for mode separation

**Migration Constraints:**
- IPC API must mirror existing HTTP REST API (decision made during PRD validation)
- Both modes must call identical controller methods
- File I/O layer is the only code that differs between modes

### Cross-Cutting Concerns Identified

1. **Dual-Mode Architecture** (affects all components)
   - Build tag strategy: `//go:build wails` vs `//go:build web`
   - Mode-specific code limited to: file I/O, IPC vs HTTP, entry points
   - Shared code: model, controller, formula engine, frontend

2. **Thread Safety** (affects backend)
   - Existing `sync.RWMutex` in dependency graph
   - IPC bridge will introduce concurrent access from JavaScript
   - Need to verify all controller methods are thread-safe

3. **Error Handling** (affects IPC boundary)
   - Go errors must serialize to JavaScript-friendly format
   - Circular reference errors, file I/O errors, formula parse errors
   - Consistent error display in UI (existing: `#ERROR: message` in cells)

4. **File Path Handling** (affects file operations)
   - Native mode: Real file paths (e.g., `~/Documents/budget.sheet`)
   - Web mode: Temp files for Playwright tests
   - File status display must adapt to mode

5. **Test Mocking Strategy** (affects testing)
   - Playwright tests run in web mode (HTTP server)
   - Need to mock/stub native file dialogs for web mode
   - Or: Accept that Playwright tests use browser File API (existing approach)

6. **Performance Monitoring** (affects all components)
   - NFR targets: <1s launch, <3s load, <200ms recalc
   - Need instrumentation to verify performance in native mode
   - Existing performance is acceptable in web mode

7. **macOS Integration** (affects native mode only)
   - Menu bar, keyboard shortcuts, dock, file associations
   - All standard macOS patterns - low risk
   - Custom file icon needs design asset (noted in PRD validation)

---

## Starter Template Evaluation

### Primary Technology Domain

**Desktop Application (macOS native)** - Brownfield migration from Go HTTP + web frontend to Wails v3 native app

### Unique Project Constraints

This is **not a greenfield project**. Key constraints:
- Existing Go backend (`model/`, `controller/`) with 42 unit tests - **must preserve**
- Existing vanilla JS frontend with 32 Playwright tests - **must preserve**
- Dual-mode architecture requirement (native for users, web for testing)
- No frontend build tools (vanilla HTML/CSS/JS)

### Starter Options Considered

**Option 1: Official Wails v3 Vanilla Template**
- Command: `wails3 init -n spreadsheet -t vanilla`
- Provides: Project structure, `@wailsio/runtime` integration, `wails.json` config, build setup
- **Issue**: Creates new project structure incompatible with existing codebase

**Option 2: Manual Wails v3 Integration (RECOMMENDED)**
- Approach: Study official template, extract patterns, apply to existing code
- Preserves: Existing structure, all tests, dual-mode capability
- Trade-off: More manual setup, but maintains project continuity

### Selected Approach: Manual Integration with Reference Template

**Rationale:**
- Brownfield migration requires preserving existing architecture
- 74 tests must continue passing without modification
- Dual-mode build system needs custom setup (not provided by standard template)
- Existing code organization (`model/`, `controller/`, `frontend/`) is clean and should be maintained

**Implementation Strategy:**

1. **Generate reference template** (for learning):
   ```bash
   cd /tmp
   wails3 init -n wails-reference -t vanilla
   ```

2. **Extract key patterns** from reference:
   - `main.go` structure for Wails app initialization
   - `wails.json` configuration format
   - `@wailsio/runtime` integration in frontend
   - Build configuration (`Taskfile.yml` or similar)

3. **Create dual-mode entry points** in existing codebase:
   - `cmd/native/main.go` (Wails v3 mode) with `//go:build wails`
   - `cmd/web/main.go` (HTTP server mode) with `//go:build web`
   - Shared `controller/` and `model/` packages (no build tags)

4. **Integrate Wails runtime** into existing frontend:
   - Add `@wailsio/runtime` for native file dialogs, menus, dock
   - Keep existing frontend code, add mode detection
   - Use feature detection: `if (window.wails) { /* native */ } else { /* web */ }`

### Architectural Decisions Established

**Language & Runtime:**
- Go 1.x (existing, preserved)
- Wails v3.0.0-alpha.67 wrapper for native mode
- Vanilla JavaScript (no TypeScript, no build tools)

**Build System:**
- Go build tags for mode separation (`wails` vs `web`)
- Wails CLI (`wails3 dev`, `wails3 build`) for native mode
- Standard `go run` for web mode
- Shared core logic (no duplication)

**Project Structure:**
```
spreadsheet/
├── cmd/
│   ├── native/          # NEW: Wails v3 entry point (//go:build wails)
│   │   └── main.go
│   └── web/             # NEW: HTTP server entry point (//go:build web)
│       └── main.go
├── model/               # EXISTING: Preserved
├── controller/          # EXISTING: Preserved
├── frontend/            # EXISTING: Preserved, enhanced with @wailsio/runtime
├── tests/               # EXISTING: Preserved
├── playwright_tests/    # EXISTING: Preserved
├── wails.json           # NEW: Wails configuration
└── go.mod               # EXISTING: Updated with Wails v3 dependency
```

**Testing Strategy:**
- Go unit tests: Run in both modes (no changes needed)
- Playwright tests: Run in web mode only (existing approach)
- Native mode testing: Manual QA initially, automated later if needed

**Development Workflow:**
- **Native development**: `wails3 dev` (hot reload with Wails)
- **Web development**: `go run cmd/web/main.go` (existing workflow)
- **Testing**: `./test.sh` (runs web mode + Playwright, existing)

**Note:** This approach requires more manual setup than a standard Wails template, but it's the only way to preserve the existing codebase and dual-mode architecture while migrating to native macOS.

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. IPC Bridge Design - Unified API Layer
2. File Dialog Strategy - Mode-aware file service
3. Build Tag Strategy - Package-based separation
4. Error Handling - Structured JSON responses

**Important Decisions (Shape Architecture):**
5. macOS Integration - Wails built-in APIs

**Deferred Decisions (Post-MVP):**
- Code signing and notarization (Phase 2 per PRD)
- Undo/Redo implementation (Phase 2 per PRD)
- Excel import (Growth feature per PRD)

### Decision 1: IPC Bridge Design

**Decision**: Unified API Layer  
**Category**: API & Communication (CRITICAL)

**Rationale**: 
- Frontend code remains identical in both native and web modes
- Backend transparently handles mode switching
- True dual-mode architecture with zero frontend duplication
- Consistent with brownfield migration goal of preserving existing code

**Implementation Approach**:
```go
// api/spreadsheet.go - Unified interface
type SpreadsheetAPI interface {
    SetCellValue(row, col int, value string) Response
    GetCellValue(row, col int) Response
    SaveFile(path string) Response
    LoadFile(path string) Response
    // ... other methods
}

// api/response.go - Structured response
type Response struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   string      `json:"error,omitempty"`
}

// cmd/native/api_wails.go - Wails implementation
type WailsAPI struct {
    controller *controller.AppController
}

// cmd/web/api_http.go - HTTP implementation  
type HttpAPI struct {
    controller *controller.AppController
}
```

**Frontend Usage** (same in both modes):
```javascript
// Frontend doesn't know if it's native or web
const result = await api.setCellValue(row, col, value);
if (result.success) {
    // handle success
} else {
    // handle error
}
```

**Affects**: All frontend-backend communication, controller layer, both entry points

### Decision 2: File Dialog Strategy

**Decision**: Mode-aware File Service with Unified Interface  
**Category**: File Management (CRITICAL)

**Rationale**:
- Consistent with unified API layer approach
- Frontend remains mode-agnostic
- Encapsulates platform-specific file dialog logic
- Preserves existing Playwright test infrastructure (web mode uses browser File API)

**Implementation Approach**:
```go
// api/fileservice.go - Interface
type FileService interface {
    OpenFileDialog(filters []string) (path string, err error)
    SaveFileDialog(defaultName string) (path string, err error)
    ReadFile(path string) ([]byte, error)
    WriteFile(path string, data []byte) error
}

// cmd/native/fileservice_wails.go
type WailsFileService struct {
    app *application.App
}
func (s *WailsFileService) OpenFileDialog(filters []string) (string, error) {
    return wails.OpenFileDialog(s.app, filters)
}

// cmd/web/fileservice_http.go
type HttpFileService struct {
    // Uses existing HTTP upload/download endpoints
}
```

**Native Mode**: Uses Wails `OpenFileDialog()`, `SaveFileDialog()` - real file paths  
**Web Mode**: Uses existing HTTP endpoints + browser File API - temp files for Playwright

**Affects**: File operations (FR1-FR11), file status display, Playwright tests

### Decision 3: Build Strategy

**Decision**: Package-based Separation (No Build Tags)  
**Category**: Build System (CRITICAL)

**Rationale**:
- Clearest separation between modes
- Least error-prone (no forgotten build tags)
- Explicit package selection in build commands
- Easier to understand for future maintainers

**Project Structure**:
```
spreadsheet/
├── cmd/
│   ├── native/              # Wails v3 entry point
│   │   ├── main.go          # Wails app initialization
│   │   ├── api_wails.go     # Wails IPC implementation
│   │   └── fileservice_wails.go
│   └── web/                 # HTTP server entry point
│       ├── main.go          # HTTP server initialization
│       ├── api_http.go      # HTTP handler implementation
│       └── fileservice_http.go
├── api/                     # Shared interfaces
│   ├── spreadsheet.go       # SpreadsheetAPI interface
│   ├── fileservice.go       # FileService interface
│   └── response.go          # Response struct
├── model/                   # EXISTING: Preserved
├── controller/              # EXISTING: Preserved
├── frontend/                # EXISTING: Preserved
├── tests/                   # EXISTING: Preserved
├── playwright_tests/        # EXISTING: Preserved
├── wails.json               # NEW: Wails configuration
└── go.mod                   # EXISTING: Updated
```

**Build Commands**:
- **Native**: `wails3 dev` (development) or `wails3 build` (production)
- **Web**: `go run ./cmd/web` (development) or `go build -o bin/web ./cmd/web` (production)
- **Tests**: `go test ./tests/...` (unit tests), `./test.sh` (Playwright in web mode)

**Affects**: All components, build process, CI/CD, developer workflow

### Decision 4: macOS Integration Approach

**Decision**: Wails Built-in APIs for All macOS Features  
**Category**: Platform Integration (IMPORTANT)

**Rationale**:
- Wails v3 provides all required macOS integration features
- Maintained by Wails team, stable APIs
- Sufficient for MVP requirements (FR39-FR46)
- Avoids CGo complexity
- Keeps potential for future cross-platform support (Phase 3)

**Features Implemented via Wails APIs**:

| Feature | Wails v3 API | PRD Requirement |
|---------|--------------|-----------------|
| Menu bar | `application.Menu` | FR39 (File, Edit, Help menus) |
| Keyboard shortcuts | `application.KeyBinding` | FR42 (Cmd+N/O/S/W/Q, etc.) |
| File dialogs | `application.OpenFileDialog`, `SaveFileDialog` | FR1-FR4 (Save, Open, Import, Export) |
| Dock integration | `application.DockMenu` | FR44 (Recent files in dock) |
| File associations | `Info.plist` via Wails build | FR43 (Double-click .sheet files) |
| App icon | `build/appicon.png` via Wails build | FR46 (App icon in dock) |
| Custom file icon | `build/` assets via Wails build | FR45 (Custom .sheet icon) |

**Implementation Notes**:
- Menu bar: Define in `cmd/native/main.go` during app initialization
- Keyboard shortcuts: Bind to menu items or register globally
- Recent files: Maintain list in app state, populate dock menu dynamically
- File associations: Configure in `wails.json` → generates `Info.plist`

**Affects**: Native mode only (web mode doesn't need these features)

### Decision 5: Error Handling Across IPC Boundary

**Decision**: Structured JSON Error Responses  
**Category**: API & Communication (IMPORTANT)

**Rationale**:
- More robust than string-based errors
- Easier to handle different error types in frontend
- Better for future extensibility (error codes, validation errors, etc.)
- Consistent with modern API design patterns

**Response Format**:
```go
type Response struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   string      `json:"error,omitempty"`
}
```

**Error Handling Pattern**:

**Backend (Go)**:
```go
func (api *WailsAPI) SetCellValue(row, col int, value string) Response {
    err := api.controller.SetCellValue(row, col, value)
    if err != nil {
        return Response{Success: false, Error: err.Error()}
    }
    return Response{Success: true}
}
```

**Frontend (JavaScript)**:
```javascript
const result = await api.setCellValue(row, col, value);
if (!result.success) {
    // Display error to user
    showError(result.error);
    return;
}
// Continue with success case
```

**Cell Error Display** (existing pattern preserved):
- Formula errors (circular refs, invalid syntax) still display as `#ERROR: message` in cell computed value
- API errors (file I/O, network in web mode) use structured response
- Separation of concerns: cell-level errors vs operation-level errors

**Affects**: All API methods, frontend error handling, existing error display logic

### Decision Impact Analysis

**Implementation Sequence** (ordered by dependency):

1. **Create unified API interfaces** (`api/` package)
   - Define `SpreadsheetAPI` and `FileService` interfaces
   - Define `Response` struct
   - No dependencies, foundational

2. **Implement web mode API** (`cmd/web/`)
   - Wrap existing HTTP handlers with new interfaces
   - Minimal changes to existing code
   - Validates interface design

3. **Set up Wails project structure**
   - Generate reference template, extract patterns
   - Create `wails.json`, update `go.mod`
   - Add `@wailsio/runtime` to frontend

4. **Implement native mode API** (`cmd/native/`)
   - Wails app initialization
   - IPC binding for `SpreadsheetAPI`
   - Native `FileService` implementation

5. **Update frontend for unified API**
   - Replace direct HTTP calls with API abstraction
   - Add mode detection and API initialization
   - Update error handling for structured responses

6. **Implement macOS integration**
   - Menu bar, keyboard shortcuts
   - Dock integration (recent files)
   - File associations

7. **Test dual-mode functionality**
   - Verify all 42 Go unit tests pass
   - Verify all 32 Playwright tests pass in web mode
   - Manual QA in native mode

**Cross-Component Dependencies**:

- **Unified API Layer** → affects all other decisions (foundational)
- **File Service** → depends on Unified API Layer, affects file operations
- **Build Strategy** → affects how all components are compiled and deployed
- **macOS Integration** → depends on Wails setup, affects native mode only
- **Error Handling** → affects Unified API Layer and frontend

**Risk Mitigation**:

- **Wails v3 alpha stability**: Pin to v3.0.0-alpha.67, monitor release notes, be prepared to upgrade if critical bugs found
- **Dual-mode complexity**: Implement and test web mode first (validates interface design), then add native mode
- **Test preservation**: Run full test suite after each major change, any test failures are blockers
- **Performance**: Instrument both modes to verify NFR targets (launch <1s, load <3s, recalc <200ms)

---

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 6 areas where AI agents could make different implementation choices

These patterns ensure multiple AI agents write compatible, consistent code that works together seamlessly.

### Pattern 1: API Response Format (CRITICAL)

**Rule**: All API methods MUST return this exact structure:

```go
// api/response.go
type Response struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   string      `json:"error,omitempty"`
    Code    string      `json:"code,omitempty"`  // Error code for testing/handling
}
```

**Standardized Error Codes**:
- `CIRCULAR_REF` - Circular reference detected in formula
- `INVALID_FORMULA` - Formula parse error
- `EMPTY_CELL_REF` - Reference to empty cell
- `FILE_NOT_FOUND` - File doesn't exist
- `FILE_READ_ERROR` - Cannot read file
- `FILE_WRITE_ERROR` - Cannot write file
- `INVALID_CELL_REF` - Invalid cell reference (e.g., "ZZZ999999")
- `PARSE_ERROR` - General parsing error

**Response Examples**:

```go
// Success with data
Response{Success: true, Data: map[string]interface{}{"value": "100"}}
// JSON: {"success": true, "data": {"value": "100"}}

// Success without data
Response{Success: true}
// JSON: {"success": true}

// Error with code
Response{Success: false, Error: "Circular reference: A1 → B1 → A1", Code: "CIRCULAR_REF"}
// JSON: {"success": false, "error": "Circular reference: A1 → B1 → A1", "code": "CIRCULAR_REF"}

// File error
Response{Success: false, Error: "File not found: /path/to/file.sheet", Code: "FILE_NOT_FOUND"}
// JSON: {"success": false, "error": "File not found: /path/to/file.sheet", "code": "FILE_NOT_FOUND"}
```

**Testing Benefit**:
```javascript
// Frontend can check specific error codes
if (!result.success && result.code === "CIRCULAR_REF") {
    // Handle circular reference specifically
}

// Tests can assert on error codes (more reliable than string matching)
assert.equal(result.code, "FILE_NOT_FOUND");
```

**ALL AI AGENTS MUST**: Use this exact Response struct for all API methods, never return raw data or different error formats.

### Pattern 2: Go Package Organization (IMPORTANT)

**Rule**: New packages follow this structure:

```
spreadsheet/
├── api/                    # NEW: Interfaces and shared types
│   ├── spreadsheet.go      # SpreadsheetAPI interface
│   ├── fileservice.go      # FileService interface
│   └── response.go         # Response struct, error codes
├── cmd/
│   ├── native/             # NEW: Wails v3 entry point
│   │   ├── main.go         # Wails app initialization
│   │   ├── api_wails.go    # WailsAPI implementation
│   │   └── fileservice_wails.go
│   └── web/                # NEW: HTTP server entry point
│       ├── main.go         # HTTP server initialization
│       ├── api_http.go     # HttpAPI implementation
│       └── fileservice_http.go
├── controller/             # EXISTING: Business logic coordination
│   └── app.go              # AppController (preserved)
├── model/                  # EXISTING: Core data structures
│   ├── cell.go             # Cell, Spreadsheet (preserved)
│   ├── dependencies.go     # DependencyGraph (preserved)
│   ├── formula.go          # Formula evaluation (preserved)
│   └── file.go             # File I/O (preserved)
├── frontend/               # EXISTING: HTML/CSS/JS
│   ├── index.html          # (preserved)
│   ├── app.js              # (preserved, enhanced with mode detection)
│   └── styles.css          # (preserved)
├── tests/                  # EXISTING: Go unit tests
│   ├── formula_test.go     # (preserved)
│   ├── dependencies_test.go # (preserved)
│   └── api_test.go         # NEW: API interface tests
├── playwright_tests/       # EXISTING: UI tests
│   └── test_spreadsheet.py # (preserved)
├── wails.json              # NEW: Wails configuration
└── go.mod                  # EXISTING: Updated with Wails dependency
```

**Package Placement Rules**:
- **Interfaces and shared types** → `api/` package
- **Business logic coordination** → `controller/` package (existing)
- **Core data structures** → `model/` package (existing)
- **Mode-specific implementations** → `cmd/native/` or `cmd/web/`
- **Shared utilities** (if needed) → `internal/util/` (not yet needed)

**ALL AI AGENTS MUST**: Place new code in the correct package according to these rules. Never create new top-level packages without architectural approval.

### Pattern 3: Error Message Format (IMPORTANT)

**Rule**: Two types of errors with different formats and purposes:

**Type 1: Cell-Level Errors** (display in spreadsheet cell)
- **Format**: `#ERROR: <message>`
- **Examples**: 
  - `#ERROR: Circular reference: A1 → B1 → A1`
  - `#ERROR: reference to empty cell`
  - `#ERROR: division by zero`
  - `#ERROR: unknown function: FOO`
- **Used for**: Formula errors, circular refs, invalid cell references, formula evaluation errors
- **Display**: Shows in cell's computed value (existing pattern, preserved)
- **Code location**: Set in `Cell.Computed` field by formula evaluator

**Type 2: Operation-Level Errors** (API responses)
- **Format**: Response struct with `error` and `code` fields
- **Examples**:
  - `{success: false, error: "File not found: budget.sheet", code: "FILE_NOT_FOUND"}`
  - `{success: false, error: "Cannot write to file: permission denied", code: "FILE_WRITE_ERROR"}`
- **Used for**: File I/O errors, API errors, system errors
- **Display**: Shows in UI alerts, notifications, or status messages
- **Code location**: Returned by API methods

**Error Type Decision Tree**:
```
Is this a formula evaluation error?
├─ YES → Use cell-level error (#ERROR: message)
└─ NO → Is this an API operation error?
    └─ YES → Use operation-level error (Response with code)
```

**ALL AI AGENTS MUST**: Use the correct error type for the context. Never mix formats (e.g., don't return `#ERROR:` in API responses).

### Pattern 4: File Naming Conventions (MEDIUM)

**Rule**: Follow existing Go and JavaScript conventions:

**Go source files**: `snake_case.go`
- Examples: `dependencies.go`, `formula.go`, `file_service.go`, `api_wails.go`
- Rationale: Matches existing codebase style

**Go test files**: `snake_case_test.go`
- Examples: `dependencies_test.go`, `formula_test.go`, `api_test.go`
- Rationale: Standard Go convention

**JavaScript files**: `kebab-case.js` or `camelCase.js` (existing uses camelCase)
- Examples: `app.js`, `apiClient.js` (if needed)
- Rationale: Matches existing frontend code

**Directories**: `lowercase` (no underscores or hyphens)
- Examples: `model/`, `controller/`, `frontend/`, `playwright_tests/`
- Rationale: Standard Go convention

**ALL AI AGENTS MUST**: Follow these naming conventions exactly. Never use PascalCase for filenames (e.g., `FileService.go` is wrong, `file_service.go` is correct).

### Pattern 5: Test Organization (MEDIUM)

**Rule**: Tests stay in existing structure (no co-located tests):

**Go unit tests** → `tests/` directory
- Examples: `tests/formula_test.go`, `tests/dependencies_test.go`, `tests/api_test.go`
- Rationale: Existing pattern, keeps tests organized in one place

**Playwright UI tests** → `playwright_tests/` directory
- Examples: `playwright_tests/test_spreadsheet.py`, `playwright_tests/test_file_operations.py`
- Rationale: Existing pattern, separate from Go tests

**Test file naming**:
- Go tests: Match the file being tested (e.g., `formula.go` → `tests/formula_test.go`)
- Playwright tests: Descriptive name starting with `test_` (e.g., `test_spreadsheet.py`)

**Test organization within files**:
- Go: Use `TestPackageName_FeatureName` pattern (e.g., `TestDependencyGraph_CircularReference`)
- Playwright: Use `test_feature_name` pattern (e.g., `test_circular_reference_detection`)

**ALL AI AGENTS MUST**: Place all new Go tests in `tests/` directory, all new Playwright tests in `playwright_tests/` directory. Never create co-located test files (e.g., `api/api_test.go` is wrong, `tests/api_test.go` is correct).

### Pattern 6: Go Code Style (MEDIUM)

**Rule**: Follow existing Go conventions and codebase style:

**Function naming**:
- Exported (public): `PascalCase`
  - Examples: `SetCellValue()`, `GetCellValue()`, `DetectCircularReference()`
- Unexported (private): `camelCase`
  - Examples: `getCellValue()`, `evaluateFormula()`, `extractReferences()`

**Variable naming**: `camelCase`
- Examples: `cellRef`, `dependencyGraph`, `hasUnsavedChanges`, `filePath`
- Exception: Acronyms stay uppercase (e.g., `apiClient`, `httpServer`, `ipcBridge`)

**Constants**:
- Exported: `PascalCase`
  - Examples: `MaxCellValue`, `DefaultTimeout`, `FileVersion`
- Unexported: `camelCase`
  - Examples: `defaultPort`, `maxRetries`

**Struct fields**: `PascalCase` (Go convention for exported fields)
- Examples: `Cell.Value`, `Cell.IsFormula`, `Response.Success`, `Spreadsheet.Cells`

**Interface naming**: `PascalCase` ending with interface purpose
- Examples: `SpreadsheetAPI`, `FileService`, `ErrorHandler`
- Not: `ISpreadsheet` (no "I" prefix), `SpreadsheetInterface` (redundant)

**Error variables**: Prefix with `Err`
- Examples: `ErrCircularReference`, `ErrFileNotFound`, `ErrInvalidFormula`

**ALL AI AGENTS MUST**: Follow these naming conventions exactly. Code that doesn't follow these patterns will be rejected in code review.

### Enforcement Guidelines

**All AI Agents MUST**:

1. **Use exact Response struct format** with `success`, `data`, `error`, and `code` fields
2. **Place code in correct packages** according to package organization rules
3. **Use correct error type** (cell-level `#ERROR:` vs operation-level Response)
4. **Follow file naming conventions** (snake_case for Go, existing pattern for JS)
5. **Place tests in designated directories** (`tests/` for Go, `playwright_tests/` for Playwright)
6. **Follow Go code style** (PascalCase for exported, camelCase for unexported)

**Pattern Verification**:
- Code reviews check for pattern compliance
- Tests verify Response struct format
- Linters enforce Go naming conventions
- CI/CD pipeline runs all tests to catch integration issues

**Pattern Violations**:
- Document in architecture decision log
- Refactor to match patterns before merging
- Update patterns document if new pattern needed (requires architectural approval)

**Pattern Updates**:
- Propose changes in architecture document
- Discuss trade-offs with team
- Update all affected code when pattern changes
- Add migration guide for existing code

### Pattern Examples

**Good Example: API Method Implementation**

```go
// cmd/native/api_wails.go
func (api *WailsAPI) SetCellValue(row, col int, value string) Response {
    err := api.controller.SetCellValue(row, col, value)
    if err != nil {
        // Determine error code based on error type
        code := "PARSE_ERROR"
        if strings.Contains(err.Error(), "Circular reference") {
            code = "CIRCULAR_REF"
        } else if strings.Contains(err.Error(), "empty cell") {
            code = "EMPTY_CELL_REF"
        }
        
        return Response{
            Success: false,
            Error:   err.Error(),
            Code:    code,
        }
    }
    
    return Response{Success: true}
}
```

**Good Example: Error Handling in Frontend**

```javascript
// frontend/app.js
async function setCellValue(row, col, value) {
    const result = await api.setCellValue(row, col, value);
    
    if (!result.success) {
        // Handle specific error codes
        if (result.code === "CIRCULAR_REF") {
            showError("Circular reference detected. Please check your formulas.");
        } else if (result.code === "EMPTY_CELL_REF") {
            showError("Formula references an empty cell.");
        } else {
            showError(result.error);
        }
        return;
    }
    
    // Success case
    refreshCell(row, col);
}
```

**Anti-Pattern: Inconsistent Response Format**

```go
// ❌ WRONG: Different response format
func (api *WailsAPI) GetCellValue(row, col int) map[string]interface{} {
    value := api.controller.GetCellValue(row, col)
    return map[string]interface{}{
        "status": "ok",  // ❌ Should be "success"
        "value": value,  // ❌ Should be in "data" field
    }
}

// ✅ CORRECT: Use Response struct
func (api *WailsAPI) GetCellValue(row, col int) Response {
    value := api.controller.GetCellValue(row, col)
    return Response{
        Success: true,
        Data: map[string]interface{}{"value": value},
    }
}
```

**Anti-Pattern: Wrong Package Placement**

```go
// ❌ WRONG: Implementation in api/ package
// api/wails_api.go
type WailsAPI struct { ... }  // ❌ Implementation doesn't belong in api/

// ✅ CORRECT: Interface in api/, implementation in cmd/native/
// api/spreadsheet.go
type SpreadsheetAPI interface { ... }  // ✅ Interface in api/

// cmd/native/api_wails.go
type WailsAPI struct { ... }  // ✅ Implementation in cmd/native/
```

**Anti-Pattern: Mixed Error Types**

```go
// ❌ WRONG: Using cell-level error format in API response
func (api *WailsAPI) LoadFile(path string) Response {
    err := api.controller.LoadFile(path)
    if err != nil {
        return Response{
            Success: false,
            Error: "#ERROR: File not found",  // ❌ Wrong format for API error
        }
    }
    return Response{Success: true}
}

// ✅ CORRECT: Use operation-level error with code
func (api *WailsAPI) LoadFile(path string) Response {
    err := api.controller.LoadFile(path)
    if err != nil {
        return Response{
            Success: false,
            Error: "File not found: " + path,  // ✅ Clear message
            Code: "FILE_NOT_FOUND",  // ✅ Error code for testing
        }
    }
    return Response{Success: true}
}
```


---

## Project Structure & Boundaries

### Requirements to Structure Mapping

**FR Category 1: File Management (11 FRs)** → Lives in:
- API interface: `api/fileservice.go`
- Native implementation: `cmd/native/fileservice_wails.go`
- Web implementation: `cmd/web/fileservice_http.go`
- Controller logic: `controller/app.go` (file operations methods)
- Model: `model/file.go` (existing, preserved)

**FR Category 2: Spreadsheet Core (9 FRs)** → Lives in:
- Model: `model/cell.go`, `model/spreadsheet.go` (existing, preserved)
- Controller: `controller/app.go` (existing, preserved)
- Frontend: `frontend/index.html`, `frontend/app.js` (existing, enhanced)

**FR Category 3: Formula Engine (11 FRs)** → Lives in:
- Model: `model/formula.go`, `model/dependencies.go` (existing, preserved)
- Tests: `tests/formula_test.go`, `tests/dependencies_test.go` (existing, preserved)

**FR Category 4: Data Import/Export (6 FRs)** → Lives in:
- Controller: `controller/app.go` (CSV import/export methods)
- File service: Uses `FileService` interface for dialogs

**FR Category 5: macOS Integration (8 FRs)** → Lives in:
- Native entry point: `cmd/native/main.go` (menu bar, keyboard shortcuts, dock)
- Wails config: `wails.json` (file associations, icons)
- Build assets: `build/appicon.png`, `build/icons/` (custom icons)

**FR Category 6: Application Lifecycle (5 FRs)** → Lives in:
- Native entry point: `cmd/native/main.go`
- Web entry point: `cmd/web/main.go`
- Frontend: `frontend/index.html` (welcome screen - to be added)

### Complete Project Directory Structure

```
spreadsheet/
├── README.md                          # Project documentation
├── BMAD.md                            # BMAD methodology tracking (existing)
├── go.mod                             # Go module definition (existing, will update)
├── go.sum                             # Go dependencies (existing, will update)
├── wails.json                         # NEW: Wails v3 configuration
├── .gitignore                         # Git ignore patterns (existing)
│
├── _bmad/                             # BMAD methodology files (existing)
│   └── ...                            # (preserved as-is)
│
├── _bmad-output/                      # BMAD artifacts (existing)
│   ├── planning-artifacts/
│   │   ├── prd.md                     # Product Requirements (existing)
│   │   ├── prd-validation-report-2026-02-14.md
│   │   └── architecture.md            # This document (in progress)
│   └── implementation-artifacts/      # Future: Epics, stories
│
├── api/                               # NEW: Shared interfaces and types
│   ├── spreadsheet.go                 # SpreadsheetAPI interface
│   ├── fileservice.go                 # FileService interface
│   └── response.go                    # Response struct, error codes
│
├── cmd/                               # NEW: Application entry points
│   ├── native/                        # Wails v3 native mode
│   │   ├── main.go                    # Wails app initialization, menu bar, dock
│   │   ├── api_wails.go               # WailsAPI implementation (IPC bridge)
│   │   └── fileservice_wails.go       # Native file dialogs (Wails)
│   └── web/                           # HTTP server web mode
│       ├── main.go                    # HTTP server initialization
│       ├── api_http.go                # HttpAPI implementation (REST endpoints)
│       └── fileservice_http.go        # Browser file dialogs (existing pattern)
│
├── controller/                        # EXISTING: Business logic coordination
│   └── app.go                         # AppController (preserved, no changes)
│
├── model/                             # EXISTING: Core data structures
│   ├── cell.go                        # Cell struct (preserved)
│   ├── coords.go                      # Coordinate conversion (preserved)
│   ├── dependencies.go                # DependencyGraph (preserved)
│   ├── file.go                        # File I/O (preserved)
│   ├── formula.go                     # Formula evaluation (preserved)
│   ├── formula_ast.go                 # AST parser (preserved)
│   └── spreadsheet.go                 # Spreadsheet struct (preserved)
│
├── frontend/                          # EXISTING: Web UI (HTML/CSS/JS)
│   ├── index.html                     # Main HTML (preserved, enhanced)
│   ├── app.js                         # Frontend logic (preserved, enhanced)
│   ├── styles.css                     # Styles (preserved)
│   └── api-client.js                  # NEW: API abstraction layer
│
├── tests/                             # EXISTING: Go unit tests
│   ├── coords_test.go                 # Coordinate tests (preserved)
│   ├── dependencies_test.go           # Dependency graph tests (preserved)
│   ├── formula_test.go                # Formula tests (preserved)
│   ├── model_test.go                  # Model tests (preserved)
│   ├── normalize_test.go              # Normalization tests (preserved)
│   └── api_test.go                    # NEW: API interface tests
│
├── playwright_tests/                  # EXISTING: UI tests (Python)
│   ├── test_spreadsheet.py            # Main UI tests (preserved)
│   └── conftest.py                    # Playwright config (preserved)
│
├── build/                             # NEW: Wails build assets
│   ├── appicon.png                    # App icon (macOS dock)
│   ├── darwin/                        # macOS-specific assets
│   │   └── Info.plist                 # Generated by Wails
│   └── icons/                         # Custom file icons
│       └── sheet-icon.icns            # .sheet file icon
│
├── server/                            # EXISTING: Will be replaced by cmd/web/
│   └── main.go                        # Legacy, will migrate to cmd/web/main.go
│
├── specs/                             # EXISTING: Specifications
│   ├── PRODUCT_BRIEF.md               # Product brief (existing)
│   ├── TECH_SPEC.md                   # Technical spec (existing)
│   └── FORMULA_GRAMMAR.md             # Formula grammar (existing)
│
├── test.sh                            # EXISTING: Playwright test runner
└── .cursor/                           # Cursor IDE configuration (existing)
```

### Architectural Boundaries

**API Boundaries:**

1. **Unified API Layer** (Decision 1):
   - Interface: `api/SpreadsheetAPI` - all spreadsheet operations
   - Native: `cmd/native/api_wails.go` - Wails IPC binding
   - Web: `cmd/web/api_http.go` - HTTP REST endpoints
   - Contract: All methods return `api.Response` with error codes

2. **File Service Layer** (Decision 2):
   - Interface: `api/FileService` - file dialog operations
   - Native: `cmd/native/fileservice_wails.go` - Wails dialogs
   - Web: `cmd/web/fileservice_http.go` - Browser File API
   - Contract: Returns file paths (native) or temp paths (web)

3. **Controller Layer** (existing):
   - Location: `controller/AppController`
   - Responsibility: Business logic, validation, orchestration
   - Called by: Both API implementations
   - Calls: Model layer only

4. **Model Layer** (existing):
   - Location: `model/` package
   - Responsibility: Data structures, formula evaluation, dependencies
   - Called by: Controller only
   - No dependencies: Pure business logic

**Component Boundaries:**

Frontend-Backend Communication:
```
Frontend (JavaScript)
    ↓
API Abstraction (api-client.js)
    ↓ (mode detection)
    ├─→ Native: window.wails.Call.* (IPC)
    └─→ Web: fetch('/api/*') (HTTP)
    ↓
Unified Response {success, data, error, code}
```

Mode-Specific Entry Points:
```
Native Mode:                    Web Mode:
cmd/native/main.go              cmd/web/main.go
├─→ Initialize Wails            ├─→ Initialize HTTP server
├─→ Set up menu bar             ├─→ Register HTTP handlers
├─→ Bind WailsAPI to IPC        ├─→ Serve frontend files
└─→ Run event loop              └─→ Listen on port 8080
```

**Data Boundaries:**

1. **File I/O**: 
   - Native: Direct file system via Wails → real paths
   - Web: Browser File API → temp files for tests
   - Abstraction: `FileService` interface

2. **State Management**:
   - Backend: `AppController` holds `Spreadsheet` instance
   - Frontend: Minimal UI state only
   - Sync: Frontend fetches on every operation

3. **Dependency Graph**:
   - Location: `model.DependencyGraph` (in-memory)
   - Thread-safe: `sync.RWMutex`
   - Not persisted: Rebuilt from formulas on load

### Integration Points

**Internal Communication:**

Frontend → API Layer:
- Native: `window.wails.Call.SetCellValue(row, col, value)`
- Web: `fetch('/api/set-cell', {method: 'POST', ...})`
- Both return: `{success, data, error, code}`

API Layer → Controller:
- Both call: `controller.SetCellValue(row, col, value)`
- Controller returns: Go `error` type
- API converts to: `Response` struct

Controller → Model:
- Calls: `spreadsheet.SetCell(row, col, value)`
- Model updates: Cell, DependencyGraph, recalculates
- Returns: `error` or `nil`

**External Integrations:**
- None: 100% offline (NFR-S1)
- File System: Only native file dialogs (macOS)
- No network, cloud sync, or telemetry

**Data Flow:**
```
User Action (edit cell)
    ↓
Frontend (app.js)
    ↓
API Abstraction (api-client.js)
    ↓
    ├─→ Native: IPC → cmd/native/api_wails.go
    └─→ Web: HTTP → cmd/web/api_http.go
    ↓
Controller (controller/app.go)
    ↓
Model (model/spreadsheet.go, cell.go)
    ├─→ Update cell
    ├─→ Extract dependencies
    ├─→ Detect circular refs
    ├─→ Recalculate dependents
    └─→ Set Modified flag
    ↓
Response {success: true}
    ↓
Frontend updates UI
```

### File Organization Patterns

**Configuration Files:**
- `wails.json`: Wails v3 configuration
- `go.mod`: Go dependencies (existing + Wails v3)
- `.gitignore`: Ignore `build/bin/`, temp files
- No `.env`: No environment variables needed

**Source Organization:**
- Interfaces first: `api/` defines contracts
- Implementations separate: `cmd/native/` and `cmd/web/`
- Core shared: `model/` and `controller/` (no mode-specific code)
- Frontend enhanced: `api-client.js` adds mode detection

**Test Organization:**
- Go tests: `tests/` (42 tests, preserved)
- Playwright: `playwright_tests/` (32 tests, preserved)
- New API tests: `tests/api_test.go`
- No co-located tests: Centralized structure

**Asset Organization:**
- App icon: `build/appicon.png`
- File icon: `build/icons/sheet-icon.icns`
- Frontend: `frontend/` (no build step)

### Development Workflow Integration

**Development Servers:**

Native Mode:
```bash
wails3 dev
# Wails app with hot reload
# Entry: cmd/native/main.go
```

Web Mode:
```bash
go run ./cmd/web
# HTTP server on port 8080
# Entry: cmd/web/main.go
```

Testing:
```bash
go test ./tests/...        # Go unit tests
./test.sh                  # Playwright tests
```

**Build Process:**

Native Build:
```bash
wails3 build
# Output: build/bin/spreadsheet.app
# Universal binary (Intel + Apple Silicon)
```

Web Build:
```bash
go build -o bin/web ./cmd/web
# For Playwright testing only
```

**Deployment:**

Native App (production):
- Distribution: macOS .app via direct download
- Installation: Drag to Applications
- File associations: Via Info.plist
- Updates: Manual (Phase 2: auto-update)
- Code signing: Phase 2 (MVP unsigned)

Web Mode (testing only):
- Not deployed to users
- CI/CD testing only


---

## Architecture Validation & Completion

### Validation Summary

**Architecture Quality Score: 9.5/10**

| Category | Score | Status |
|----------|-------|--------|
| Coherence | 10/10 | ✅ EXCELLENT |
| Requirements Coverage | 10/10 | ✅ COMPLETE |
| Implementation Readiness | 9/10 | ✅ READY |
| Risk Management | 9/10 | ✅ ACCEPTABLE |
| Documentation Quality | 10/10 | ✅ COMPREHENSIVE |

**Overall: EXCELLENT - Ready for Implementation**

### Coherence Validation ✅

**Decision Compatibility:**
- ✅ Wails v3.0.0-alpha.67 + Go 1.x + Vanilla JS → All compatible
- ✅ Unified API Layer + Dual-mode build → Architecturally sound
- ✅ Package-based separation + No build tags → Clean, no conflicts
- ✅ Structured JSON responses + Error codes → Consistent pattern

**Pattern Consistency:**
- ✅ Response struct format → Supports unified API decision
- ✅ Package organization → Aligns with dual-mode architecture
- ✅ Error handling (cell vs operation) → Clear separation
- ✅ File naming conventions → Matches existing codebase

**Structure Alignment:**
- ✅ `api/` package → Supports unified API layer
- ✅ `cmd/native/` and `cmd/web/` → Enables dual-mode builds
- ✅ Preserved `model/` and `controller/` → Maintains existing architecture
- ✅ Integration boundaries → Properly defined and documented

### Requirements Coverage Validation ✅

**Functional Requirements (51 FRs) - All Covered:**
- ✅ File Management (11 FRs) → FileService interface + native/web implementations
- ✅ Spreadsheet Core (9 FRs) → Existing model/controller (preserved)
- ✅ Formula Engine (11 FRs) → Existing formula.go, dependencies.go (preserved)
- ✅ Data Import/Export (6 FRs) → Controller + FileService
- ✅ macOS Integration (8 FRs) → cmd/native/main.go + Wails APIs
- ✅ Application Lifecycle (5 FRs) → Dual entry points + frontend

**Non-Functional Requirements (23 NFRs) - All Covered:**
- ✅ Performance (7 NFRs) → Wails native app + existing backend
- ✅ Reliability (7 NFRs) → 74 tests preserved, error handling defined
- ✅ Usability (5 NFRs) → Wails macOS HIG compliance
- ✅ Maintainability (5 NFRs) → Dual-mode architecture, shared core
- ✅ Compatibility (4 NFRs) → macOS 11+, Universal binary, file format preserved
- ✅ Security (6 NFRs) → 100% local, circular ref detection

### Implementation Readiness ✅

**Clear Entry Points:**
- ✅ Native: `cmd/native/main.go` - Wails initialization documented
- ✅ Web: `cmd/web/main.go` - HTTP server documented
- ✅ Both call same controller methods - clear pattern

**Defined Interfaces:**
- ✅ `SpreadsheetAPI` - All methods defined with Response format
- ✅ `FileService` - File dialog abstraction defined
- ✅ `Response` struct - Error codes standardized (CIRCULAR_REF, FILE_NOT_FOUND, etc.)

**Implementation Sequence (7 steps):**
1. Create unified API interfaces (`api/` package)
2. Implement web mode API (wrap existing HTTP handlers)
3. Set up Wails project structure
4. Implement native mode API
5. Update frontend for unified API
6. Implement macOS integration
7. Test dual-mode functionality

### Risk Assessment ✅

**Identified Risks with Mitigation:**
1. ✅ Wails v3 alpha stability → Pin to alpha.67, monitor releases
2. ✅ Dual-mode complexity → Implement web first, validate interface
3. ✅ Test preservation → Run full suite after each change
4. ✅ Performance targets → Instrument both modes, verify NFRs

### Gap Analysis

**Minor Implementation Details Needed:**
1. Recent files list storage (where/how to persist) - Implementation detail
2. Welcome screen layout - Defer to UX or implement simple version
3. Custom file icon design asset - Defer to UX or use placeholder

**Note:** These are implementation details, not architectural gaps. Architecture provides clear locations and patterns for implementing these features.

### Architecture Strengths

1. **Brownfield-aware design** - Preserves existing code and 74 tests
2. **Dual-mode architecture** - Clean separation, shared core logic
3. **Clear boundaries** - API, Component, Data boundaries well-defined
4. **Consistent patterns** - Error codes, package organization, naming conventions
5. **Complete mapping** - All 51 FRs + 23 NFRs → specific files/directories
6. **Risk mitigation** - All major risks identified with strategies

### Recommendations for Implementation

1. **Start with Step 1** (Create API interfaces) - Foundation for everything
2. **Implement web mode first** - Validates interface design, preserves tests
3. **Generate Wails reference** - Learn from official template: `cd /tmp && wails3 init -n wails-reference -t vanilla`
4. **Test continuously** - Run full suite (42 Go + 32 Playwright) after each major change
5. **Defer minor details** - Welcome screen, file icon can be simple initially

### Architecture Document Status

**Status:** ✅ COMPLETE - Ready for Implementation

**Sections Completed:**
1. ✅ Project Context Analysis
2. ✅ Starter Template Evaluation
3. ✅ Core Architectural Decisions (5 decisions)
4. ✅ Implementation Patterns & Consistency Rules (6 patterns)
5. ✅ Project Structure & Boundaries
6. ✅ Architecture Validation

**Next Steps:**
- Hand off to Dev agent for implementation
- Use this document as authoritative guide for all architectural decisions
- Update document if new architectural decisions are needed during implementation

**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

---

## Summary

This architecture document defines a comprehensive migration strategy for converting the existing Go HTTP + web frontend spreadsheet application to a native macOS app using Wails v3.0.0-alpha.67, while preserving all existing functionality and maintaining a dual-mode architecture for testing.

**Key Architectural Decisions:**
1. Unified API Layer - Frontend code identical in both modes
2. Mode-aware File Service - Native dialogs vs browser File API
3. Package-based Separation - `cmd/native/` and `cmd/web/`
4. Wails Built-in APIs - All macOS integration via Wails
5. Structured JSON Responses - Error codes for reliable testing

**Implementation Approach:**
- Manual Wails integration (not standard template)
- Preserve existing codebase structure
- Maintain all 74 tests (42 Go + 32 Playwright)
- Incremental migration with web mode first

**Architecture Quality:** 9.5/10 - EXCELLENT, Ready for Implementation

