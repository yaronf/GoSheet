#!/bin/bash
# Quick test runner for development
# Usage: ./test.sh [pytest args]
# Example: ./test.sh -v
# Example: ./test.sh -v -k test_formula

export GOSHEET_PORT=8080
source venv/bin/activate

# Ensure playwright browsers are installed (skips if already present)
playwright install chromium --quiet 2>/dev/null || playwright install chromium

# Kill any existing server on port 8080
echo "Stopping existing server..."
lsof -ti:$GOSHEET_PORT | xargs kill -9 2>/dev/null
pkill -9 -f "go run main.go" 2>/dev/null
sleep 1

# Start fresh server in background
echo "Starting server on port $GOSHEET_PORT..."
(cd server && go run main.go -port $GOSHEET_PORT > /tmp/gosheet.log 2>&1) &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
for i in {1..10}; do
    if curl -s http://localhost:$GOSHEET_PORT/ > /dev/null 2>&1; then
        echo "Server ready!"
        break
    fi
    sleep 1
done

# Run tests
pytest playwright_tests/test_spreadsheet.py "$@" 2>&1 | tail -40
TEST_EXIT=$?

# Cleanup: kill server
kill $SERVER_PID 2>/dev/null

exit $TEST_EXIT
