#!/bin/bash
# Quick test runner for development
# Usage: ./test.sh [pytest args]
# Example: ./test.sh -v
# Example: ./test.sh -v -k test_formula

export GOSHEET_PORT=8080
source venv/bin/activate

# Install playwright browsers if needed
if [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo "Installing Playwright browsers..."
    playwright install chromium
fi

pytest playwright_tests/test_spreadsheet.py "$@" 2>&1 | tail -40
