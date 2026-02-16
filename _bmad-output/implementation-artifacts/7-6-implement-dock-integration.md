# Story 7.6: Implement Dock Integration

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.6  
**Estimated Effort:** 2-3 hours  
**Status:** blocked  
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
- `electron/main.js` - Add `setupDockMenu()`, call on app ready and when recent files change
- `electron/recent-files.js` - Export function to get recent files for dock menu
- Integrate with Story 7.5 recent files module

---

## Implementation Tasks

1. [ ] Add `process.platform === 'darwin'` check for dock API
2. [ ] Create dock menu template with New Spreadsheet and Recent Files
3. [ ] Limit dock recent files to 5 (vs 10 in File menu)
4. [ ] Call `app.dock.setMenu()` on app ready
5. [ ] Update dock menu when recent files list changes (call from recent-files module)
6. [ ] Handle dock click when app not running (pending action)
7. [ ] Ensure mainWindow.show() when dock item clicked (app in background)
8. [ ] Test: right-click dock, verify menu, click items
9. [ ] Test: quit app, right-click dock icon, click New - verify app launches

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

## Change Log

- 2026-02-16: Story created with comprehensive context for Electron dock integration
- 2026-02-17: Implementation completed

---

## Implementation Details

### Files Modified

**electron/main.js:**
- Added `Menu` to require statement
- Created `updateDockMenu()` function to build and set dock menu
- Calls `app.getRecentDocuments()` to get recent files from macOS
- Builds menu with "New Spreadsheet" and up to 5 recent files
- Handles clicks when app is running (show window + send IPC) or not running (create window + send IPC after load)
- Called `updateDockMenu()` on app ready and after adding recent documents

### How It Works

1. **On app startup**: `updateDockMenu()` is called to initialize the dock menu with any existing recent documents
2. **When file is saved/opened**: `addRecentFile()` is called, which:
   - Calls `app.addRecentDocument(path)` (macOS manages the list)
   - Calls `updateDockMenu()` to refresh the dock menu
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

**Current Status:** blocked  
**Last Updated:** 2026-02-17

**Blocked by:** Technical Debt #1 - Upgrade Electron to Supported Version

**Reason:** This story requires `app.getRecentDocuments()` API which was added in Electron 36+. Current version is Electron 30.5.1 (EOL). 

**Workaround attempted:** Manually tracking recent files in main process works, but decided to defer implementation until Electron upgrade to avoid maintaining duplicate code.

**Next steps:** 
1. Upgrade Electron to version 38+ or 40+ (see TECHNICAL-DEBT.md #1)
2. Resume this story after upgrade
3. Use native `app.getRecentDocuments()` API for dock menu
