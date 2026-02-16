# Story 7.5: Implement Recent Files List

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.5  
**Estimated Effort:** 3-4 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As a user,  
I want to see a list of recently opened files,  
So that I can quickly resume work on recent spreadsheets.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron app with IPC handlers
- Epic 4 complete: File operations (Open, Save)
- Story 7.1 complete: File menu with Recent Files submenu placeholder

**Current State:**
- File menu has "Recent Files" submenu (empty from Story 7.1)
- No persistence of recently opened/saved file paths
- No integration with dock menu (Story 7.6 will use this data)

**Why This Story:**
Users need quick access to recently used files. This story implements persistence, updates the File menu submenu, and prepares data for dock integration (Story 7.6). Electron provides `app.getPath('userData')` for storing app data.

---

## Acceptance Criteria

**Given** the Electron app is running  
**When** I open or save a file  
**Then** the file path is added to the recent files list  
**And** the list stores up to 10 recent files  
**And** the list is persisted to disk (in app data directory)  
**And** duplicate entries are removed (same file moved to top)

**When** I view File > Recent Files submenu  
**Then** the submenu shows the 10 most recent files  
**And** each item shows the filename and parent directory (or full path)  
**And** most recent file is at top

**When** I click a recent file in the submenu  
**Then** the file is opened (same as File > Open)  
**And** if the file no longer exists, it's removed from the list and user sees error  
**And** the recent files list is also displayed in the dock menu (Story 7.6)

---

## Technical Requirements

### Electron APIs

**App path for storage:**
```javascript
const { app } = require('electron');
const userDataPath = app.getPath('userData');
// e.g., ~/Library/Application Support/GoSheet/
const recentFilesPath = path.join(userDataPath, 'recent-files.json');
```

**Add to recent documents (optional macOS integration):**
```javascript
app.addRecentDocument('/path/to/file.sheet');
// macOS adds to Open Recent in File menu automatically
// But we want custom submenu, so we manage our own list
```

### Recent Files Storage Format

```json
["/Users/john/Documents/budget.sheet", "/Users/john/Desktop/data.sheet"]
```

- Array of full file paths
- Newest first
- Max 10 entries
- Persist as JSON file

### Menu Dynamic Updates

The Recent Files submenu must be updated:
1. On app startup (load from disk)
2. After Open file
3. After Save file
4. When user clicks a recent file (reorder to top)

```javascript
function updateRecentFilesMenu(recentFiles) {
  const recentSubmenu = recentFiles.slice(0, 10).map((filePath, index) => ({
    label: path.basename(filePath) + ' — ' + path.dirname(filePath),
    click: () => mainWindow.webContents.send('menu-open-recent', filePath)
  }));
  // Update menu template and rebuild, or use dynamic menu
}
```

### Integration Points

**Main process:**
- `recent-files.js` or logic in `main.js`: load, save, add, remove
- IPC: `recent-files:add` (path), `recent-files:get`, `recent-files:remove` (path)
- Call add when: Open succeeds, Save succeeds
- Call remove when: File doesn't exist on open attempt

**Renderer:**
- Listen for `menu-open-recent` with path
- Call LoadFile API with path (same as Open)
- Handle FILE_NOT_FOUND error, send IPC to remove from list

**Preload:**
- Expose `addRecentFile(path)`, `getRecentFiles()`, `removeRecentFile(path)`
- Expose `onOpenRecent(callback)` for menu click

### File Structure

**New Files:**
- `electron/recent-files.js` - Load, save, add, get, remove logic

**Modified Files:**
- `electron/main.js` - Import recent-files, call add on open/save, setup IPC
- `electron/menu.js` - Build Recent Files submenu dynamically
- `frontend/app.js` - Handle menu-open-recent, call LoadFile
- `electron/preload.js` - Expose recent files IPC

---

## Implementation Tasks

1. [ ] Create `electron/recent-files.js` with load/save/add/remove
2. [ ] Create `recent-files.json` in userData on first run
3. [ ] Add IPC handlers for recent files
4. [ ] Update File menu Recent Files submenu dynamically
5. [ ] Call addRecentFile when Open succeeds (in main or renderer)
6. [ ] Call addRecentFile when Save succeeds
7. [ ] Implement menu-open-recent handler (load file by path)
8. [ ] Handle file not found: remove from list, show error
9. [ ] Limit to 10 files, newest first, no duplicates
10. [ ] Display format: filename + parent dir (or truncate path)
11. [ ] Test persistence across app restarts

---

## Dev Notes

### When to Add to Recent Files

- **Open:** When user selects file in Open dialog and load succeeds
- **Save:** When user saves (new path or existing path)
- **Save As:** When user saves to new path

Do NOT add when:
- New spreadsheet (no path)
- Load fails

### Menu Rebuild Strategy

Electron menus can be rebuilt when recent files change:

```javascript
function buildApplicationMenu() {
  const recentFiles = loadRecentFiles();
  const recentSubmenu = recentFiles.length > 0
    ? recentFiles.map(fp => ({
        label: `${path.basename(fp)} — ${path.dirname(fp)}`,
        click: () => openRecentFile(fp)
      }))
    : [{ label: '(No recent files)', enabled: false }];
  
  const template = [
    { label: 'File', submenu: [
      { label: 'New', accelerator: 'CmdOrCtrl+N', click: ... },
      { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: ... },
      { type: 'separator' },
      { label: 'Recent Files', submenu: recentSubmenu },
      // ... rest
    ]},
    // ...
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
```

Call `buildApplicationMenu()` after add/remove.

### Clear Recent Files (Optional)

Consider adding "Clear Recent Files" at bottom of submenu for user control.

---

## Testing Strategy

### Manual Testing

1. Open file A, verify in Recent Files
2. Open file B, verify B at top, A second
3. Save file C, verify C in list
4. Click recent file, verify it opens
5. Delete a recent file from disk, click it, verify error and removal from list
6. Restart app, verify list persisted

### Automated Testing

```javascript
test('recent files persisted', async ({ electronApp }) => {
  const result = await electronApp.evaluate(async ({ app }) => {
    const path = require('path');
    const fs = require('fs');
    const userData = app.getPath('userData');
    const recentPath = path.join(userData, 'recent-files.json');
    const data = fs.existsSync(recentPath) ? fs.readFileSync(recentPath, 'utf8') : '[]';
    return JSON.parse(data);
  });
  expect(Array.isArray(result)).toBe(true);
});
```

---

## References

- [Electron app.getPath](https://www.electronjs.org/docs/latest/api/app#appgetpathname)
- **[UX Design Specification](../planning-artifacts/ux-design-specification.md)** - Comprehensive UX patterns, keyboard shortcuts, macOS integration
- [Electron app.addRecentDocument](https://www.electronjs.org/docs/latest/api/app#appaddrecentdocumentpath-macos-windows) (optional)
- Story 7.1: File menu structure
- Story 7.6: Dock integration (uses same recent files data)

---

## Change Log

- 2026-02-16: Story created with comprehensive context for recent files implementation

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16
