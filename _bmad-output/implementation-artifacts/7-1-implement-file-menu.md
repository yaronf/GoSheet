# Story 7.1: Implement File Menu

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.1  
**Estimated Effort:** 3 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As a user,  
I want a File menu with standard macOS actions,  
So that I can access file operations using familiar patterns.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron app with IPC handlers
- Epic 4 complete: File operations (New, Open, Save, Save As)
- Epic 6 complete: CSV Import/Export functionality

**Current State:**
- Electron app runs with functional file operations
- All file operations accessible via toolbar buttons only
- No native macOS menu bar integration
- Keyboard shortcuts work only when focused on specific UI elements

**Why This Story:**
macOS users expect native menu bar integration with standard File menu items and keyboard shortcuts that work globally within the app. This story implements the File menu using Electron's Menu API to provide a native macOS experience.

---

## Acceptance Criteria

**Given** the Electron app is running  
**When** I view the menu bar  
**Then** a File menu is visible with the following items:
- New (Cmd+N)
- Open... (Cmd+O)
- Recent Files > (submenu; initially empty)
- Save (Cmd+S)
- Save As... (Cmd+Shift+S)
- Import CSV...
- Export CSV...
- Close Window (Cmd+W)
- Quit (Cmd+Q)

**And** all menu items trigger the corresponding IPC handlers  
**And** keyboard shortcuts work globally within the app  
**And** menu items are enabled/disabled based on app state (e.g., Save disabled when no changes)  
**And** the menu follows macOS Human Interface Guidelines

---

## Technical Requirements

### Electron Menu API

Use Electron's `Menu` and `MenuItem` APIs to create native macOS menus:

```javascript
const { Menu, app } = require('electron');

const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CmdOrCtrl+N',
        click: () => { /* trigger new file */ }
      },
      // ... more items
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
```

### Integration Points

**Existing IPC Handlers (from Epic 4):**
- `dialog:openFile` - Open file dialog
- `dialog:saveFile` - Save file dialog

**Existing API Endpoints:**
- `/api/file/new` - Create new spreadsheet
- `/api/file/save` - Save current file
- `/api/file/load` - Load file
- `/api/csv/import` - Import CSV
- `/api/csv/export` - Export CSV

### Menu State Management

The menu needs to communicate with the renderer process to:
1. Get current file state (modified, has file path)
2. Enable/disable menu items dynamically
3. Trigger file operations

**Approach:**
- Add IPC handlers for menu actions that call existing file operation APIs
- Use `webContents.send()` to communicate menu actions to renderer
- Renderer responds with state updates via `ipcRenderer.send()`

### File Structure

**New Files:**
- `electron/menu.js` - Menu template and setup
- Update `electron/main.js` - Import and initialize menu

**Modified Files:**
- `electron/main.js` - Call menu setup after app ready
- `frontend/app.js` - Listen for menu-triggered events

---

## Implementation Tasks

1. ✅ Create `electron/menu.js` with File menu template
2. ✅ Implement menu item click handlers
3. ✅ Add keyboard accelerators (Cmd+N, Cmd+O, etc.)
4. ✅ Integrate with existing IPC handlers
5. ✅ Add menu state management (enable/disable based on app state)
6. ✅ Test all menu items and shortcuts
7. ✅ Implement Recent Files submenu (initially empty, populated in Story 7.5)
8. ✅ Update documentation

---

## Dev Notes

### macOS Menu Conventions

Follow macOS Human Interface Guidelines:
- File menu is always first after app menu
- Standard items in standard order (New, Open, Save, etc.)
- Keyboard shortcuts use Cmd key (CmdOrCtrl in Electron)
- Separator lines between logical groups
- Ellipsis (...) indicates dialog will open

### Menu Template Structure

```javascript
const fileMenu = {
  label: 'File',
  submenu: [
    {
      label: 'New',
      accelerator: 'CmdOrCtrl+N',
      click: () => mainWindow.webContents.send('menu-new')
    },
    {
      label: 'Open...',
      accelerator: 'CmdOrCtrl+O',
      click: () => mainWindow.webContents.send('menu-open')
    },
    { type: 'separator' },
    {
      label: 'Recent Files',
      submenu: [] // Populated in Story 7.5
    },
    { type: 'separator' },
    {
      label: 'Save',
      accelerator: 'CmdOrCtrl+S',
      enabled: false, // Dynamically updated
      click: () => mainWindow.webContents.send('menu-save')
    },
    // ... more items
  ]
};
```

### Dynamic Menu Updates

To enable/disable menu items based on app state:

```javascript
// In main process
ipcMain.on('update-menu-state', (event, state) => {
  const menu = Menu.getApplicationMenu();
  const saveItem = menu.getMenuItemById('save');
  if (saveItem) {
    saveItem.enabled = state.hasUnsavedChanges;
  }
});

// In renderer process
function updateMenuState() {
  window.electronAPI.updateMenuState({
    hasUnsavedChanges: /* check state */,
    hasFilePath: /* check state */
  });
}
```

---

## Testing Strategy

### Manual Testing

1. **Menu Visibility:**
   - Launch app
   - Verify File menu appears in menu bar
   - Verify all items present in correct order

2. **Menu Actions:**
   - Test each menu item clicks
   - Verify correct dialog/action triggered
   - Test with and without existing file

3. **Keyboard Shortcuts:**
   - Test Cmd+N (New)
   - Test Cmd+O (Open)
   - Test Cmd+S (Save)
   - Test Cmd+Shift+S (Save As)
   - Test Cmd+W (Close)
   - Test Cmd+Q (Quit)

4. **Menu State:**
   - Verify Save disabled when no changes
   - Verify Save enabled after editing
   - Verify Save As always enabled

### Automated Testing

Add Playwright tests for menu integration:

```javascript
test('File menu exists with all items', async ({ electronApp }) => {
  const menu = await electronApp.evaluate(({ Menu }) => {
    const appMenu = Menu.getApplicationMenu();
    const fileMenu = appMenu.items.find(item => item.label === 'File');
    return {
      label: fileMenu.label,
      itemCount: fileMenu.submenu.items.length,
      items: fileMenu.submenu.items.map(i => i.label)
    };
  });
  
  expect(menu.label).toBe('File');
  expect(menu.items).toContain('New');
  expect(menu.items).toContain('Open...');
  expect(menu.items).toContain('Save');
});
```

---

## References

- [Electron Menu Documentation](https://www.electronjs.org/docs/latest/api/menu)
- [Electron MenuItem Documentation](https://www.electronjs.org/docs/latest/api/menu-item)
- [macOS Human Interface Guidelines - Menus](https://developer.apple.com/design/human-interface-guidelines/menus)
- Epic 4: File Operations implementation
- Epic 6: CSV Import/Export implementation

---

## Change Log

- 2026-02-16: Story created with comprehensive context for Electron menu implementation

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16

Ultimate context engine analysis completed - comprehensive developer guide created.
