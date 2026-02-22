# Story 7.6: Implement Dock Integration

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.6  
**Estimated Effort:** 2-3 hours  
**Status:** done  
**Created:** 2026-02-16

---

## Story

As a user,  
I want dock integration with recent files,  
So that I can quickly access recent spreadsheets from the dock.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron app with IPC handlers
- Story 7.5 complete: Recent files list implemented and persisted

**Current State:**
- App runs and appears in dock (default Electron behavior)
- No custom dock menu
- Recent files list exists (Story 7.5) but not in dock

**Why This Story:**
macOS users expect to right-click the dock icon and see recent files and quick actions. Electron provides `app.dock` (macOS only) for this. The dock menu uses the same recent files data from Story 7.5.

---

## Acceptance Criteria

**Given** the Electron app is installed (or running)  
**When** I right-click the app icon in the dock  
**Then** a dock menu appears showing:
- Recent Files (list of up to 5 most recent files)
- New Spreadsheet

**When** I click a recent file in the dock menu  
**Then** the app launches (if not running) and opens the file  
**And** if app is already running, the file opens in the current window

**When** I click New Spreadsheet  
**Then** the app launches (if not running) and creates a new spreadsheet  
**And** if app is already running, creates new spreadsheet in current window

**And** the app icon is visible in the dock (FR46)  
**And** dock menu is implemented using Electron `app.dock.setMenu()`

---

## Technical Requirements

### Electron app.dock API (macOS only)

```javascript
const { app, Menu } = require('electron');

// Only available on macOS
if (process.platform === 'darwin') {
  const dockMenu = Menu.buildFromTemplate([
    {
      label: 'New Spreadsheet',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('menu-new');
        } else {
          // App not running - will be handled when window created
          pendingDockAction = 'new';
        }
      }
    },
    { type: 'separator' },
    ...recentFiles.slice(0, 5).map(fp => ({
      label: path.basename(fp),
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('menu-open-recent', fp);
        } else {
          pendingDockAction = { type: 'open', path: fp };
        }
      }
    }))
  ]);
  
  app.dock.setMenu(dockMenu);
}
```

### Dynamic Dock Menu Updates

The dock menu must be updated when recent files change:
- Call `app.dock.setMenu()` after updating recent files list
- Rebuild menu template with current recent files (up to 5)

### App Not Running Scenario

When user clicks dock menu item and app is not running:
1. macOS launches the app
2. App's `app.whenReady()` runs
3. Window is created
4. Need to check for "pending" dock action (e.g., open file or new)
5. Electron's `open-file` event (for file associations) - dock menu click with file path can be stored and processed when ready

**Implementation:** Use a variable `pendingDockAction` set before app ready, then process in `createWindow` or when window loads.

Alternatively: When app launches from dock menu click, the `second-instance` or `open-file` events may fire. For "New Spreadsheet" when app not running, we need to store intent and process when window is ready.

### File Structure

**Modified Files:**
- `electron/main.js` - Add `updateDockMenu()`, call on app ready and when recent files change; uses `loadRecentFiles()` from Story 7.5 (no separate recent-files.js)

---

## Implementation Tasks

1. [x] Add `process.platform === 'darwin'` check for dock API
2. [x] Create dock menu template with New Spreadsheet and Recent Files
3. [x] Limit dock recent files to 5 (vs 10 in File menu)
4. [x] Call `app.dock.setMenu()` on app ready
5. [x] Update dock menu when recent files list changes (call from recent-files module)
6. [x] Handle dock click when app not running (pending action)
7. [x] Ensure mainWindow.show() when dock item clicked (app in background)
8. [x] Test: right-click dock, verify menu, click items
9. [x] Test: quit app, right-click dock icon, click New - verify app launches

---

## Dev Notes

### Dock Menu Limitations

- Dock menu is static at creation time - must rebuild when recent files change
- No submenus in dock menu (flat list)
- Label length: keep short, use filename only (path may be long)

### Rebuild Dock Menu

```javascript
function updateDockMenu() {
  if (process.platform !== 'darwin') return;
  
  const recentFiles = getRecentFiles().slice(0, 5);
  const template = [
    { label: 'New Spreadsheet', click: () => handleDockNew() },
    { type: 'separator' }
  ];
  
  if (recentFiles.length === 0) {
    template.push({ label: '(No recent files)', enabled: false });
  } else {
    recentFiles.forEach(fp => {
      template.push({
        label: path.basename(fp),
        click: () => handleDockOpenFile(fp)
      });
    });
  }
  
  app.dock.setMenu(Menu.buildFromTemplate(template));
}
```

Call `updateDockMenu()` from:
- `app.whenReady()` (after loading recent files)
- After `addRecentFile()` in recent-files.js
- After `removeRecentFile()`

### Pending Dock Action

When app is launched by dock menu click (e.g., from Finder or after quit), the app may receive the click before the window exists. Store the action:

