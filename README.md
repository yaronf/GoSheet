# GoSheet - Lightweight Spreadsheet for macOS

A simple, native macOS spreadsheet application built in Go with Fyne.

## Features

- **Basic Grid**: Unlimited rows and columns with sparse storage
- **Formula Engine**: Support for SUM, AVG, MIN, MAX, COUNT and arithmetic operations
- **File Operations**: Save and load spreadsheets in efficient binary format
- **Native UI**: Built with Fyne for a modern, responsive interface

## Development Methodology

This project is built using the **BMAD (Breakthrough Method for Agile AI Driven Development)** methodology. See [BMAD.md](BMAD.md) for details on how BMAD principles are applied.

## Project Structure

```
spreadsheet/
├── BMAD.md                 # BMAD methodology documentation
├── README.md               # This file
├── go.mod                  # Go module definition
├── main.go                 # Application entry point
├── specs/                  # Design specifications
│   ├── PRODUCT_BRIEF.md
│   ├── TECH_SPEC.md
│   └── FORMULA_GRAMMAR.md
├── model/                  # Core data model
│   ├── spreadsheet.go
│   ├── formula.go
│   ├── formula_ast.go
│   ├── formula_eval.go
│   ├── vector.go
│   ├── cell.go
│   └── coords.go
├── io/                     # File I/O
│   └── serializer.go
├── ui/                     # User interface
│   ├── window.go
│   ├── grid.go
│   └── styles.go
├── controller/             # Application logic
│   └── app.go
└── tests/                  # Test suite
    ├── model_test.go
    ├── formula_test.go
    └── ...
```

## Building

```bash
go build -o gosheet
```

## Running

```bash
./gosheet
```

## Testing

### Go Unit Tests

Run the Go test suite:

```bash
# Run all tests
go test ./tests/...

# Run specific test file
go test ./tests/coords_test.go
go test ./tests/model_test.go
go test ./tests/formula_test.go

# Run with verbose output
go test -v ./tests/...
```

### Playwright UI Tests

The project includes comprehensive automated UI tests using Microsoft Playwright.

**Quick Start:**

```bash
# Run all UI tests (requires web server to be running)
./run_playwright_tests.sh
```

**Manual Setup:**

1. Start the web demo server:
```bash
go run cmd/webdemo/main.go
```

2. In another terminal, run Playwright tests:
```bash
source venv/bin/activate
pytest playwright_tests/ -v
```

**Test Coverage:**
- Page loading and initial data display
- Cell editing with simple values
- Formula evaluation (SUM, AVG, MIN, MAX, COUNT)
- Complex arithmetic expressions
- Dialog interactions (OK, Cancel, Escape)
- Formula cell styling

See [README_PLAYWRIGHT.md](README_PLAYWRIGHT.md) and [TEST_RESULTS.md](TEST_RESULTS.md) for detailed documentation.

## Requirements

- Go 1.21+
- macOS (primary target, cross-platform compatible)

## Dependencies

- [Fyne v2](https://fyne.io/) - UI framework
- [Participle v2](https://github.com/alecthomas/participle) - Formula parser
- [Testify](https://github.com/stretchr/testify) - Testing framework

## Status

🔄 **In Development** - Following BMAD methodology

- ✅ Planning phase complete (specs approved)
- 🔄 Implementation phase in progress
- ⏳ Testing phase pending
- ⏳ Deployment phase pending

See [BMAD.md](BMAD.md) for detailed status tracking.

## License

MIT License (to be added)

## Contributing

This is a personal project following BMAD methodology. Contributions welcome after initial release.
