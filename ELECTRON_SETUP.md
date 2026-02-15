# GoSheet Electron Setup Guide

## Epic 3: Electron Desktop App - Implementation Complete ✅

This document describes the Electron implementation for GoSheet, replacing the previous Wails v3 architecture.

## Architecture Overview

**Electron + Embedded Go HTTP Server**

- **Electron Main Process** (`electron/main.js`): Manages app lifecycle, spawns Go server, creates windows
- **Electron Preload Script** (`electron/preload.js`): Secure IPC bridge for file dialogs
- **Go HTTP Server** (`server/gosheet-server`): Existing backend (100% reused, no changes)
- **Frontend** (`frontend/`): Existing UI (95% reused, minor IPC updates)

### Communication Flow

```
┌─────────────────────────────────────────────────────────┐
│ Electron App                                            │
│                                                         │
│  ┌──────────────┐         ┌─────────────────┐         │
│  │   Renderer   │  HTTP   │   Go Server     │         │
│  │  (Frontend)  │────────▶│  (localhost:    │         │
│  │              │◀────────│   3000)         │         │
│  └──────────────┘         └─────────────────┘         │
│         │                                               │
│         │ IPC (file dialogs only)                      │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │ Main Process │                                      │
│  │ (Electron)   │                                      │
│  └──────────────┘                                      │
└─────────────────────────────────────────────────────────┘
```

- **Spreadsheet operations**: HTTP API (fetch to localhost:3000)
- **File dialogs**: Electron IPC (window.electronAPI)

## Prerequisites

- **Node.js** 18+ (for Electron)
- **Go** 1.21+ (for backend)
- **macOS** 11+ (Big Sur or later)

## Installation

### 1. Install Dependencies

```bash
# Install Node.js dependencies (Electron, Playwright, electron-builder)
make install
# or
npm install

# Go dependencies should already be installed
go mod download
```

### 2. Build Go Server

```bash
make build
# or
go build -o server/gosheet-server ./server
```

## Running the App

### Development Mode

```bash
make run-electron
# or
npm start
```

This will:
1. Start the Go HTTP server on port 3000
2. Launch Electron app
3. Load frontend from http://localhost:3000
4. Open DevTools (in dev mode)

### Production Build

```bash
make build-electron
# or
npm run build
```

This creates a `.app` bundle in `dist/mac/GoSheet.app` with:
- Universal binary (Intel + Apple Silicon)
- Embedded Go server
- Code-signed (if configured)

## Testing

### Run All Tests

```bash
make test
# Runs: Go unit tests + Playwright Electron tests
```

### Go Unit Tests Only

```bash
make test-unit
# or
go test ./tests/... -v
```

### Playwright Electron Tests

```bash
make test-electron
# or
npm test
```

## Project Structure

```
gosheet/
├── electron/
│   ├── main.js          # Electron main process (Story 3.1)
│   └── preload.js       # Secure IPC bridge (Story 3.2)
├── server/
│   ├── main.go          # Go HTTP server (Story 3.3)
│   └── gosheet-server   # Built binary
├── frontend/
│   ├── index.html       # Frontend HTML
│   ├── app.js           # Main app logic
│   ├── api-client.js    # API client (Story 3.5 - updated for Electron)
│   └── styles.css       # Styles
├── playwright_tests/    # Playwright Electron tests (Epic 5)
├── tests/               # Go unit tests
├── package.json         # Node.js config (Story 3.6)
├── Makefile             # Build automation
└── README.md            # Main documentation
```

## Implementation Details

### Story 3.1: Electron Main Process ✅

**File:** `electron/main.js`

- App lifecycle management
- Window creation (1200x800, resizable)
- Go server spawning as child process
- Cleanup on quit (kills Go server)

**Key Features:**
- Waits for Go server startup before creating window
- Logs server output to console
- Handles graceful shutdown

### Story 3.2: Electron Preload Script ✅

**File:** `electron/preload.js`

- Secure IPC bridge using `contextBridge`
- Exposes `window.electronAPI` to renderer
- Context isolation maintained (no Node.js leaks)

**Exposed APIs:**
- `window.electronAPI.openFileDialog()` → Returns file path or null
- `window.electronAPI.saveFileDialog(defaultName)` → Returns file path or null

### Story 3.3: Go HTTP Server Integration ✅

**Implementation:** Embedded in `electron/main.js`

- Spawns `server/gosheet-server` as child process
- Runs on port 3000
- Logs stdout/stderr to console
- Terminated when Electron quits

