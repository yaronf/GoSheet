#!/bin/bash
# Run Playwright UI tests for GoSheet Wails frontend

set -e

echo "=== GoSheet Wails UI Tests ==="
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
pip install -q --upgrade pip
pip install -q playwright>=1.40.0 pytest>=7.4.0 pytest-playwright>=0.4.0

# Install Playwright browsers if needed
if [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo "Installing Playwright browsers..."
    playwright install chromium
fi

echo
echo "Starting frontend dev server..."
# Start frontend dev server in background
cd frontend
npm run dev > /dev/null 2>&1 &
VITE_PID=$!
cd ..

# Wait for server to be ready
echo "Waiting for dev server to start..."
sleep 3

# Check if server is running
if ! curl -s http://localhost:5174 > /dev/null; then
    echo "ERROR: Dev server failed to start"
    kill $VITE_PID 2>/dev/null || true
    exit 1
fi

echo
echo "Running Playwright tests..."
echo

# Run tests
pytest playwright_tests/test_wails_ui.py -v --tb=short

TEST_EXIT=$?

# Cleanup
echo
echo "Cleaning up..."
kill $VITE_PID 2>/dev/null || true

if [ $TEST_EXIT -eq 0 ]; then
    echo
    echo "✅ All tests passed!"
else
    echo
    echo "❌ Some tests failed"
fi

exit $TEST_EXIT
