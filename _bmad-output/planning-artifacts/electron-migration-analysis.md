# Electron Migration Analysis: Testability & Architecture

**Date:** 2026-02-15  
**Purpose:** Deep dive into Electron migration for improved testability  
**Context:** Epic 5 revealed pyax cannot test Wails WebView content

## Executive Summary

**Recommendation: ✅ MIGRATE TO ELECTRON**

**Key Findings:**
1. **Testability**: Electron + Playwright = native integration (no hacks needed)
2. **Architecture**: Can drop web mode entirely (simplify codebase)
3. **Effort**: Medium (2-5 days, ~400 lines of code)
4. **Trade-offs**: Non-native dialogs acceptable for testability gains

---

## 1. Testability Deep Dive

### Current State (Wails + pyax)

**What Works:**
- ✅ Playwright tests (30 tests) - Test WebView UI via browser mode
- ✅ Go unit tests (42 tests) - Test backend logic
- ❌ pyax tests - **Cannot see WebView content at all**

**Why pyax Fails:**
```
Wails Architecture:
┌─────────────────────────────────┐
│ Native macOS Window             │ ← pyax sees this
│  ┌───────────────────────────┐  │
│  │ WebKit WebView (black box)│  │ ← pyax CANNOT see this
│  │  - HTML buttons           │  │
│  │  - JavaScript events      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Electron State

**Playwright Native Integration:**
```javascript
// Playwright has FIRST-CLASS Electron support
const { _electron } = require('playwright');
const electronApp = await _electron.launch({ args: ['main.js'] });
const window = await electronApp.firstWindow();

// Full access to Electron APIs
await window.getByRole('button', { name: 'Load' }).click();
```

**Key Advantages:**
1. **Native Electron API**: Playwright can access Electron's main process
2. **Dialog Stubbing**: Built-in dialog mocking (no real dialogs needed for tests)
3. **IPC Access**: Can send/receive Electron IPC messages
4. **Multi-window**: Test multiple windows easily
5. **Screenshots**: Built-in screenshot capabilities

**From Research:**
- ✅ Playwright supports Electron v12.2.0+, v13.4.0+, v14+ (official docs)
- ✅ `electron-playwright-helpers` npm package for dialog stubbing
- ✅ Can stub `dialog.showOpenDialog()` and `dialog.showSaveDialog()`
- ✅ Full control over main process and renderer process

### pyax with Electron

**Accessibility API Exposure:**
- Electron apps expose accessibility when `app.setAccessibilitySupportEnabled()` is called
- Chromium (Electron's engine) exposes more to accessibility API than WebKit
- **However**: Still limited for WebView content

**Reality Check:**
- pyax might still not see HTML buttons in Electron
- BUT: We don't need pyax if Playwright works natively!
- Playwright + Electron = complete testing solution

---

## 2. Architecture Analysis

### Current Dual-Mode Architecture

**We maintain TWO separate modes:**

1. **Web Mode** (`server/main.go`):
   - Go HTTP server on port 3000
   - Serves static files from `frontend/`
   - REST API for all operations
   - Browser-based (Chrome, Firefox, Safari)
   - File operations via upload/download

2. **Native Mode** (`main.go`):
   - Wails v3 application
   - Embeds frontend assets
   - Native file dialogs (NSOpenPanel/NSSavePanel)
   - IPC via Wails bindings
   - macOS-only

**Code Duplication:**
- `api_wails.go` (307 lines) - Wails IPC layer
- `fileservice_wails.go` (75 lines) - Wails file service
- `server/main.go` (304 lines) - HTTP server
- `frontend/api-client.js` - Mode detection logic

**Total dual-mode overhead: ~700 lines**

### Proposed Electron-Only Architecture

**Single Mode:**
```
┌─────────────────────────────────────┐
│ Electron Main Process (Node.js)    │
│  - Launch Go HTTP server (child)   │
│  - Create BrowserWindow             │
│  - Handle native dialogs via IPC   │
│  - Package as .app bundle           │
└─────────────────────────────────────┘
         ↓ IPC (file dialogs)
         ↓ HTTP (spreadsheet API)
┌─────────────────────────────────────┐
│ Electron Renderer (Chromium)        │
│  - Load frontend/index.html         │
│  - Fetch to localhost:PORT          │
│  - Send IPC for file dialogs        │
└─────────────────────────────────────┘
         ↓ HTTP
