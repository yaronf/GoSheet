#!/bin/bash
# Isolated Native Test Runner for GoSheet
# This script runs native tests in a Python virtual environment
# Grant accessibility permissions to Terminal.app (not Cursor) to run this script

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$PROJECT_ROOT/venv-native-tests"
BUILD_DIR="$PROJECT_ROOT/build"
APP_BINARY="$BUILD_DIR/GoSheet"

echo "=================================================="
echo "GoSheet Native Test Runner (Isolated)"
echo "=================================================="
echo ""

# Step 1: Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
    echo "✓ Virtual environment created: $VENV_DIR"
else
    echo "✓ Virtual environment exists: $VENV_DIR"
fi

# Step 2: Activate virtual environment
echo ""
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"
echo "✓ Virtual environment activated"

# Step 3: Install dependencies
echo ""
echo "Installing test dependencies..."
pip install --quiet --upgrade pip
pip install 'pyax[highlight]' pytest pytest-xdist
echo "✓ Dependencies installed (pyax, pytest, pytest-xdist)"

# Step 4: Build GoSheet app if needed
echo ""
if [ ! -f "$APP_BINARY" ]; then
    echo "Building GoSheet app..."
    go build -o "$APP_BINARY" .
    echo "✓ GoSheet built: $APP_BINARY"
else
    echo "✓ GoSheet app exists: $APP_BINARY"
fi

# Step 5: Check accessibility permissions
echo ""
echo "Checking accessibility permissions..."
if ! python3 -c "import pyax; pyax.get_application_by_name('Finder')" 2>/dev/null; then
    echo ""
    echo "⚠️  ACCESSIBILITY NOT ENABLED"
    echo ""
    echo "To run native tests, enable accessibility for Terminal.app:"
    echo "1. Open System Preferences → Security & Privacy → Privacy → Accessibility"
    echo "2. Click the lock to make changes"
    echo "3. Add Terminal.app (or iTerm.app) to the list"
    echo "4. Check the box next to Terminal.app"
    echo "5. Run this script again"
    echo ""
    echo "NOTE: Grant permissions to Terminal.app, NOT Cursor.app"
    echo "      This keeps your IDE secure while allowing isolated test execution."
    echo ""
    exit 1
fi
echo "✓ Accessibility enabled"

# Step 6: Run native tests
echo ""
echo "=================================================="
echo "Running Native Tests"
echo "=================================================="
echo ""

pytest tests/native/ -v --tb=short

TEST_EXIT_CODE=$?

# Step 7: Report results
echo ""
echo "=================================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ ALL NATIVE TESTS PASSED"
else
    echo "❌ SOME TESTS FAILED (exit code: $TEST_EXIT_CODE)"
fi
echo "=================================================="
echo ""

# Deactivate venv
deactivate

exit $TEST_EXIT_CODE
