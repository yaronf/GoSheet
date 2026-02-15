#!/bin/bash
# Quick test script for Electron app launch

echo "🧪 Testing Electron App Launch"
echo "================================"
echo ""

# Check prerequisites
echo "1. Checking prerequisites..."

if [ ! -f "server/gosheet-server" ]; then
    echo "❌ Go server binary not found"
    echo "   Run: make build"
    exit 1
fi
echo "✅ Go server binary exists"

if [ ! -d "node_modules" ]; then
    echo "❌ Node modules not installed"
    echo "   Run: npm install"
    exit 1
fi
echo "✅ Node modules installed"

if [ ! -f "electron/main.js" ]; then
    echo "❌ Electron main.js not found"
    exit 1
fi
echo "✅ Electron main.js exists"

if [ ! -f "electron/preload.js" ]; then
    echo "❌ Electron preload.js not found"
    exit 1
fi
echo "✅ Electron preload.js exists"

echo ""
echo "2. All prerequisites met!"
echo ""
echo "3. Launching Electron app..."
echo "   (Press Cmd+Q to quit)"
echo ""

# Launch Electron
npm start