**Server Path Resolution:**
- Dev mode: `../server/gosheet-server`
- Production: `process.resourcesPath/server/gosheet-server`

### Story 3.4: Electron File Dialogs ✅

**Implementation:** IPC handlers in `electron/main.js`

**Open File Dialog:**
```javascript
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Spreadsheet Files', extensions: ['sheet'] }],
    properties: ['openFile']
  });
  return result.canceled ? null : result.filePaths[0];
});
```

**Save File Dialog:**
```javascript
ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'Spreadsheet Files', extensions: ['sheet'] }]
  });
  return result.canceled ? null : result.filePath;
});
```

### Story 3.5: Frontend Electron IPC Integration ✅

**File:** `frontend/api-client.js`

**Changes Made:**
1. Removed Wails binding detection
2. Added Electron mode detection: `window.electronAPI !== undefined`
3. Updated file operations to use Electron IPC:

```javascript
const SaveFile = async (path) => {
  if (isElectronMode && !path) {
    path = await window.electronAPI.saveFileDialog(defaultName);
    if (!path) return; // User cancelled
  }
  await fetchUnified('POST', '/api/save', { path });
};

const LoadFile = async (path) => {
  if (isElectronMode && !path) {
    path = await window.electronAPI.openFileDialog();
    if (!path) return; // User cancelled
  }
  await fetchUnified('POST', '/api/load', { path });
};
```

4. All spreadsheet operations still use HTTP API (unchanged)

### Story 3.6: electron-builder Configuration ✅

**File:** `package.json`

**Build Configuration:**
- App ID: `com.gosheet.app`
- Product Name: `GoSheet`
- Category: `productivity`
- Universal binary (Intel + Apple Silicon)
- Includes Go server binary in resources
- Output: `dist/mac/GoSheet.app`

**Scripts:**
- `npm start` → Development mode
- `npm run build` → Production build
- `npm test` → Playwright tests

### Story 3.7: Verification ✅

**Launch Test:**
```bash
make run-electron
```

**Expected Behavior:**
- ✅ App launches in <1 second
- ✅ Go server starts (check console logs)
- ✅ Window displays with spreadsheet grid
- ✅ File dialogs work (Save, Open)
- ✅ Can enter data and formulas
- ✅ Can save and load files
- ✅ App quits cleanly (Go server terminated)

## Troubleshooting

### "Go server failed to start"

**Solution:** Build the Go server first:
```bash
make build
```

### "Cannot find module 'electron'"

**Solution:** Install dependencies:
```bash
npm install
```

### "Port 3000 already in use"

**Solution:** Kill existing process:
```bash
lsof -ti:3000 | xargs kill
```

### File dialogs don't appear

**Check:** Ensure `window.electronAPI` is available in renderer:
```javascript
console.log(window.electronAPI); // Should not be undefined
```

## Next Steps

### Epic 5: Playwright Electron Testing

Now that Electron is working, implement automated testing:

1. Set up Playwright Electron environment
2. Port existing 32 Playwright tests to Electron API
3. Implement dialog stubbing tests
4. Create file operation tests
5. Verify all tests pass
6. Update CI/CD

### Epic 6: CSV Import/Export

Implement CSV functionality (unchanged from original plan).

### Epic 7: macOS Integration

Implement native macOS features:
- Menu bar (File, Edit, Help)
- Keyboard shortcuts
- Dock integration
- File associations

## Benefits of Electron Migration

✅ **Full Testability:** Playwright native Electron support (no pyax hacks)  
✅ **Simpler Codebase:** -700 lines vs dual-mode Wails architecture  
✅ **Cross-Platform Ready:** Windows, Linux, macOS support  
✅ **100% Go Backend Preserved:** No changes to model, controller, or HTTP server  
✅ **Dialog Stubbing:** Can test file operations in CI/CD  

⚠️ **Trade-off Accepted:** Non-native Electron dialogs (vs NSOpenPanel) - user explicitly approved for better testability

## References

- **Sprint Change Proposal:** `sprint-change-proposal-2026-02-15.md`
- **Architecture Document:** `architecture.md`
- **Epics Document:** `epics.md`
- **Technical Analysis:** `electron-migration-analysis.md`

---

**Epic 3 Status:** ✅ COMPLETE  
**Total Effort:** ~18 hours (2-3 days)  
**Stories Completed:** 7/7  
**Ready for:** Epic 5 (Playwright Electron Testing)
