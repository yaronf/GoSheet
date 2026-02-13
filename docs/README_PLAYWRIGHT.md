# Playwright UI Testing for GoSheet

This directory contains automated UI tests for the GoSheet web interface using Microsoft Playwright.

## Setup

### Prerequisites

- Python 3.7 or higher
- Go 1.21 or higher
- The GoSheet web demo server running

### Installation

1. Install Python dependencies:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. Install Playwright browsers:

```bash
playwright install chromium
```

## Running Tests

### Quick Start

Use the provided script to run all tests:

```bash
./run_playwright_tests.sh
```

This script will:
1. Check if the web server is running
2. Set up the Python virtual environment
3. Install dependencies
4. Run all Playwright tests with visible browser

### Manual Test Execution

1. Start the web server in one terminal:

```bash
go run cmd/webdemo/main.go
```

2. In another terminal, activate the virtual environment and run tests:

```bash
source venv/bin/activate
pytest playwright_tests/ -v
```

### Test Options

Run tests with different options:

```bash
# Run with visible browser (headed mode)
pytest playwright_tests/ --headed

# Run with slow motion for debugging
pytest playwright_tests/ --headed --slowmo=1000

# Run specific test
pytest playwright_tests/test_spreadsheet.py::test_edit_cell_simple_value -v

# Run with more verbose output
pytest playwright_tests/ -vv -s

# Generate HTML report
pytest playwright_tests/ --html=report.html --self-contained-html
```

## Test Coverage

The test suite covers:

1. **Basic Functionality**
   - Page loading
   - Initial data display
   - Cell editing with simple values
   - Dialog open/close

2. **Formula Testing**
   - Simple arithmetic formulas (=A1+A2)
   - SUM function
   - AVG function
   - MIN/MAX functions
   - COUNT function
   - Complex expressions (=A1*2+A2-5)

3. **User Interactions**
   - Click to edit cells
   - Enter key to submit
   - Cancel button
   - Escape key to close dialog
   - Formula cell styling

4. **Data Validation**
   - Computed values are correct
   - Cell updates are reflected in UI
   - Formula results update properly

## Test Structure

```
playwright_tests/
├── conftest.py           # Pytest configuration and fixtures
├── test_spreadsheet.py   # Main test suite
└── __pycache__/         # Python cache (auto-generated)
```

## Writing New Tests

To add new tests, create test functions in `test_spreadsheet.py`:

```python
def test_my_feature(page: Page):
    """Test description"""
    page.goto("http://localhost:8080")
    
    # Your test code here
    cell = page.locator("#cell-0-0")
    expect(cell).to_have_text("expected value")
```

## Debugging Tests

### Visual Debugging

Run tests in headed mode with slow motion:

```bash
pytest playwright_tests/ --headed --slowmo=1000
```

### Screenshot on Failure

Playwright automatically captures screenshots on test failures. Check the `test-results/` directory.

### Trace Viewer

Enable trace recording for detailed debugging:

```bash
pytest playwright_tests/ --tracing=on
```

Then view traces:

```bash
playwright show-trace trace.zip
```

## CI/CD Integration

For continuous integration, run tests in headless mode:

```bash
pytest playwright_tests/ --browser chromium --headed=false
```

## Troubleshooting

### Web Server Not Running

If tests fail with connection errors:

```bash
# Start the web server
go run cmd/webdemo/main.go
```

### Browser Not Installed

If Playwright can't find browsers:

```bash
playwright install chromium
```

### Port Already in Use

If port 8080 is busy, modify `BASE_URL` in `test_spreadsheet.py` and start the server on a different port.

## Resources

- [Playwright Python Documentation](https://playwright.dev/python/)
- [Pytest Documentation](https://docs.pytest.org/)
- [GoSheet Project Documentation](./README.md)
