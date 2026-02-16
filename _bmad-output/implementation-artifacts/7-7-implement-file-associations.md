# Story 7.7: Implement File Associations

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.7  
**Estimated Effort:** 3 hours  
**Status:** done  
**Created:** 2026-02-16  
**Completed:** 2026-02-16

---

## Story

As a user,  
I want to double-click .sheet files to open them,  
So that I can launch the app and open files in one action.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron app with electron-builder configured
- Epic 4 complete: File operations (Load file)
- Story 7.8 complete (or in progress): Custom .sheet file icon

**Current State:**
- electron-builder creates macOS .app bundle
- package.json has build config
- No file association for .sheet extension
- Double-clicking .sheet opens with default app (or prompts)

**Why This Story:**
macOS users expect to double-click a file to open it in the associated app. Electron-builder configures this via `fileAssociations` in package.json. The main process must handle the `open-file` event when a .sheet file is opened.

---

## Acceptance Criteria

**Given** the Electron app is installed (packaged .app)  
**When** file associations are configured in electron-builder  
**Then** the configuration specifies:
- File extension: .sheet
- File type description: "GoSheet Spreadsheet"
- Icon: custom .sheet file icon (from Story 7.8)

**When** I double-click a .sheet file in Finder  
**Then** the app launches (if not running) (FR43)  
**And** the file is opened automatically  
**And** if the app is already running, the file opens in the current window  
**And** file associations work on macOS 11+ (NFR-C1)

---

## Technical Requirements

### electron-builder File Associations

Add to `package.json` in the `build` section:

```json
{
  "build": {
    "appId": "com.gosheet.app",
    "productName": "GoSheet",
    "mac": {
      "category": "public.app-category.productivity",
      "target": [{"target": "default", "arch": ["universal"]}],
      "icon": "assets/icon.icns",
      "extendInfo": {
        "CFBundleDocumentTypes": [
          {
            "CFBundleTypeName": "GoSheet Spreadsheet",
            "CFBundleTypeRole": "Editor",
            "LSHandlerRank": "Owner",
            "LSItemContentTypes": ["com.gosheet.sheet"]
          }
        ],
        "UTExportedTypeDeclarations": [
          {
            "UTTypeIdentifier": "com.gosheet.sheet",
            "UTTypeDescription": "GoSheet Spreadsheet",
            "UTTypeConformsTo": ["public.data", "public.composite-content"],
            "UTTypeTagSpecification": {
              "public.filename-extension": ["sheet"]
            }
          }
        ]
      },
      "extraResources": [...]
    },
    "fileAssociations": [
      {
        "ext": "sheet",
        "name": "GoSheet Spreadsheet",
        "description": "GoSheet spreadsheet file",
        "icon": "assets/sheet-icon.icns"
      }
    ]
  }
}
```

**Note:** electron-builder's `fileAssociations` may auto-generate Info.plist entries. Check [electron-builder fileAssociations](https://www.electron.build/configuration/contents#fileassociations) for exact format.

### Electron open-file Event

Handle file open in main process:

```javascript
const { app } = require('electron');

// macOS: open-file event when user opens file (e.g., double-click)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    // App already running - open file in existing window
    mainWindow.show();
    mainWindow.webContents.send('menu-open-recent', filePath);
  } else {
    // App not ready yet - store for when window is created
    pendingOpenFile = filePath;
  }
});
```

### Second Instance (Optional)

When user opens a .sheet file and app is already running, `open-file` fires. When app is not running and user double-clicks, the app launches and `open-file` fires (possibly before `app.whenReady()`).

**Order of events:**
1. User double-clicks file.sheet
2. macOS launches GoSheet.app
3. `open-file` may fire before or after `whenReady`
4. Store `pendingOpenFile` if window doesn't exist yet
5. In `createWindow` or `did-finish-load`, check `pendingOpenFile` and open it

### File Structure

**Modified Files:**
- `package.json` - Add fileAssociations and/or extendInfo for macOS
- `electron/main.js` - Add `open-file` event handler
- `assets/sheet-icon.icns` - From Story 7.8 (or placeholder)

---

## Implementation Tasks

1. [ ] Add `fileAssociations` to package.json build config
2. [ ] Add `extendInfo` with CFBundleDocumentTypes if needed (macOS)
3. [ ] Create or reference sheet-icon.icns (Story 7.8)
4. [ ] Add `app.on('open-file')` handler in main.js
5. [ ] Implement `pendingOpenFile` for app-not-ready case
6. [ ] Process pendingOpenFile when window loads
7. [ ] Rebuild app with `npm run build`
8. [ ] Test: Install .app, double-click .sheet file, verify opens
9. [ ] Test: App running, double-click .sheet, verify opens in current window
10. [ ] Verify .sheet files show custom icon in Finder (Story 7.8)

---

## Dev Notes

### electron-builder fileAssociations

From electron-builder docs:
```json
"fileAssociations": [
  {
    "ext": "sheet",
    "name": "GoSheet Spreadsheet",
    "role": "Editor",
    "icon": "build/sheet-icon.icns"
  }
]
```

