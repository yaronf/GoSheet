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
- ⏳ File serialization (binary format) - **PENDING**

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
- ✅ Programmatic UI tests (`ui_test/ui_test.go`)
- ✅ **Playwright automated UI tests** (`playwright_tests/test_spreadsheet.py`)
  - 18 comprehensive tests covering all core functionality
  - 17 passing, 1 skipped (Playwright keyboard event limitation) ✅
  - Includes regression tests for bug fixes
- ✅ Web-based demo application for manual testing
- ✅ Comprehensive logging for debugging

**Test Results**:
- Go unit tests: All passing ✅
- Playwright UI tests: 17/18 passing (1 skipped) ✅
- Test execution time: ~20 seconds total

See [TEST_RESULTS.md](TEST_RESULTS.md) for detailed test coverage.

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
- ✅ Go unit test suite (coords, model, formulas)
- ✅ Playwright UI test suite (11 tests)
- ✅ Web demo application
- ✅ Test documentation

### Pending ⏳
- ⏳ File I/O implementation (save/load binary format)
- ⏳ Circular reference detection
- ⏳ Formula dependency tracking for recalculation
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

## Next Steps

Following BMAD's iterative approach:

1. ✅ ~~Complete project structure setup~~
2. ✅ ~~Implement core data model~~
3. ✅ ~~Build formula parser~~
4. ✅ ~~Create basic UI~~
5. ✅ ~~Write tests~~
6. ⏳ Add file operations (save/load)
7. ⏳ Implement formula dependency tracking
8. ⏳ Add circular reference detection
9. ⏳ Create user documentation
10. ⏳ Package for distribution

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
- ✅ **Comprehensive coverage**: Unit tests + UI tests
- ✅ **Automated testing**: Playwright suite with 11 tests
- ✅ **Quality assurance**: All tests passing
- ✅ **Documentation**: Test results and coverage documented

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
- ✅ Basic grid with unlimited dimensions
- ✅ **In-cell editing** (true spreadsheet-style editing)
- ✅ Simple formulas (SUM, AVG, MIN, MAX, COUNT)
- ✅ Arithmetic operations
- ✅ **Comprehensive UI testing** (13 Playwright tests, all passing)
- ✅ Row/column headers
- ✅ Application icon
- ✅ **Clean architecture** (Go HTTP backend + standalone web frontend)

### Architecture Evolution

The project went through several UI framework iterations:
1. **Fyne** → Limited in-cell editing capabilities
2. **Wails** → Build complexity, testing difficulties
3. **Go HTTP + Web Frontend** → Clean separation, easy testing ✅

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

### Test Coverage (29/30 tests, 1 skipped)
**Go Unit Tests (10 passing)**:
- Formula parsing and evaluation
- Cell reference evaluation
- Empty cell error handling
- String functions (CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID)
- Numeric functions with empty cells in ranges (SUM, AVG, MIN, MAX, COUNT)

**Playwright UI Tests (29 passing, 1 skipped)**:
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
