# BMAD Method - GoSheet Project

## About BMAD

This project follows the **BMAD (Breakthrough Method for Agile AI Driven Development)** methodology.

BMAD is an AI-driven agile development framework that provides:
- Structured workflows from planning to implementation
- Specialized agents for different development phases
- Scale-adaptive intelligence based on project complexity
- Best practices grounded in agile methodology

**Official Resources**:
- GitHub: https://github.com/bmad-code-org/BMAD-METHOD
- Documentation: http://docs.bmad-method.org

## Project-Specific Development Rules

These rules supplement BMAD methodology for this project:

### Session Management

1. **Check BMAD Before Starting**: At the beginning of EVERY user interaction session
   - Read BMAD.md to understand current project state
   - Review recent changes, pending tasks, and architectural decisions
   - Check test counts, completed features, and known issues
   - Update your mental model before responding to user
   - **Why**: Prevents working with outdated assumptions and ensures continuity across sessions

2. **Update BMAD During Work**: Document as you go
   - Add new features to "Bug Fixes and Improvements" section immediately after implementation
   - Update test counts when tests are added
   - Document architectural decisions when made
   - Mark tasks as completed in "Next Steps" section
   - **Why**: Keeps documentation current and prevents forgetting important details

### Code Quality & Testing
1. **Test Before Commit**: Never commit code without testing it first
   - Run relevant tests (unit tests, Playwright tests, or manual testing)
   - Verify the build succeeds
   - Check that the change actually works as intended
   - Only commit after verification

2. **Bug Fix Testing**: Every bug fix MUST include at least one regression test
   - Add test(s) that reproduce the bug before fixing
   - Verify test fails with the bug present
   - Verify test passes after the fix
   - Document the bug, root cause, and fix in test docstring
   - Add bug fix details to BMAD.md decision log

3. **Clean Dependencies**: Keep dependencies minimal and purposeful
   - Remove unused dependencies immediately
   - Don't let legacy code pollute the active codebase
   - Archive old code rather than leaving it to rot

4. **Documentation in Code**: Important rules and decisions must be documented
   - Don't rely on conversation history alone
   - Update BMAD.md with methodology decisions
   - Update README.md with architectural changes
   - Document "why" not just "what"

### Code Quality Principles

1. **Test Coverage**
   - **Target**: Maintain high test coverage for critical paths
   - **Current Status**: 
     - Go unit tests: 42 tests covering formula evaluation, string functions, error handling, file I/O, dependency tracking, circular references, formula normalization
     - Playwright UI tests: 30 tests covering user interactions, bug regressions, features, file operations
   - **Strategy**: Focus on behavior testing over line coverage metrics
   - **Rule**: Every bug fix requires at least one regression test

2. **Code Complexity**
   - **Keep Functions Simple**: Functions should do one thing well
   - **Avoid Deep Nesting**: Max 3 levels of nesting in control structures
   - **Limit Function Length**: Target <50 lines per function (guideline, not hard rule)
   - **Cyclomatic Complexity**: Keep cognitive load low - if a function is hard to understand, refactor
   - **Current Status**: Formula evaluator is the most complex component (~577 lines), but well-structured with clear separation of concerns

