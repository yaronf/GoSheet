# GoSheet - Lightweight Spreadsheet for macOS

A modern spreadsheet application with a Go backend and web frontend, designed for packaging as a native macOS app. Features true in-cell editing and comprehensive automated testing.

## Architecture

**Native macOS Application**:
- **Backend**: Go HTTP server with REST API  
- **Frontend**: Pure HTML/CSS/JavaScript (ES6 modules)  
- **Native Wrapper**: Electron with IPC for file dialogs
- **Testing**: Playwright with native Electron API support

**Deployment**: Native macOS application (.app bundle)
- Built with Electron for native file operations and dialogs
- Go backend runs as HTTP server (localhost)
- Frontend communicates via HTTP API and Electron IPC

## Features

- ✅ **In-Cell Editing**: True spreadsheet-style editing with keyboard navigation
- ✅ **Formula Engine**: Support for SUM, AVG, MIN, MAX, COUNT and arithmetic operations
- ✅ **Cell References**: Formulas can reference other cells (e.g., =A1+B2)
- ✅ **Keyboard Navigation**: Arrow keys, Enter, Tab, Escape
- ✅ **Grid Display**: Row/column headers with unlimited dimensions
- ✅ **File Operations**: New, Open, Save with native dialogs
- ✅ **Comprehensive Testing**: 38 Playwright tests + 42 Go unit tests

## Development Methodology

This project is built using the **BMAD (Breakthrough Method for Agile AI Driven Development)** methodology. See [BMAD.md](BMAD.md) for details on how BMAD principles are applied.

## Project Structure

```
spreadsheet/
├── BMAD.md                 # BMAD methodology documentation
├── README.md               # This file
├── go.mod                  # Go module definition
├── server/                 # HTTP backend
│   └── main.go            # REST API server
├── frontend/               # Web frontend
│   ├── index.html         # Main HTML
│   ├── app.js             # Spreadsheet logic
│   ├── style.css          # Base styles
│   └── spreadsheet.css    # Grid styles
├── specs/                  # Design specifications
│   ├── PRODUCT_BRIEF.md
│   ├── TECH_SPEC.md
│   └── FORMULA_GRAMMAR.md
├── model/                  # Core data model
│   ├── spreadsheet.go
│   ├── formula.go
│   ├── formula_ast.go
│   ├── cell.go
│   └── coords.go
├── controller/             # Application logic
│   └── app.go
├── tests/                  # Go unit tests
│   ├── model_test.go
│   ├── formula_test.go
│   └── coords_test.go
└── playwright_tests/       # UI tests
    ├── test_spreadsheet.py
    ├── conftest.py
    └── run_tests.sh
```

## Quick Start

### 1. Start the Backend Server

```bash
cd server
go run main.go
```

Server runs at `http://localhost:3000`

### 2. Open in Browser

Navigate to `http://localhost:3000` in your web browser.

The frontend is served directly by the Go server - no separate build step needed!

## Testing

### Playwright Electron Tests

**All 38 tests passing!** ✅

```bash
# Run all Playwright tests (Electron)
npm test

# Run specific test file
npx playwright test test_spreadsheet.spec.js

# Run only failed tests
npx playwright test --last-failed

# View HTML report
npx playwright show-report
```

**Test Coverage (38 tests):**

1. **Smoke Tests** (2 tests)
   - App launches and shows grid
   - Window title is correct

2. **Core Spreadsheet Tests** (30 tests)
   - Cell selection and navigation (arrow keys, click)
   - Cell editing (click, double-click, keyboard)
   - Formula evaluation (arithmetic, references, dependencies)
   - Modal dialogs (unsaved changes warnings)
   - Keyboard shortcuts (Delete, Escape, Enter, Tab)
   - Formula bar functionality

3. **Dialog Stubbing Tests** (3 tests)
   - Stub open dialog
   - Stub save dialog
   - Test dialog cancellation

4. **File Operation Tests** (5 tests)
   - New spreadsheet workflow
   - Open file workflow (with unsaved changes check)
   - Save file workflow
   - File status tracking (saved/unsaved)
   - Dialog cancellation handling

**Test Features:**
- ✅ Runs headless (no visible windows) with `NODE_ENV=test`
- ✅ Uses `electron-playwright-helpers` for dialog stubbing
- ✅ Tests full stack: UI → IPC → Backend → File system
- ✅ No manual intervention required

### Go Unit Tests

**All 42 tests passing!** ✅

```bash
# Run all Go tests
go test ./tests/...

# Run with verbose output
go test -v ./tests/...

# Run specific test file
go test ./tests/formula_test.go -v

# Run with coverage
go test -cover ./tests/...
```

**Test Coverage:**
- Cell model and coordinate conversion
- Formula parser and evaluator
- Dependency graph and formula updates
- File I/O (gob encoding/decoding)
- Spreadsheet operations

### Run All Tests

```bash
# Run both test suites (Go first, then Playwright)
npm run test:all

# Or run separately
npm run test:unit  # Go tests only
npm test           # Playwright tests only
```

### Test Execution Times

- **Playwright tests**: ~2 minutes (38 tests)
- **Go unit tests**: <1 second (42 tests)
- **Total**: ~2 minutes for complete test suite

### CI/CD Integration

Tests run automatically on every push and pull request via GitHub Actions.

**Workflow:** `.github/workflows/test.yml`

**What runs:**
1. Go unit tests (42 tests)
2. Playwright Electron tests (38 tests)
3. Test results uploaded as artifacts

**View results:**
- Check the "Actions" tab in GitHub
- Download test reports and traces from failed runs

**Local CI simulation:**
```bash
# Run the same tests as CI
npm run test:all
```

## Requirements

### Backend
- Go 1.21+
- No external dependencies (uses standard library)

### Frontend
- Modern web browser (Chrome, Firefox, Safari)
- No build tools required (pure HTML/CSS/JS)

### Testing
- Node.js 18+
- Playwright 1.59.0-alpha (Electron support)
- Electron 30.5.1

## Dependencies

**Go Backend:**
- [Participle v2](https://github.com/alecthomas/participle) - Formula parser
- [Testify](https://github.com/stretchr/testify) - Testing framework

**Frontend:**
- None! Pure vanilla JavaScript

**Testing:**
- [Playwright](https://playwright.dev/) - Electron automation
- [electron-playwright-helpers](https://github.com/spaceagetv/electron-playwright-helpers) - Dialog stubbing

## Status

✅ **Native App Complete** - Following BMAD methodology

**Completed Epics:**
- ✅ Epic 1: Core Spreadsheet Engine (Go backend)
- ✅ Epic 2: Web Frontend (HTML/CSS/JS)
- ✅ Epic 3: Electron Implementation (IPC, file dialogs)
- ✅ Epic 4: Native File Operations (New, Open, Save)
- ✅ Epic 5: Playwright Electron Testing (38 tests)

**Current Sprint:**
- ⏳ Epic 5: Test verification and CI/CD integration

**Next Milestones:**
- Epic 6: CSV Import/Export
- Epic 7: macOS Integration & Polish (menus, shortcuts, dock)
- Epic 8: Welcome Screen & Lifecycle

See [BMAD.md](BMAD.md) for detailed development history and decisions.

## License

MIT License (to be added)

## Contributing

This is a personal project following BMAD methodology. Contributions welcome after initial release.
