#!/bin/bash
# Run Playwright UI tests for GoSheet

set -e

# Default port
PORT=${GOSHEET_PORT:-8080}

echo "=== GoSheet Playwright UI Tests ==="
echo

# Check if server is running
if ! curl -s http://localhost:$PORT > /dev/null 2>&1; then
    echo "❌ ERROR: Server is not running on port $PORT"
    echo "Please start the server first with: go run server/main.go -port $PORT"
    echo "Or set GOSHEET_PORT environment variable to use a different port"
    exit 1
fi

echo "✅ Server is running on port $PORT"
echo

# Check if venv exists, create if not
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install/upgrade dependencies
echo "Installing dependencies..."
pip install -q --upgrade pip 2>/dev/null || true
pip install -q 'playwright>=1.40.0' 'pytest>=7.4.0' 'pytest-playwright>=0.4.0' 2>/dev/null || true

# Install Playwright browsers if needed
if [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo "Installing Playwright browsers..."
    playwright install chromium
fi

echo
echo "Running Playwright tests..."
echo

# Run tests
pytest playwright_tests/test_spreadsheet.py -v --tb=short

TEST_EXIT=$?

if [ $TEST_EXIT -eq 0 ]; then
    echo
    echo "✅ All tests passed!"
else
    echo
    echo "❌ Some tests failed"
fi

exit $TEST_EXIT