```javascript
let pendingDockAction = null;

function handleDockOpenFile(filePath) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.webContents.send('menu-open-recent', filePath);
  } else {
    pendingDockAction = { type: 'open', path: filePath };
  }
}

// In createWindow, after load:
mainWindow.webContents.once('did-finish-load', () => {
  if (pendingDockAction) {
    if (pendingDockAction.type === 'open') {
      mainWindow.webContents.send('menu-open-recent', pendingDockAction.path);
    } else if (pendingDockAction === 'new') {
      mainWindow.webContents.send('menu-new');
    }
    pendingDockAction = null;
  }
});
```

---

## Testing Strategy

### Manual Testing

1. **Dock menu:** Right-click dock icon, verify menu appears
2. **New Spreadsheet:** Click, verify new spreadsheet created
3. **Recent file:** Open a file, right-click dock, click file, verify opens
4. **App not running:** Quit app, right-click dock (if possible), click New - verify app launches
5. **App in background:** Minimize, dock click recent file, verify window shows and file opens

### Automated Testing

Dock menu testing may require manual verification; Playwright may not easily simulate dock right-click. Document manual test steps.

---

## References

- [Electron app.dock](https://www.electronjs.org/docs/latest/api/app#appdocksetmenumenu-macos)
- **[UX Design Specification](../planning-artifacts/ux-design-specification.md)** - Comprehensive UX patterns, keyboard shortcuts, macOS integration
- [macOS Dock Menus (HIG)](https://developer.apple.com/design/human-interface-guidelines/menus#Dock-menus)
- Story 7.5: Recent files list (data source)

---

## File List

- electron/main.js (modified)
- playwright_tests/test_dock_menu.spec.js (new)

---

## Dev Agent Record

**Implementation Plan:** Added `updateDockMenu()` using `loadRecentFiles()`, platform check for darwin, pendingDockAction for no-window scenario, initialWindowCreated to avoid double-create during startup.

**Completion Notes:** All 9 tasks implemented. Dock menu shows New Spreadsheet + up to 5 recent files. Updates via syncRecentFilesMenu when files change. Playwright tests verify menu structure on macOS (skipped on other platforms).

**Code Review Fixes (2026-02-17):** Updated story doc (File Structure, Implementation Details, Change Log). Added "Open..." assertion to dock menu test. Added fs.existsSync validation before sending menu-open-recent. Refactored syncRecentFilesMenu to pass files into updateDockMenu (avoid redundant loadRecentFiles). Added JSDoc for updateDockMenu. Removed dead app.getRecentDocuments migration (Electron 30 lacks it).

---

## Change Log

- 2026-02-16: Story created with comprehensive context for Electron dock integration
- 2026-02-17: Implementation completed (initial doc)
- 2026-02-17: Story unblocked; implemented dock menu using loadRecentFiles(); added updateDockMenu(), pendingDockAction handling, Playwright tests
- 2026-02-17: Post-implementation: single-instance lock (Keep in Dock), Open in dock menu, removed app.addRecentDocument to avoid dock duplication; code review fixes

---

## Implementation Details

### Files Modified

**electron/main.js:**
- Added `Menu` to require statement
- `requestSingleInstanceLock()` - prevents duplicate Electron splash when "Keep in Dock" launches raw Electron
- Created `updateDockMenu()` - New Spreadsheet, Open..., up to 5 recent files (JSDoc documented)
- Uses `loadRecentFiles()` (custom storage); no `app.addRecentDocument` (avoids dock duplication)
- Handles clicks when app running (show window + IPC) or not (pendingDockAction + createWindow)
- Called on app ready and from `syncRecentFilesMenu()` when recent files change

**playwright_tests/test_dock_menu.spec.js:** (new)
- Verifies dock menu is set on macOS with New Spreadsheet, Open..., and recent files
- Verifies menu structure (New Spreadsheet, Open..., separator, recent files or "(No recent files)")

### How It Works

1. **On app startup**: `updateDockMenu()` is called in app.whenReady to set dock menu before window loads
2. **When file is saved/opened**: `addToRecentFiles()` is called, which:
   - Updates `recent-files.json` and calls `syncRecentFilesMenu()`
   - `syncRecentFilesMenu()` calls `updateDockMenu()` to refresh the dock menu
3. **When user right-clicks dock icon**: macOS shows the custom dock menu
4. **When user clicks "New Spreadsheet"**: 
   - If app running: Shows window and sends `menu-new` IPC event
   - If app not running: Creates window (which starts with new spreadsheet)
5. **When user clicks a recent file**:
   - If app running: Shows window and sends `menu-open-recent` IPC event with file path
   - If app not running: Creates window, waits for load, then sends IPC event

### Platform Check

All dock menu code is wrapped in `if (process.platform !== 'darwin')` check since `app.dock` is only available on macOS.

---

## Status

**Current Status:** done  
**Last Updated:** 2026-02-17

**Implementation complete.** Dock menu shows New Spreadsheet + up to 5 recent files from `loadRecentFiles()`. Updates when recent files change. Handles app-not-running via `pendingDockAction`.
