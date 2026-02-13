# GoSheet - Lightweight Spreadsheet for macOS

A modern spreadsheet application with a Go backend and web frontend, designed for packaging as a native macOS app. Features true in-cell editing and comprehensive automated testing.

## Architecture

**Current Development Setup**:
- **Backend**: Go HTTP server with REST API  
- **Frontend**: Pure HTML/CSS/JavaScript (no build system required)  
- **Testing**: Playwright for automated UI testing

**Target Deployment**: Native macOS application (.app bundle)
- Packaging options: Electron, Tauri, or Wails
- Current web architecture enables easy testing and rapid development
- Will be wrapped for native macOS distribution

## Features

- ✅ **In-Cell Editing**: True spreadsheet-style editing with keyboard navigation
- ✅ **Formula Engine**: Support for SUM, AVG, MIN, MAX, COUNT and arithmetic operations
- ✅ **Cell References**: Formulas can reference other cells (e.g., =A1+B2)
- ✅ **Keyboard Navigation**: Arrow keys, Enter, Tab, Escape
- ✅ **Grid Display**: Row/column headers with unlimited dimensions
- ✅ **Comprehensive Testing**: 13 Playwright tests covering all UI interactions
- ⏳ **File Operations**: Save/load (planned)

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

### Automated UI Tests (Playwright)

**All 13 tests passing!** ✅

```bash
# Run all UI tests (auto-starts server if needed)
./run_tests.sh
```

**Test Coverage:**
- ✅ Page loading and grid structure
- ✅ Sample data loading
- ✅ Cell selection and navigation (arrow keys)
- ✅ Single and multi-digit number entry
- ✅ Multiple value entry across cells
- ✅ Cell editing and cancellation (ESC key)
- ✅ Simple formulas (=5+3)
- ✅ Cell reference formulas (=A1+A2)
- ✅ Formula persistence and display
- ✅ Tab key navigation between cells

### Go Unit Tests

Run the Go test suite:

```bash
# Run all tests
go test ./tests/...

# Run with verbose output
go test -v ./tests/...

# Run specific test
go test ./tests/formula_test.go -v
```

## Requirements

### Backend
- Go 1.21+
- No external dependencies (uses standard library)

### Frontend
- Modern web browser (Chrome, Firefox, Safari)
- No build tools required (pure HTML/CSS/JS)

### Testing
- Python 3.8+
- Playwright (auto-installed by `run_tests.sh`)

## Dependencies

**Go Backend:**
- [Participle v2](https://github.com/alecthomas/participle) - Formula parser
- [Testify](https://github.com/stretchr/testify) - Testing framework

**Frontend:**
- None! Pure vanilla JavaScript

**Testing:**
- [Playwright](https://playwright.dev/) - Browser automation
- [pytest](https://pytest.org/) - Test framework

## Status

✅ **MVP Complete** - Following BMAD methodology

- ✅ Planning phase complete (specs approved)
- ✅ Implementation phase complete
- ✅ Testing phase complete (13/13 tests passing)
- ✅ Architecture simplified for testability
- ⏳ File operations (save/load) - next milestone
- ⏳ macOS app packaging (Electron/Tauri/Wails) - future milestone

**Note**: The current web-based architecture is a development setup optimized for testing and rapid iteration. The final product will be a native macOS application, not a web app.

See [BMAD.md](BMAD.md) for detailed development history and decisions.

## License

MIT License (to be added)

## Contributing

This is a personal project following BMAD methodology. Contributions welcome after initial release.
