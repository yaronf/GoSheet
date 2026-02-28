# GoSheet - Lightweight Spreadsheet for macOS

[![Build](https://github.com/yaronf/GoSheet/actions/workflows/test.yml/badge.svg)](https://github.com/yaronf/GoSheet/actions/workflows/test.yml)

A modern spreadsheet application with a Go backend and web frontend, designed for packaging as a native macOS app. Features true in-cell editing and comprehensive automated testing.

## Architecture

**Native macOS Application (Electron)**:
- **Backend**: Go HTTP server with REST API  
- **Frontend**: Pure HTML/CSS/JavaScript (ES6 modules)  
- **Native Wrapper**: Electron with IPC for file dialogs
- **Testing**: Playwright with native Electron API support

**Deployment**: Native macOS application (.app bundle)
- Built with electron-builder for packaging
- Go backend runs as HTTP server (localhost:3000)
- Frontend communicates via HTTP API and Electron IPC
- Single-window architecture

## Features

- ✅ **In-Cell Editing**: True spreadsheet-style editing with keyboard navigation
- ✅ **Formula Engine**: Support for SUM, AVG, MIN, MAX, COUNT and arithmetic operations
- ✅ **Cell References**: Formulas can reference other cells (e.g., =A1+B2)
- ✅ **Keyboard Navigation**: Arrow keys, Enter, Tab, Escape
- ✅ **Grid Display**: Row/column headers with unlimited dimensions
- ✅ **File Operations**: New, Open, Save, Save As with native dialogs
- ✅ **CSV Import/Export**: Data-only import/export with preview
- ✅ **Dark Mode**: Automatic system preference detection
- ✅ **Accessibility**: Screen reader support, keyboard navigation, ARIA labels
- ✅ **Comprehensive Testing**: Over 100 Playwright tests + over 50 Go unit tests

## User Documentation

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for end-user documentation: getting started, formulas, keyboard shortcuts, CSV import/export, and troubleshooting.

## Development Methodology

This project is built using the **BMAD (Breakthrough Method for Agile AI Driven Development)** methodology. See [_bmad/BMAD.md](_bmad/BMAD.md) for details on how BMAD principles are applied.

## Project Structure

```
spreadsheet/
├── .github/              # GitHub Actions workflows
│   └── workflows/
│       └── test.yml
├── api/                  # OpenAPI schema and generated Go types
│   ├── openapi.yaml      # API contract (single source of truth)
│   └── generated/        # Go types from oapi-codegen (make generate)
├── assets/               # App icons and resources
├── controller/           # Application logic
├── docs/                 # User documentation (USER_GUIDE.md)
├── electron/             # Electron main process
├── frontend/             # Web UI (HTML/CSS/JS)
│   └── api-types.d.ts    # TypeScript types from OpenAPI (npm run openapi:generate)
├── model/                # Core data model
├── playwright_tests/     # Playwright Electron UI tests
├── server/               # Go HTTP backend
├── tests/                # Go unit tests
├── _bmad/                # BMAD methodology (_bmad/BMAD.md)
├── _bmad-output/         # BMAD planning and implementation artifacts
├── CONTRIBUTING.md       # Contributor guide
├── Makefile              # Build automation
├── README.md             # Main documentation
├── go.mod, go.sum        # Go dependencies
├── package.json          # Node dependencies
└── playwright.config.js  # Playwright configuration
```

## Quick Start

### Development Mode

```bash
# Install dependencies
make install
# or: npm install

# Build Go server
make build

# Run in development mode (Electron app)
make run-electron
# or: npm start
```

The app launches as a native macOS window. Server runs at `http://localhost:3000`.

For verbose debug logging, run `npm run start:verbose` or see [CONTRIBUTING.md](CONTRIBUTING.md#debug-logging-verbose-output).

### Web Mode (Backend Only)

```bash
# Build and run Go server only (for debugging)
make run
# Opens http://localhost:3000 - use browser to access
```

## Building the Application

### Development Build

```bash
# Build Go server
make build

# Run in development mode
npm start
```

### Production Build

```bash
# Build for macOS (universal: arm64 + x64)
npm run build

# Output: dist/mac-arm64/GoSheet.app, dist/mac/GoSheet.app, .zip and .dmg for each arch
# Verify: file dist/mac-arm64/.../gosheet-server → arm64; dist/mac/.../gosheet-server → x86_64
```

## Testing

### Playwright Tests (Chromium + Electron)

Tests run in two modes per [UI testing research](_bmad-output/planning-artifacts/research/technical-ui-testing-research-2026-02-28.md):

- **Chromium** – Reliable real clicks (single, double, shift+click). Run `test_ui_interactions.spec.js` against web server.
- **Electron** – Menus, IPC, native dialogs. Uses hybrid pattern (API setup, UI assertions).

```bash
# Run all tests (Chromium UI + Electron)
npm test
# or: make test-electron

# Run Chromium UI tests only (single/double/shift-click)
# Requires: npx playwright install (one-time, for Chromium browser)
npm run test:chromium

# Run Electron tests only
npm run test:electron

# Run specific test file
npx playwright test test_spreadsheet.spec.js

# Run only failed tests
npx playwright test --last-failed

# View HTML report
npx playwright show-report
```

1. **Smoke Tests** – App launches, window title
2. **Core Spreadsheet Tests** – Cell selection, editing, formulas, keyboard navigation
3. **Dialog Stubbing Tests** – Open/save dialog stubbing
4. **File Operation Tests** – New, Open, Save, file status tracking
5. **CSV Tests** – Import dialog, round-trip verification
6. **Menu Tests** – File, Edit, Help menus
7. **Keyboard Shortcuts** – Cmd+N, Cmd+O, Cmd+S, etc.
8. **Dark Mode** – System preference detection
9. **Dock Menu** – Recent files
10. **Quit Warning** – Unsaved changes dialog
11. **Window Close** – Graceful shutdown behavior

**Test Features:**
- ✅ Runs headless (no visible windows) with `NODE_ENV=test`
- ✅ Uses `electron-playwright-helpers` for dialog stubbing
- ✅ Tests full stack: UI → IPC → Backend → File system
- ✅ No manual intervention required

### Go Unit Tests

**Over 50 tests** covering:

```bash
# Run all Go tests
go test ./tests/...
# or: make test-unit

# Run with verbose output
go test -v ./tests/...

# Run with coverage
go test -cover ./tests/...
```

- Cell model and coordinate conversion
- Formula parser and evaluator
- Dependency graph and formula updates
- File I/O (gob encoding/decoding)
- Spreadsheet operations
- Formula normalization

### Run All Tests

```bash
# Run both test suites (Go first, then Playwright)
npm run test:all
# or: make test

# Or run separately
make test-unit   # Go tests only
npm test        # Playwright tests only
```

### Test Execution Times

- **Playwright tests**: ~2–3 minutes
- **Go unit tests**: <1 second
- **Total**: ~3 minutes for complete test suite

### CI/CD Integration

Tests run automatically on every push and pull request via GitHub Actions.

**Workflow:** `.github/workflows/test.yml`

**What runs:**
1. Go unit tests
2. Playwright Electron tests
3. Test results uploaded as artifacts

**View results:**
- Check the "Actions" tab in GitHub
- Download test reports and traces from failed runs

**Local CI simulation:**
```bash
npm run test:all
```

## Requirements

### Backend
- Go 1.21+
- No external dependencies (uses standard library)

### Frontend
- Modern web browser (Chrome, Firefox, Safari)
- No build tools required (pure HTML/CSS/JS)

### Native App
- Node.js 18+
- Electron (see [package.json](package.json) for version)
- electron-builder (for packaging)

### Testing
- Playwright (Electron support)
- electron-playwright-helpers (dialog stubbing)

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

✅ **Native App Complete** – Electron-based spreadsheet with file operations, CSV import/export, macOS integration, and comprehensive automated testing.

See [_bmad/BMAD.md](_bmad/BMAD.md) for detailed development history and decisions.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, code quality standards, and pull request guidelines.