┌─────────────────────────────────────┐
│ Go HTTP Server (embedded)           │
│  - controller.AppController         │
│  - All backend logic (unchanged)    │
│  - REST API (unchanged)             │
└─────────────────────────────────────┘
```

**Benefits:**
1. **Reuse existing HTTP server** - No Wails IPC layer needed
2. **Single codebase** - No mode detection
3. **Simpler deployment** - One build target
4. **Better testing** - Playwright native support
5. **Cross-platform ready** - Electron works on Windows/Linux too

**Can We Drop Web Mode?**

**✅ YES - Here's why:**

**What Web Mode Provides:**
- Browser-based access (no install needed)
- Cross-platform (any OS with browser)
- Easy development (just refresh browser)
- File upload/download (no native dialogs)

**What Electron Provides:**
- Desktop app (install required, but better UX)
- Cross-platform (Windows, macOS, Linux)
- Easy development (hot reload via electron-reload)
- Native-like dialogs (Electron's dialogs)
- **Better testing** (Playwright integration)

**Migration Path:**
1. Build Electron app with embedded Go server
2. Remove web mode (`server/main.go`)
3. Remove Wails code (`main.go`, `api_wails.go`, `fileservice_wails.go`)
4. Simplify `frontend/api-client.js` (always use HTTP)
5. Update tests to use Playwright Electron API

**Net Result:**
- ❌ Remove ~700 lines (dual-mode code)
- ❌ Remove ~400 lines (Wails-specific)
- ✅ Add ~300 lines (Electron main process)
- ✅ Add ~100 lines (Electron IPC for dialogs)
- **Net: -700 lines of code**

---

## 3. Implementation Plan

### Phase 1: Electron Main Process (~200 lines)

**File: `electron/main.js`**

```javascript
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let goServer;

// Launch Go HTTP server as child process
function startGoServer() {
  const serverPath = path.join(__dirname, '../server/gosheet-server');
  goServer = spawn(serverPath, ['--port', '3000']);
  
  goServer.stdout.on('data', (data) => {
    console.log(`[Go Server] ${data}`);
  });
  
  goServer.stderr.on('data', (data) => {
    console.error(`[Go Server Error] ${data}`);
  });
}

// Create Electron window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  // Load app from Go server
  mainWindow.loadURL('http://localhost:3000');
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for native dialogs
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'GoSheet Files', extensions: ['sheet'] }
    ]
  });
  
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'Untitled.sheet',
    filters: [
      { name: 'GoSheet Files', extensions: ['sheet'] }
    ]
  });
  
  if (result.canceled) {
    return null;
  }
  return result.filePath;
});

// App lifecycle
app.whenReady().then(() => {
  startGoServer();
  
  // Wait for Go server to start
  setTimeout(createWindow, 1000);
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (goServer) {
    goServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

### Phase 2: Preload Script (~50 lines)

**File: `electron/preload.js`**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName)
});
```

### Phase 3: Frontend Updates (~50 lines)

**File: `frontend/api-client.js`** - Simplify to always use HTTP + add dialog helpers

```javascript
// Remove Wails detection - always use HTTP
const API_BASE = 'http://localhost:3000';

// Add Electron dialog helpers
async function openFileDialog() {
  if (window.electronAPI) {
    return await window.electronAPI.openFileDialog();
  }
  // Fallback for development in browser
  return prompt('Enter file path:');
}

async function saveFileDialog(defaultName) {
  if (window.electronAPI) {
    return await window.electronAPI.saveFileDialog(defaultName);
  }
  // Fallback for development in browser
  return prompt('Enter save path:', defaultName);
}