3. **DRY (Don't Repeat Yourself)**
   - **Eliminate Duplication**: Extract common patterns into reusable functions
   - **Single Source of Truth**: Cell state managed in backend, frontend is view layer
   - **Shared Logic**: Formula evaluation, coordinate conversion, cell reference parsing all centralized
   - **Examples in Codebase**:
     - `model/coords.go`: Centralized coordinate conversion (A1 notation ↔ row/col)
     - `model/formula.go`: All formula functions use common `toNumber()`, `valueToStr()` helpers
     - `frontend/app.js`: Reusable `selectCell()`, `refreshAllCells()` for state management

4. **Code Organization**
   - **Clear Module Boundaries**: `model/` (business logic), `controller/` (API), `server/` (HTTP), `frontend/` (UI)
   - **Minimal Dependencies**: Only essential packages (participle for parsing, Playwright for testing)
   - **No God Objects**: Each module has focused responsibility
   - **Testability First**: Architecture designed for easy unit and integration testing

### Quality Gates Before Release

Before any release or major milestone, the following quality gates MUST be passed:

1. **All Tests Passing**
   - ✅ All Go unit tests must pass: `cd tests && go test`
   - ✅ All Playwright UI tests must pass: `./test.sh`
   - ✅ No skipped tests without documented justification
   - ✅ Manual smoke testing of critical user flows

2. **Code Quality Checks**
   - ✅ No compiler warnings or errors
   - ✅ Run `go vet` and address all issues
   - ✅ No obvious code duplication (DRY violations)
   - ✅ Functions remain reasonably sized and focused
   - ✅ No commented-out code blocks (remove or document why)

3. **Documentation Current**
   - ✅ BMAD.md reflects current architecture and decisions
   - ✅ README.md has accurate setup/running instructions
   - ✅ All new features documented in BMAD.md "Bug Fixes and Improvements"
   - ✅ Test coverage section updated with current numbers

4. **Clean Repository State**
   - ✅ No unused/dead code in the repository
   - ✅ No temporary debug files committed
   - ✅ All dependencies in go.mod are actually used
   - ✅ Git history is clean (meaningful commit messages)

5. **Functional Requirements**
   - ✅ All features in current milestone working as specified
   - ✅ No known critical bugs or data corruption issues
   - ✅ Performance is acceptable for typical use cases
   - ✅ UI is responsive and provides appropriate feedback

**Release Checklist Command Sequence**:
```bash
# 1. Run all tests
cd tests && go test && cd ..
./test.sh

# 2. Check for issues
go vet ./...
go build ./...

# 3. Verify documentation is current
git status  # Should show no uncommitted changes to docs

# 4. Tag release (when ready for versioning)
# git tag -a v0.x.0 -m "Release description"
```

## BMAD Phases Applied to GoSheet

### Phase 1: Planning ✅ COMPLETED
Following BMAD's planning workflows:

1. **Product Brief** (`specs/PRODUCT_BRIEF.md`)
   - Problem statement
   - Target users
   - MVP scope definition
   - Success metrics
   - Status: **APPROVED**

2. **Technical Specification** (`specs/TECH_SPEC.md`)
   - Architecture overview
   - Component design
   - Technology stack
   - Performance considerations
   - Status: **APPROVED**

3. **Formula Grammar Specification** (`specs/FORMULA_GRAMMAR.md`)
   - Detailed parser implementation
   - AST design
   - Evaluation strategy
   - Status: **APPROVED**

### Phase 2: Implementation ✅ MOSTLY COMPLETED
Following BMAD's iterative development approach:

**Completed Components**:
- ✅ Project setup (Go module, dependencies)
- ✅ Core data model (Spreadsheet, Cell)
- ✅ Coordinate conversion utilities (`model/coords.go`)
- ✅ Formula parser (participle grammar in `model/formula_ast.go`)
- ✅ Formula evaluator with lazy vectors (`model/formula.go`)
- ✅ Go HTTP server with REST API (`server/main.go`)
- ✅ Standalone web frontend (HTML/CSS/JavaScript)
- ✅ Application controller (`controller/app.go`)
- ✅ Comprehensive Playwright UI test suite (29 tests)
- ✅ String functions (CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID)
- ✅ Formula bar for viewing/editing cell content
- ✅ Infinite scrolling/dynamic grid expansion
- ✅ File operations (save/load binary format with gob encoding)

**Development Principles Applied**:
- ✅ Built working increments
- ✅ Test-driven development
- ✅ Continuous validation against specs
- ✅ Iterative refinement based on testing

### Phase 3: Testing & Validation ✅ COMPLETED
Following BMAD's quality assurance practices:

**Testing Infrastructure**:
- ✅ Unit tests for coordinate conversion (`tests/coords_test.go`)
- ✅ Unit tests for data model (`tests/model_test.go`)
- ✅ Unit tests for formula evaluation (`tests/formula_test.go`)
- ✅ **Playwright automated UI tests** (`playwright_tests/test_spreadsheet.py`)
  - 30 comprehensive tests covering all core functionality
  - 29 passing, 1 skipped (Playwright keyboard event limitation) ✅
  - Includes regression tests for bug fixes
  - Covers features: formulas, string functions, formula bar, infinite scrolling
- ✅ Automated test runner (`test.sh`) with server management
- ✅ Comprehensive logging for debugging

**Test Results**:
- Go unit tests: 10/10 passing ✅
- Playwright UI tests: 29/30 passing (1 skipped) ✅
- Test execution time: ~40 seconds total
- All quality gates passing

### Phase 4: Deployment ⏳ PENDING
- ⏳ Complete file I/O implementation
- ⏳ Package for macOS distribution
- ⏳ Create user documentation
- ⏳ Release notes

## BMAD Workflow Used

We followed the **Full Planning Path** from BMAD:

```
/product-brief     → Define problem, users, MVP scope
/create-prd        → (Lightweight - integrated into product brief)
/create-architecture → Technical decisions and system design
/create-epics-and-stories → (Implicit in TODO tracking)
```

Then proceeding with implementation:
```
/dev-story         → Implement each feature
/code-review       → Validate quality (ongoing)
```

## Key BMAD Principles Applied

### 1. **Specification Before Implementation**
- All specs approved before coding
- Clear success criteria defined
- Technical decisions documented

### 2. **Iterative Development**
- Breaking work into manageable TODOs
- Building working increments
- Continuous progress tracking

### 3. **AI Collaboration**
- AI acts as expert collaborator, not just code generator
- Structured questions and decision points
- User approval required for major decisions

### 4. **Documentation-First**
- Comprehensive specs in `specs/` directory
- Clear rationale for technical choices
- Future enhancement planning

### 5. **Quality Focus**
- Test strategy defined upfront
- Error handling planned
- Performance considerations documented

## Project Status Tracking

### Completed ✅
- ✅ Product Brief (APPROVED)
- ✅ Technical Specification (APPROVED)
- ✅ Formula Grammar Specification (APPROVED)
- ✅ Go module initialization
- ✅ Dependencies installed
- ✅ Project structure setup
- ✅ Core model implementation (Spreadsheet, Cell)
- ✅ Coordinate conversion utilities
- ✅ Formula parser (participle)
- ✅ Formula evaluator with lazy vectors
- ✅ All built-in functions (SUM, AVG, MIN, MAX, COUNT)
- ✅ UI implementation (Fyne with widget.Table)
- ✅ Cell editing with dialog
- ✅ Formula bar
- ✅ Application controller
- ✅ Comprehensive logging
- ✅ Go unit test suite (18 tests: coords, model, formulas, string functions, file I/O)
- ✅ Playwright UI test suite (32 tests: 31 passing, 1 skipped)
- ✅ Automated test runner with server management (`test.sh`)
- ✅ Test documentation in BMAD.md
- ✅ File I/O implementation (save/load binary format)

### Pending ⏳
- ⏳ Circular reference detection
- ⏳ Formula dependency tracking for optimized recalculation
- ⏳ User documentation
- ⏳ macOS packaging

## Decision Log

Following BMAD's practice of documenting key decisions:

### Decision 1: Data Structure
**Question**: Single map vs. map of maps for cells?
**Decision**: Map of maps (`map[int]map[int]*Cell`)
**Rationale**: Clean numeric model, efficient row operations
**Date**: 2026-02-13

### Decision 2: Formula Parser
**Question**: Use expr library or custom parser?
**Decision**: Participle parser generator
**Rationale**: Native vector support, scalability for large ranges, full syntax control
**Date**: 2026-02-13

### Decision 3: File Format
**Question**: CSV or binary serialization?
**Decision**: Binary format using `encoding/gob`
**Rationale**: Efficient for sparse data, preserves all metadata
**Date**: 2026-02-13

### Decision 4: UI Widget Approach
**Question**: Custom grid widget vs. Fyne's built-in Table?
**Decision**: Switched from custom widget to `widget.Table`
**Rationale**: Custom widget had refresh issues; Table provides reliable rendering and automatic updates
**Date**: 2026-02-13

### Decision 5: Testing Strategy
**Question**: How to test UI functionality effectively?
**Decision**: Multi-layered approach:
1. Go unit tests for core logic
2. Programmatic Fyne UI tests
3. Web demo + Playwright for comprehensive UI testing
**Rationale**: Playwright provides reliable, repeatable UI testing; web demo allows parallel testing infrastructure
**Date**: 2026-02-13

### Decision 6: UI Framework Migration to Wails
**Question**: Continue with Fyne or migrate to different framework?
**Decision**: Migrate to Wails (Go backend + HTML/CSS/JS frontend)
**Rationale**: 
- Fyne's table widget makes true in-cell editing very difficult
- Dialog-based editing is not standard spreadsheet UX
- Wails allows use of professional JavaScript spreadsheet libraries (ag-Grid, Handsontable)
- Can reuse existing web demo code
- Maintains all Go backend code (model, formulas, controller)
- Better UI quality and user experience
**Alternatives Considered**: DarwinKit (native Cocoa), Gio UI, Cogent Core
**Date**: 2026-02-13
**Status**: Attempted but encountered complexity with Wails build system and UI testing

### Decision 7: Simplify to Go Backend + Web Frontend
**Question**: Continue with Wails complexity or simplify architecture?
**Decision**: Use clean separation: Go HTTP backend + standalone web frontend
**Rationale**:
- **Testability**: Playwright works perfectly with standard web apps
- **Simplicity**: No build system complexity, standard web development
- **Flexibility**: Can package as Electron/Tauri/Wails later for macOS distribution
- **Development speed**: Fast iteration, hot reload, standard debugging
- **Same Go code**: Keep all model/controller/formula logic in Go
- **Production ready**: Can add WebSocket for real-time updates if needed
**Architecture**:
- Go HTTP server with REST/JSON API
- Static HTML/CSS/JS frontend (no build tools needed)
- Playwright for comprehensive UI testing
- Desktop packaging options: Electron, Tauri, or Wails (revisit after stabilization)
**Date**: 2026-02-13
**Status**: ✅ Implemented, all tests passing

### Decision 8: macOS App as End Goal
**Question**: Is the web frontend the final product or a development setup?
**Decision**: Web frontend is a development/testing setup; final product is a native macOS app
**Rationale**:
- **User expectation**: Desktop spreadsheet app, not a web app
- **Native features**: File associations, menu bar, dock integration, offline use
- **Distribution**: macOS .app bundle via App Store or direct download
- **Current approach enables this**: Clean backend/frontend separation makes packaging straightforward
**Packaging Options**:
1. **Electron**: Mature, well-tested, large bundle size (~100MB)
2. **Tauri**: Rust-based, smaller bundle (~10MB), uses system WebView
3. **Wails**: Go-native, revisit after core features stabilize
**Timeline**: After file operations (save/load) are implemented
**Date**: 2026-02-13

### Decision 9: File Dialog Evolution
**Question**: How to handle file dialogs in browser vs desktop app?
**Decision**: Two-phase approach - browser File API now, native dialogs later
**Current Implementation (Browser)**:
- **Save**: Uses HTML5 download API - downloads to Downloads folder
- **Load**: Uses `<input type="file">` - opens browser file picker
- **Limitation**: Cannot choose save location, limited to browser security sandbox
- **API Endpoints**: `/api/file/download` (GET) and `/api/file/upload` (POST)
- **File Status**: Shows "● Unsaved changes" or "✓ Saved" (tracks serialization state, not file paths)
- **Known Limitation**: Status changes to "Saved" when download is initiated, even if user cancels the browser's save dialog
  - **Why**: Backend writes to temp file and serves it; browser's save/cancel decision is invisible to backend
  - **Impact**: Minor UX issue - status may show "Saved" when user cancelled
  - **Resolution**: Accept for browser mode; will be fixed in desktop app with native dialogs
**Future Implementation (Desktop App)**:
- **Save**: Native "Save As" dialog with full file system access
- **Load**: Native "Open" dialog
- **File Status**: Re-add status bar showing file path and unsaved changes indicator
- **Backend writes directly to destination**: No temp files, backend knows exactly when save succeeds/fails
- **Changes Needed**:
  1. Replace download/upload endpoints with native dialog integration
  2. Use Electron's `dialog.showSaveDialog()` and `dialog.showOpenDialog()`
  3. Or Tauri's file dialog APIs
  4. Backend writes directly to user-chosen file path (no temp files)
  5. Remove hidden `<input type="file">` element
  6. Update frontend to call native APIs instead of download/upload
  7. Re-add file status display with real file paths
  8. Keep old `/api/file/save` and `/api/file/load` endpoints for backward compatibility
**Date**: 2026-02-13
**Status**: ✅ Browser implementation complete, desktop packaging pending

## Bug Fixes and Improvements

Following BMAD's practice of documenting issues and resolutions:

### Bug Fix 1: Value Disappearing on Click Away
**Date**: 2026-02-13
**Reported**: User reported "enter a value, then click on another cell and the entered value disappears"
**Root Cause**: `selectCell()` was calling `forceCleanupEditing()` which removed the input element without saving
**Fix**: Modified `selectCell()` to extract and save the current edit value before switching cells
**Test Added**: `test_click_away_saves_value` - verifies typing "99" and clicking away saves the value
**Status**: ✅ Fixed and tested

### Bug Fix 2: Empty Cell References Should Error
**Date**: 2026-02-13
**Reported**: User requirement: "when I reference an empty cell, this should be an error, not 0"
**Previous Behavior**: `=A1+5` where A1 is empty returned 5 (treating empty as 0)
**New Behavior**: `=Z99+1` where Z99 is empty shows `#ERROR: reference to empty cell`
**Implementation**:
- Modified `evaluateCellRef()` to return `ErrorValue` for empty cells (where `Value == ""`)
- Added ErrorValue propagation in arithmetic/comparison operations (short-circuit on ErrorValue)
- Updated test expectations: `TestEvaluateEmptyCell` now expects "#ERROR" in result
**Test Added**: `test_empty_cell_reference_shows_error` - verifies empty cell refs produce error
**Status**: ✅ Fixed and tested

### Bug Fix 3: Functions Not Checking Empty Cells in Ranges
**Date**: 2026-02-13
**Reported**: User requirement: "SUM is not checking for empty cells? Check all functions."
**Previous Behavior**: `=SUM(A1:A10)` with empty cells in range treated them as 0
**New Behavior**: Ranges with empty cells produce `#ERROR: reference to empty cell`
**Implementation**:
- Modified `evaluateRange()` to return ErrorValue for nil or empty cells
- Updated all numeric functions (SUM, AVG, MIN, MAX, COUNT) to propagate ErrorValue from vectors
- Changed error returns from `(err, err)` to `(err, nil)` for proper error display
**Tests Added**: 
- `TestRangeWithEmptyCells` - Go unit test for all functions with empty cells in ranges
- `test_sum_with_empty_cells_shows_error` - Playwright test
**Status**: ✅ Fixed and tested

### Feature: Formula Bar
**Date**: 2026-02-13
**Requested**: User: "it should work with single click, too, or I don't see that this is a formula"
**Implementation**: Added Excel-style formula bar showing cell reference and raw content
**Features**:
- Shows cell reference (e.g., "B1") and raw formula/value
- Editable: type and press Enter to save, Escape to cancel
- Updates automatically when cells are edited
- Enter moves to next row (Excel-like behavior)
**Tests Added**:
- `test_formula_bar_shows_formula` - verifies bar displays formulas
- `test_formula_bar_editing` - verifies editing from bar works
- `test_edit_formula_cell_shows_formula` - verifies double-click shows formula
- `test_formula_bar_updates_after_edit` - verifies bar stays in sync
**Status**: ✅ Implemented and tested

### Feature: String Functions
**Date**: 2026-02-13
**Requested**: User: "Do we have any string functions, such as string concat?"
**Implementation**: Added 7 string manipulation functions
**Functions**:
- CONCAT(str1, str2, ...) - concatenate strings
- UPPER(str) - convert to uppercase
- LOWER(str) - convert to lowercase
- LEN(str) - string length
- LEFT(str, n) - first n characters
- RIGHT(str, n) - last n characters
- MID(str, start, len) - substring (1-based, Excel-compatible)
**Implementation Details**:
- Fixed `normalizeFormula()` to preserve case inside string literals
- Added `valueToStr()` helper for string conversion
**Tests Added**:
- `TestStringFunctions` - Go unit test with 15 test cases
- `test_string_functions` - Playwright test for all 7 functions
**Status**: ✅ Implemented and tested

### Feature: Infinite Scrolling
**Date**: 2026-02-13
**Reported**: User: "The # of rows/columns is restricted, conflicting with the tech spec"
**Requirement**: Tech spec says "Grid size: Unlimited (sparse storage)", backend supports 2^31 rows/cols
**Implementation**: Dynamic grid expansion via scroll and navigation
**Features**:
- Grid starts at 100 rows × 26 columns
- Expands when scrolling within 20% of edges
- Expands when navigating within 10 rows/cols of edges
- Adds 50 rows or 10 columns per expansion
- Preserves scroll position during rebuild
**Tests Added**:
- `test_infinite_scroll_expands_grid` - verifies scroll triggers expansion
- `test_large_grid_dimensions` - verifies formulas can reference distant cells
**Status**: ✅ Implemented and tested

### Feature: File Operations (Save/Load)
**Date**: 2026-02-13
**Implementation**: Complete save/load functionality with binary file format
**File Format**:
- Binary format using Go's `encoding/gob` for efficient serialization
- File header with version (1.0) and cell count metadata
- Sparse storage - only non-empty cells are saved
- Preserves formulas, computed values, and cell metadata
**Backend Components**:
- `model/file.go`: SaveToFile(), LoadFromFile(), SaveAs() methods
- File header validation and version checking
- Automatic recalculation of formulas after loading
**API Endpoints**:
- POST `/api/file/save` - save spreadsheet to specified path
- POST `/api/file/load` - load spreadsheet from specified path
- POST `/api/file/new` - create new empty spreadsheet
- GET `/api/file/status` - get current file path and unsaved changes status
**Frontend UI**:
- Toolbar with New, Save, Load buttons
- File status display showing current file path and unsaved changes indicator (*)
- Prompt dialogs for file path input
- Automatic grid refresh after load operation
**Tests Added**:
- `TestSaveAndLoadEmptySpreadsheet` - Go unit test for empty file
- `TestSaveAndLoadWithData` - Go unit test for file with data
- `TestSaveAndLoadFormulas` - Go unit test for formulas preservation
- `TestSaveAsNewFile` - Go unit test for Save As functionality
- `TestLoadNonExistentFile` - Go unit test for error handling
- `TestHasUnsavedChanges` - Go unit test for modified flag
- `TestSparseStorageEfficiency` - Go unit test for sparse data (cells at row 1000, col 1000)
- `test_save_and_load_file` - Playwright test for complete save/load workflow
- `test_new_file_clears_data` - Playwright test for New File button
- `test_file_status_display` - Playwright test for status display
**Status**: ✅ Implemented and tested (18 Go unit tests, 31 Playwright tests)

### Bug Fix 4: File Status Display Confusion
**Date**: 2026-02-13
**Reported**: User: "why do we have a file name at the top of the screen and it's incorrect?"
**Issue**: File status was showing temp file paths (`/tmp/gosheet_download.gosheet`)
**Initial Misunderstanding**: Thought we couldn't track save state because browser downloads are fire-and-forget
**Correct Insight** (user feedback): "You know when you read from a file or write to a file. That's the important thing, not the file sel dialog."
**Solution**: Track serialization/deserialization, not file dialog completion
- **Save (download)**: We serialize the state → Clear "unsaved changes"
- **Load (upload)**: We deserialize the state → Clear "unsaved changes"  
- **Edit**: We modify the state → Set "unsaved changes"
**Changes**:
- Restored `#file-status` element showing "● Unsaved changes" or "✓ Saved"
- `handleDownloadFile()`: Clears Modified flag (we've serialized the data)
- Frontend calls `updateFileStatus()` after save/load/edit operations
- Don't show file paths (temp files not meaningful in browser mode)
**Test**: `test_file_status_tracks_changes` - verifies status updates correctly
**Status**: ✅ Fixed - status now correctly tracks data serialization state

### Feature: Unsaved Changes Warning on New File
**Date**: 2026-02-13
**Requested**: User: "and add a warning dialog before 'new' if the status is 'modified'."
**Implementation**: Check for unsaved changes before creating new file
**Behavior**:
- If no unsaved changes: Shows "Create a new spreadsheet?"
- If unsaved changes: Shows "You have unsaved changes! Create a new spreadsheet anyway? All unsaved changes will be lost."
- User can cancel to keep current data
**Implementation**:
- New button handler calls `GetFileStatus()` before showing confirm dialog
- Different confirm message based on `hasUnsavedChanges` flag
- Uses native `confirm()` dialog (works in regular browsers and Playwright)
**Known Limitation**: Cursor's embedded browser has non-blocking dialogs - `confirm()` returns true immediately without showing dialog
**Future Enhancement**: Replace native dialogs with custom modal UI for better UX and Cursor browser compatibility
**Test Added**: `test_new_file_warns_on_unsaved_changes` - verifies warning shown and data preserved on cancel
**Status**: ✅ Implemented and tested (works in regular browsers, limitation in Cursor browser only)

### Feature: Formula Dependency Tracking and Circular Reference Detection
**Date**: 2026-02-13
**Problem**: Original implementation recalculated ALL formulas whenever any cell changed, which is inefficient for large spreadsheets. No detection of circular references (A1→B1→A1) which could cause infinite loops.
**Solution**: Implemented dependency graph to track which cells depend on which, enabling:
1. **Smart Recalculation**: Only recalculate cells affected by changes, not all formulas
2. **Topological Sorting**: Calculate dependencies before dependents (correct order)
3. **Circular Reference Detection**: Detect cycles before they cause problems
4. **Performance**: O(affected cells) instead of O(all formulas)

**Implementation**:
- **`model/dependencies.go`**: New dependency graph data structure
  - `DependencyGraph`: Tracks dependents and dependencies for each cell
  - `ExtractCellReferences()`: Parses formulas to find cell references
  - `ExpandRange()`: Expands A1:B3 into individual cells
  - `DetectCircularReference()`: DFS-based cycle detection
  - `GetCalculationOrder()`: Topological sort for correct recalc order
- **`model/spreadsheet.go`**: Added `Dependencies *DependencyGraph` field
- **`controller/app.go`**: Updated to use dependency graph
  - `SetCellValue()`: Extracts dependencies, checks for cycles, updates graph
  - `recalculateDependents()`: Smart recalculation using topological order
  - `rebuildDependencyGraph()`: Rebuilds graph when loading files
  - Falls back to `recalculateAllFormulas()` if graph unavailable

**Circular Reference Handling**:
- Detected before adding to graph (prevents infinite loops)
- Shows error: `#ERROR: Circular reference: A1 → B1 → C1 → A1`
- Cell displays error, no recalculation performed

**Tests Added** (13 new tests in `tests/dependencies_test.go`):
- `TestExtractCellReferences`: Reference extraction from formulas
- `TestExpandRange`: Range expansion (A1:B3)
- `TestDependencyGraphBasic`: Basic dependency tracking
- `TestDependencyGraphMultiple`: Dependency chains
- `TestRemoveDependencies`: Cleanup when cells change
- `TestCircularReferenceDetection`: Simple cycle detection
- `TestCircularReferenceDetectionLongerChain`: Multi-hop cycles
- `TestNoCircularReferenceWhenNoCycle`: False positive check
- `TestCalculationOrder`: Topological sort verification
- `TestCalculationOrderMultipleBranches`: Diamond dependencies
- `TestCalculationOrderWithCircularReference`: Error on cycles
- `TestIntegrationWithSpreadsheet`: Integration test

**Performance Improvement**:
- Before: O(n) where n = total formulas in spreadsheet
- After: O(m) where m = formulas affected by change
- Example: Changing A1 in a 1000-formula sheet with 3 dependents: 1000 → 3 recalculations

**Status**: ✅ Implemented and tested (39 Go unit tests passing)

### Feature: Formula Normalization
**Date**: 2026-02-13
**Problem**: Formulas entered with lowercase cell references or extra spaces (e.g., `= a1 + b2 `) were stored as-is, making them inconsistent and harder to compare.
**Solution**: Automatically normalize formulas when they're stored by:
1. Converting cell references to uppercase (a1 → A1)
2. Removing extra whitespace
3. Preserving string literals (quotes) exactly as entered

**Implementation**:
- **`model/formula.go`**: Added `NormalizeFormula()` function that parses and re-serializes formulas
- Added serialization functions for each AST node type (Expression, Comparison, Addition, etc.)
- **`model/cell.go`**: Updated `NewCell()` and `SetValue()` to normalize formulas automatically
- Normalization happens transparently - users can type `=a1+b2` and it's stored as `=A1+B2`

**Examples**:
- Input: `=a1+b2` → Stored: `=A1+B2`
- Input: `= A1 + B2 ` → Stored: `=A1+B2`
- Input: `=sum(a1:a10)` → Stored: `=SUM(A1:A10)`
- Input: `=CONCAT("hello", " ", "world")` → Stored: `=CONCAT("hello"," ","world")` (strings preserved)

**Tests Added** (3 new tests in `tests/normalize_test.go`):
- `TestNormalizeFormula`: Tests normalization function with various inputs
- `TestCellNormalizesFormulas`: Tests that Cell automatically normalizes
- `TestSpreadsheetNormalizesFormulas`: Integration test with Spreadsheet

**Status**: ✅ Implemented and tested (42 Go unit tests passing)

## Next Steps

Following BMAD's iterative approach:

1. ✅ ~~Complete project structure setup~~
2. ✅ ~~Implement core data model~~
3. ✅ ~~Build formula parser~~
4. ✅ ~~Create basic UI~~
5. ✅ ~~Write tests~~
6. ✅ ~~Add file operations (save/load)~~
7. ✅ ~~Implement formula dependency tracking~~
8. ✅ ~~Add circular reference detection~~
9. ⏳ Create user documentation
10. ⏳ Convert to native desktop app (Electron/Tauri)
    - Implement native file dialogs (Save As, Open)
    - Backend writes directly to user-chosen file paths
    - Remove browser File API workarounds
    - Update file status to show real file paths and correct status
11. ⏳ Package for macOS distribution

## BMAD Success Metrics

This project demonstrates BMAD's effectiveness:

### Planning Phase
- ✅ **Structured planning**: All specs written and approved before implementation
- ✅ **Clear success criteria**: Defined in product brief
- ✅ **Technical decisions**: Researched and documented (4 major decisions logged)

### Implementation Phase
- ✅ **Iterative development**: Built in working increments
- ✅ **Test-driven**: Tests written alongside implementation
- ✅ **Continuous validation**: Regular testing against specs
- ✅ **Problem solving**: Adapted approach when issues arose (e.g., UI widget switch)

### Testing Phase
- ✅ **Comprehensive coverage**: 42 Go unit tests + 32 Playwright UI tests
- ✅ **Automated testing**: Full test suite with server management
- ✅ **Quality assurance**: 41/42 tests passing (1 skipped by design)
- ✅ **Regression testing**: Every bug fix has dedicated test(s)
- ✅ **Documentation**: Test results and coverage documented in BMAD.md
- ✅ **Code review**: Adversarial review identified and fixed 9 issues

### AI Collaboration
- ✅ **Expert guidance**: Not just code generation, but architecture decisions
- ✅ **User approval**: Major decisions required user sign-off
- ✅ **Iterative refinement**: Multiple rounds of feedback and improvement
- ✅ **Knowledge transfer**: Comprehensive documentation for future work

## Current Phase Status

**Phase**: Implementation → Testing & Validation ✅
**Status**: Architecture simplification complete, all UI tests passing
**Next**: Documentation updates, file operations (save/load)

### Completed Work
The project has successfully completed the core MVP as defined in the product brief:
- ✅ Basic grid with unlimited dimensions (infinite scrolling)
- ✅ **In-cell editing** (true spreadsheet-style editing)
- ✅ **Formula bar** for viewing/editing cell content
- ✅ Numeric formulas (SUM, AVG, MIN, MAX, COUNT)
- ✅ String functions (CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID)
- ✅ Arithmetic operations (+, -, *, /, %)
- ✅ **File operations** (save/load with binary format)
- ✅ **Comprehensive testing** (42 Go unit tests, 32 Playwright UI tests)
- ✅ Row/column headers
- ✅ **Clean architecture** (Go HTTP backend + standalone web frontend)

### Architecture Evolution

The project went through several UI framework iterations:
1. **Fyne** → Limited in-cell editing capabilities
2. **Wails** → Build complexity, testing difficulties
3. **Go HTTP + Web Frontend** → Clean separation, easy testing, but complexity around file handling

**Current Architecture Benefits**:
- ✅ Testable with standard web tools (Playwright)
- ✅ Simple development workflow (no build system complexity)
- ✅ Clean API separation (REST endpoints)
- ✅ Maintains all Go backend code (model, formulas, controller)
- ✅ Professional in-cell editing UX

**Future Path to macOS App**:
The current web architecture is designed to enable easy packaging as a native macOS app:
- **Option 1**: Electron/Tauri wrapper (web frontend + Go backend)
- **Option 2**: Wails (revisit after core features stabilize)
- **Goal**: Native macOS .app bundle with menu bar, file associations, etc.
- **Non-goal**: Pure web app - this is a desktop application project

### Test Coverage (32/33 tests, 1 skipped)
**Go Unit Tests (42 passing)**:
- Formula parsing and evaluation
- Cell reference evaluation
- Empty cell error handling
- String functions (CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID)
- Numeric functions with empty cells in ranges (SUM, AVG, MIN, MAX, COUNT)
- File I/O: save/load empty spreadsheet
- File I/O: save/load with data and formulas
- File I/O: sparse storage efficiency (distant cells)
- File I/O: SaveAs, unsaved changes tracking
- File I/O: error handling for non-existent files

**Playwright UI Tests (32 passing, 1 skipped)**:
- Page loading and grid structure
- Sample data loading
- Cell selection and navigation (arrow keys)
- Single and multi-digit number entry
- Multiple value entry across cells
- Cell editing and cancellation (ESC key)
- Simple formulas (=5+3)
- Cell reference formulas (=A1+A2)
- Formula persistence and display
- Tab key navigation between cells
- Formula dependency recalculation
- Click away saves value (bug fix test)
- Empty cell reference shows error (bug fix test)
- Large grid dimensions (distant cell references)
- Infinite scroll expands grid
- String functions (all 7 functions)
- Formula bar shows formula
- Formula bar editing
- Edit formula cell shows formula
- Formula bar updates after edit
- SUM with empty cells shows error
- Save and load file workflow
- New file clears data
- File status display
- Circular reference detection (UI test)

---

## Code Review: Dependency Tracking & Formula Normalization (Feb 2026)

After implementing dependency tracking, circular reference detection, and formula normalization, an adversarial code review was conducted to identify potential issues. The review found **11 issues** (6 High, 3 Medium, 2 Low), of which **9 were fixed immediately**.

### Issues Fixed

#### HIGH SEVERITY

**#2: Circular reference check happened AFTER cell was set**
- **Problem**: `SetCell()` was called before checking for circular references, causing the cell and `Modified` flag to be set even when the circular reference prevented the formula from being valid.
- **Fix**: Moved circular reference detection to occur BEFORE any state modification. Extract cell references from the formula, check for cycles, and only proceed with `SetCell()` if no cycle is detected.
- **Files**: `controller/app.go`

**#3: Missing range expansion in dependency extraction**
- **Problem**: `ExtractCellReferences()` extracted only the start and end cells from ranges (e.g., A1 and A10 from `=SUM(A1:A10)`), missing intermediate cells. This caused incomplete dependency graphs - changing A5 wouldn't trigger recalculation of `=SUM(A1:A10)`.
- **Fix**: Modified `ExtractCellReferences()` to expand ranges into all individual cells using the existing `ExpandRange()` function.
- **Files**: `model/dependencies.go`
- **Tests Updated**: `tests/dependencies_test.go` - updated test expectations to match new behavior (ranges now expand to all cells)

**#4: No Playwright tests for circular references**
- **Problem**: 13 Go unit tests existed for circular reference detection, but zero UI tests verified that users actually see the error message in the browser.
- **Fix**: Added `test_circular_reference_detection()` to verify circular reference errors appear in the UI for both simple (A1→B1→A1) and longer chains (A1→B1→C1→A1).
- **Files**: `playwright_tests/test_spreadsheet.py`
- **Test Count**: 32 Playwright tests (was 31)

**#5: Dependency graph not thread-safe**
- **Problem**: Multiple HTTP request handlers could modify the dependency graph concurrently, causing race conditions and corrupted graph state.
- **Fix**: Added `sync.RWMutex` to `DependencyGraph` struct and protected all operations with appropriate locks (write lock for Add/Remove, read lock for Get/Detect/Calculate operations).
- **Files**: `model/dependencies.go`

**#6: Formula normalization breaks on parse errors**
- **Problem**: If `NormalizeFormula()` failed, `IsFormula` was set to `true` but the formula wasn't normalized, creating inconsistent state.
- **Fix**: Modified `SetValue()` to only set `IsFormula=true` if normalization succeeds. If normalization fails, treat the input as plain text (`IsFormula=false`).
- **Files**: `model/cell.go`

#### MEDIUM SEVERITY

**#8: No logging of dependency graph operations**
- **Problem**: No visibility into graph operations for debugging dependency issues.
- **Fix**: Added debug logging to `AddDependency()`, `RemoveDependencies()`, and `DetectCircularReference()` using Go's `log` package.
- **Files**: `model/dependencies.go`

**#9: ExtractCellReferences uses regex instead of AST**
- **Problem**: Regex-based extraction could miss references in complex expressions or match false positives.
- **Fix**: Rewrote `ExtractCellReferences()` to parse the formula using the existing AST parser and walk the tree to extract references. Added regex fallback for unparseable formulas.
- **Files**: `model/dependencies.go`
- **Impact**: More accurate dependency tracking, especially for complex nested formulas

#### LOW SEVERITY

**#10: Missing documentation in dependencies.go**
- **Problem**: No package-level documentation explaining the dependency graph's purpose.
- **Fix**: Added comprehensive package comment describing the dependency graph, key operations, and thread-safety guarantees.
- **Files**: `model/dependencies.go`

**#11: Test names inconsistent**
- **Problem**: Mix of `TestDependencyGraphBasic` vs `TestCalculationOrder` naming styles.
- **Fix**: Standardized all test names to `TestDependencyGraph_*` pattern for consistency.
- **Files**: `tests/dependencies_test.go`

### Issues NOT Fixed (Documented as Intentional Design)

**#1: Dependency graph not persisted when saving files**
- **Decision**: Rebuilding the dependency graph on file load is the correct approach. The graph is derived data that can be reconstructed from formulas. Serializing it would add complexity and potential for inconsistency.
- **Implementation**: `LoadFromFile()` calls `rebuildDependencyGraph()` to reconstruct the graph from formulas.

**#7: GetCalculationOrder includes changed cell unnecessarily**
- **Decision**: Changed cells MUST be included in calculation order because they might be formulas themselves that need evaluation. Example: If A1=10 and you change A1 to =C1+2, A1 itself needs recalculation before its dependents.
- **Behavior**: This is correct, not a bug.

### Impact Summary

- **Correctness**: Fixed critical race condition (#5) and circular reference timing issue (#2)
- **Accuracy**: Improved dependency tracking with range expansion (#3) and AST-based extraction (#9)
- **Testing**: Added UI test coverage for circular references (#4)
- **Maintainability**: Added logging (#8), documentation (#10), and consistent naming (#11)
- **Robustness**: Better error handling for invalid formulas (#6)

All tests passing: **42 Go unit tests + 32 Playwright UI tests** (1 skipped by design)