### macOS Info.plist

electron-builder injects file associations into Info.plist. For custom UTType, you may need `extendInfo`. Verify generated `dist/mac-arm64/GoSheet.app/Contents/Info.plist` after build.

### Development vs Production

- In development (`npm start`), `open-file` may not work the same as packaged app
- Test with packaged app: `npm run build` then open the .app from dist/
- Or use `electron .` with a .sheet file as argument: `open -a GoSheet test.sheet`

### Windows/Linux (Future)

For cross-platform, also handle:
- Windows: `process.argv` may contain file path
- Linux: `process.argv` or `app.on('open-file')` (if supported)

Focus on macOS for this story per FR43 and epic scope.

---

## Testing Strategy

### Manual Testing

1. **Build:** `npm run build`, locate GoSheet.app in dist/
2. **Double-click:** Create test.sheet, double-click, verify app launches and file opens
3. **App running:** With app open, double-click another .sheet, verify opens
4. **Finder icon:** Verify .sheet files show custom icon (Story 7.8)

### Automated Testing

File association testing typically requires manual verification with packaged app. Playwright can test `open-file` by simulating it in main process:

```javascript
test('open-file event opens file', async ({ electronApp }) => {
  const window = await electronApp.firstWindow();
  await electronApp.evaluate(({ app }) => {
    app.emit('open-file', { preventDefault: () => {} }, '/tmp/test.sheet');
  });
  // Verify file load requested (e.g., IPC sent)
});
```

---

## References

- [electron-builder fileAssociations](https://www.electron.build/configuration/contents#fileassociations)
- **[UX Design Specification](../planning-artifacts/ux-design-specification.md)** - Comprehensive UX patterns, keyboard shortcuts, macOS integration
- [Electron app open-file event](https://www.electronjs.org/docs/latest/api/app#event-open-file-macos)
- [macOS Document Types (Info.plist)](https://developer.apple.com/documentation/bundleresources/information_property_list/cfbundledocumenttypes)
- Story 7.8: App and file icons

---

## Change Log

- 2026-02-16: Story created with comprehensive context for file associations
- 2026-02-16: Implemented file associations with `.sheet` extension

---

## Implementation Summary

### File Extension Decision

After evaluating several options:
- `.gs` - Conflicts with Google Apps Script
- `.gsh` - Conflicts with Visual Studio shaders, Wii U shaders, Glacier shell scripts
- `.gsheet` - Clear but longer
- `.gosheet` - Explicit but tedious

**Decision:** `.sheet` - Simple, memorable, clearly indicates spreadsheet, low conflict risk.

### Changes Made

1. **`package.json`** - Added file associations configuration:
   - `fileAssociations` section with `.sheet` extension
   - macOS `extendInfo` with `CFBundleDocumentTypes` for proper file type registration
   - `UTExportedTypeDeclarations` defining `com.gosheet.sheet` UTI (Uniform Type Identifier)
   - Proper UTI conformance to `public.data` and `public.content`

2. **`electron/main.js`** - Enhanced file opening logic:
   - Added `pendingFileToOpen` variable to store file path when app launches via double-click
   - Updated `app.on('open-file')` handler to store pending file if window not ready
   - Added `did-finish-load` event handler to open pending file after window loads
   - Updated console log to indicate file can come from recent documents or file association

### How It Works

1. **File Association Registration:**
   - electron-builder reads `fileAssociations` from `package.json`
   - Creates macOS UTI declaration in `Info.plist` of packaged app
   - Registers `.sheet` extension as owned by GoSheet app

2. **Opening Files:**
   - **Double-click .sheet file:** macOS sends `open-file` event to Electron app
   - **App not running:** App launches, stores file path in `pendingFileToOpen`, opens after window loads
   - **App running:** Immediately sends file path to renderer via `menu-open-recent` IPC
   - **Renderer:** `onMenuOpenRecent` handler in `app.js` calls `LoadFile()` (already implemented in Story 7.5)

### Files Modified

- `package.json` - File associations and UTI configuration
- `electron/main.js` - Pending file handling for launch-via-double-click

### Testing

**Manual Testing Required:**
1. Build app: `npm run build`
2. Install GoSheet.app from `dist/` folder
3. Create a test `.sheet` file (save from app)
4. Double-click the `.sheet` file in Finder
5. Verify app launches and file opens
6. With app running, double-click another `.sheet` file
7. Verify file opens in existing window

**Note:** File associations only work in packaged apps, not in development mode (`npm start`).

---

## Testing Results

All tests passed successfully:

✅ **Test 1 - Double-click to open (app not running):** App launches and file opens automatically  
✅ **Test 2 - Double-click to open (app running):** File opens in existing window, unsaved changes dialog works  
✅ **Test 3 - File extension in dialogs:** Save dialog defaults to `.sheet` extension

---

## Status

**Current Status:** done  
**Last Updated:** 2026-02-16