// Update file operations to use dialogs
async function openFile() {
  const path = await openFileDialog();
  if (!path) return; // User cancelled
  
  const response = await fetch(`${API_BASE}/api/file/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  
  return await response.json();
}
```

### Phase 4: Playwright Tests (~100 lines)

**File: `tests/electron/test_app.spec.js`**

```javascript
const { _electron: electron } = require('playwright');
const { test, expect } = require('@playwright/test');
const eph = require('electron-playwright-helpers');

test.describe('GoSheet Electron App', () => {
  let electronApp;
  let window;
  
  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['electron/main.js'] });
    window = await electronApp.firstWindow();
  });
  
  test.afterAll(async () => {
    await electronApp.close();
  });
  
  test('app launches and loads UI', async () => {
    const title = await window.title();
    expect(title).toContain('GoSheet');
    
    // Verify spreadsheet grid is visible
    await expect(window.locator('#spreadsheet')).toBeVisible();
  });
  
  test('can open file dialog', async () => {
    // Stub the dialog to return a test file path
    await eph.stubDialog(electronApp, 'showOpenDialog', {
      filePaths: ['/tmp/test.sheet']
    });
    
    // Click Load button
    await window.getByRole('button', { name: 'Load' }).click();
    
    // Verify dialog was called
    // (actual file loading would happen via HTTP to Go server)
  });
  
  test('can enter formula and see result', async () => {
    // Click cell A1
    await window.locator('[data-row="0"][data-col="0"]').click();
    
    // Type formula
    await window.keyboard.type('=2+2');
    await window.keyboard.press('Enter');
    
    // Verify computed value
    const cellValue = await window.locator('[data-row="0"][data-col="0"]').textContent();
    expect(cellValue).toBe('4');
  });
});
```

### Phase 5: Build Configuration (~50 lines)

**File: `package.json`**

```json
{
  "name": "gosheet",
  "version": "1.0.0",
  "main": "electron/main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "test": "playwright test tests/electron/"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0",
    "@playwright/test": "^1.40.0",
    "electron-playwright-helpers": "^2.1.0"
  },
  "build": {
    "appId": "com.gosheet.app",
    "productName": "GoSheet",
    "mac": {
      "category": "public.app-category.productivity",
      "target": ["dmg", "zip"]
    },
    "files": [
      "electron/**/*",
      "frontend/**/*",
      "server/gosheet-server"
    ],
    "extraResources": [
      {
        "from": "server/gosheet-server",
        "to": "server/gosheet-server"
      }
    ]
  }
}
```

---

## 4. Migration Checklist

### Code Changes
- [ ] Create `electron/main.js` (Electron main process)
- [ ] Create `electron/preload.js` (IPC bridge)
- [ ] Update `frontend/api-client.js` (remove Wails detection, add Electron dialogs)
- [ ] Remove `main.go` (Wails entry point)
- [ ] Remove `api_wails.go` (Wails IPC layer)
- [ ] Remove `fileservice_wails.go` (Wails file service)
- [ ] Remove `server/main.go` OR keep for development mode
- [ ] Update `frontend/app.js` (remove Wails-specific code)

### Testing
- [ ] Create `tests/electron/` directory
- [ ] Port existing Playwright tests to Electron API
- [ ] Add dialog stubbing tests
- [ ] Add IPC communication tests
- [ ] Verify all 30+ tests pass in Electron mode

### Build & Deployment
- [ ] Create `package.json` with Electron dependencies
- [ ] Configure `electron-builder` for macOS .app bundle
- [ ] Update `Makefile` with Electron build targets
- [ ] Test packaging and distribution
- [ ] Update README with Electron instructions

### Documentation
- [ ] Update README with Electron setup
- [ ] Remove Wails documentation
- [ ] Document Electron development workflow
- [ ] Update testing documentation
- [ ] Add troubleshooting guide

---

## 5. Trade-offs Analysis

### What We Gain ✅

1. **Testability**
   - Native Playwright integration (no hacks)
   - Dialog stubbing built-in
   - Full access to Electron APIs
   - Better CI/CD integration

2. **Simplicity**
   - Single codebase (no dual-mode)
   - -700 lines of code
   - Simpler build process
   - Easier onboarding

3. **Cross-platform**
   - Windows support (Wails is macOS-only in our case)
   - Linux support
   - Consistent behavior across platforms

4. **Ecosystem**
   - Larger community (Electron >> Wails)
   - More tools and libraries
   - Better documentation
   - More examples

### What We Lose ❌

1. **Native macOS Dialogs**
   - Electron dialogs look slightly different
   - Not 100% native macOS feel
   - **User Impact**: Minimal - dialogs are functional

2. **Pure Go Stack**
   - Need Node.js for Electron
   - Adds JavaScript to build process
   - **Developer Impact**: Minimal - most devs know Node.js

3. **Wails Investment**
   - Epic 4 work on Wails integration
   - **Mitigation**: Go backend is 100% reusable

### What Stays the Same ✓

1. **Go Backend** (100% unchanged)
   - All business logic
   - Formula evaluation
   - File I/O
   - Tests

2. **Frontend UI** (95% unchanged)
   - HTML/CSS/JavaScript
   - Spreadsheet grid
   - User interactions

3. **Test Coverage** (100% maintained)
   - All existing tests port to Electron
   - Same test scenarios
   - Same assertions

---

## 6. Effort Estimate

### Development Time

| Task | Effort | Lines of Code |
|------|--------|---------------|
| Electron main process | 4 hours | 200 |
| Preload script | 1 hour | 50 |
| Frontend updates | 2 hours | 50 |
| Remove Wails code | 1 hour | -700 |
| Playwright test migration | 8 hours | 100 |
| Build configuration | 2 hours | 50 |
| Documentation | 4 hours | - |
| Testing & debugging | 8 hours | - |
| **Total** | **30 hours (4 days)** | **-250 net** |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Electron learning curve | Medium | Low | Good documentation, large community |
| Dialog behavior differences | Low | Low | Test thoroughly, iterate on UX |
| Build/packaging issues | Medium | Medium | Use electron-builder (battle-tested) |
| Test migration complexity | Low | Low | Playwright Electron API is straightforward |
| Go server integration | Low | Low | Already have HTTP server working |

---

## 7. Recommendation

**✅ PROCEED WITH ELECTRON MIGRATION**

**Rationale:**
1. **Testability is critical** - Playwright + Electron solves this completely
2. **Effort is reasonable** - 4 days for significant gains
3. **Code simplification** - Net reduction of 250 lines
4. **Non-native dialogs acceptable** - User explicitly stated this is OK
5. **Future-proof** - Cross-platform ready, larger ecosystem

**Proposed Timeline:**
- **Day 1**: Electron main process + preload script
- **Day 2**: Frontend updates + remove Wails code
- **Day 3**: Playwright test migration
- **Day 4**: Build configuration + documentation + testing

**Next Steps:**
1. Get user approval for migration
2. Create Epic 5.5 or Epic 8.5: "Migrate to Electron"
3. Branch from main: `feature/electron-migration`
4. Implement changes incrementally
5. Verify all tests pass
6. Update documentation
7. Merge and deploy

---

## 8. Answers to User Questions

### Q: "Dive deeper into testability of Electron with our current tooling"

**A: Electron + Playwright = Perfect Match**

**What Works:**
- ✅ Playwright has **first-class Electron support** (official API)
- ✅ Can launch Electron app directly: `_electron.launch()`
- ✅ Can stub native dialogs: `stubDialog()` from electron-playwright-helpers
- ✅ Can access main process: `electronApp.evaluate()`
- ✅ Can test multiple windows
- ✅ Can send IPC messages
- ✅ All our existing Playwright tests port easily

**Example Test:**
```javascript
const electronApp = await electron.launch({ args: ['main.js'] });
const window = await electronApp.firstWindow();

// Stub file dialog
await stubDialog(electronApp, 'showOpenDialog', { 
  filePaths: ['/test/file.sheet'] 
});

// Click Load button - dialog is stubbed, no UI shown
await window.getByRole('button', { name: 'Load' }).click();

// Verify file was loaded via HTTP API
const status = await window.evaluate(() => {
  return fetch('http://localhost:3000/api/file/status').then(r => r.json());
});
expect(status.path).toBe('/test/file.sheet');
```

**Comparison:**

| Feature | Wails + pyax | Electron + Playwright |
|---------|--------------|----------------------|
| Can test HTML buttons | ❌ No | ✅ Yes |
| Can test keyboard shortcuts | ❌ No | ✅ Yes |
| Can stub file dialogs | ❌ No | ✅ Yes |
| Can test IPC | ❌ No | ✅ Yes |
| Native integration | ❌ Hack | ✅ Official API |
| CI/CD friendly | ❌ Needs accessibility | ✅ Headless mode |

### Q: "Would we be able to drop the web mode?"

**A: ✅ YES - And We Should**

**Why Drop Web Mode:**

1. **Electron IS the web mode** - Chromium browser + desktop features
2. **Simplifies codebase** - Remove 700 lines of dual-mode code
3. **Better UX** - Desktop app with native-like dialogs
4. **Better testing** - Single test suite for single mode
5. **Easier deployment** - One build target

**What About Development?**

**Current Web Mode Dev Workflow:**
```bash
# Terminal 1: Start Go server
cd server && go run main.go

# Terminal 2: Open browser
open http://localhost:3000
```

**Electron Dev Workflow:**
```bash
# Terminal 1: Start Electron (auto-starts Go server)
npm start

# Hot reload works via electron-reload
```

**Even simpler!**

**What About Browser Testing During Dev?**

You can still test in browser if needed:
```bash
# Start Go server standalone
cd server && go run main.go

# Open browser
open http://localhost:3000
```

But Electron dev mode is just as fast and gives you the real environment.

**Migration Impact:**

| Component | Before | After |
|-----------|--------|-------|
| Entry points | 2 (web + native) | 1 (Electron) |
| API layers | 2 (HTTP + Wails IPC) | 1 (HTTP) |
| File services | 2 (upload/download + native) | 1 (Electron dialogs) |
| Test suites | 2 (browser + native) | 1 (Electron) |
| Build targets | 2 (server + Wails) | 1 (Electron) |
| Documentation | 2 modes | 1 mode |

**Recommendation: Drop web mode entirely**

---

## Appendix: Research Sources

1. **Playwright Electron Docs**: https://playwright.dev/docs/api/class-electron
2. **electron-playwright-helpers**: https://www.npmjs.com/package/electron-playwright-helpers
3. **Electron Accessibility**: https://electronjs.org/docs/latest/tutorial/accessibility
4. **pyax Documentation**: https://github.com/eeejay/pyax
5. **macOS Accessibility with pyax**: https://blog.monotonous.org/2026/01/12/macos-accessibility-with-pyax/
