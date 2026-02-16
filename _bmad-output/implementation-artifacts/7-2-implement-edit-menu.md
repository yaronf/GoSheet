# Story 7.2: Implement Edit Menu

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.2  
**Estimated Effort:** 2-3 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As a user,  
I want an Edit menu with standard macOS actions,  
So that I can use familiar editing commands.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron app with IPC handlers
- Epic 4 complete: File operations
- Epic 6 complete: CSV Import/Export
- Story 7.1 complete: File menu implemented

**Current State:**
- File menu exists with standard items
- Spreadsheet grid supports cell selection and editing
- No Edit menu or clipboard operations for cells
- Cut/Copy/Paste/Select All must be implemented

**Why This Story:**
macOS users expect standard Edit menu commands for clipboard operations. This story implements the Edit menu using Electron's Menu API and integrates with the spreadsheet's cell selection model. Note: Undo/Redo are deferred to Phase 2 per PRD.

---

## Acceptance Criteria

**Given** the Electron app is running  
**When** I view the menu bar  
**Then** an Edit menu is visible with the following items:
- Cut (Cmd+X)
- Copy (Cmd+C)
- Paste (Cmd+V)
- Select All (Cmd+A)

**And** all menu items are implemented using Electron `Menu.buildFromTemplate()`  
**And** Cut removes selected cell value(s) and places in clipboard  
**And** Copy places selected cell value(s) in clipboard without removing  
**And** Paste inserts clipboard content into selected cell(s)  
**And** Select All selects all non-empty cells in the grid  
**And** keyboard shortcuts work globally within the app  
**And** the menu follows macOS Human Interface Guidelines  
**And** Undo/Redo are NOT included (deferred to Phase 2 per PRD)

---

## Technical Requirements

### Electron Menu API

Add Edit menu to the application menu template (in `electron/menu.js` or `electron/main.js`):

```javascript
const { Menu, clipboard } = require('electron');

const editMenu = {
  label: 'Edit',
  submenu: [
    {
      label: 'Cut',
      accelerator: 'CmdOrCtrl+X',
      click: () => mainWindow.webContents.send('menu-cut')
    },
    {
      label: 'Copy',
      accelerator: 'CmdOrCtrl+C',
      click: () => mainWindow.webContents.send('menu-copy')
    },
    {
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      click: () => mainWindow.webContents.send('menu-paste')
    },
    { type: 'separator' },
    {
      label: 'Select All',
      accelerator: 'CmdOrCtrl+A',
      click: () => mainWindow.webContents.send('menu-select-all')
    }
  ]
};
```

### Clipboard Integration

**Electron clipboard API** (main process):
- Use `clipboard.writeText()` for Copy/Cut
- Use `clipboard.readText()` for Paste
- Consider custom MIME type for cell data (e.g., JSON with cell refs and values)

**Approach Options:**
1. **Renderer-side clipboard**: Use `navigator.clipboard` in renderer (simpler, works with web APIs)
2. **Main process IPC**: Send cell data via IPC, main process uses `clipboard` module
3. **Hybrid**: Renderer handles logic, uses `window.electronAPI` for clipboard if needed

**Recommended:** Use IPC to send/receive clipboard data. Main process can use `clipboard` for system clipboard, or renderer can use `document.execCommand` / `navigator.clipboard` for paste. For spreadsheet cells, consider storing structured data (cell refs + values) in a custom format.

### Integration Points

**Frontend (app.js):**
- Listen for `menu-cut`, `menu-copy`, `menu-paste`, `menu-select-all` via `ipcRenderer.on()` (exposed through preload)
- Implement `handleCut()`, `handleCopy()`, `handlePaste()`, `handleSelectAll()` functions
- Use HTTP API for cell operations: `POST /api/cell/set`, `GET /api/cell/value`, `GET /api/cells/all`
- For multi-cell selection: may need new API endpoints or client-side logic

**Preload additions:**
```javascript
// Expose menu event listeners
onMenuCut: (callback) => ipcRenderer.on('menu-cut', callback),
onMenuCopy: (callback) => ipcRenderer.on('menu-copy', callback),
onMenuPaste: (callback) => ipcRenderer.on('menu-paste', callback),
onMenuSelectAll: (callback) => ipcRenderer.on('menu-select-all', callback),
// Clipboard (if using main process)
writeToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
readFromClipboard: () => ipcRenderer.invoke('clipboard:read'),
```

### File Structure

**Modified Files:**
- `electron/main.js` or `electron/menu.js` - Add Edit menu template
- `electron/preload.js` - Expose menu event listeners and clipboard APIs
- `frontend/app.js` - Implement cut/copy/paste/select-all handlers

---

## Implementation Tasks

1. [ ] Add Edit menu template to application menu
2. [ ] Add keyboard accelerators (Cmd+X, Cmd+C, Cmd+V, Cmd+A)
3. [ ] Expose menu event listeners in preload script
4. [ ] Implement Cut handler: get selected cell value, copy to clipboard, clear cell via API
5. [ ] Implement Copy handler: get selected cell value, copy to clipboard
6. [ ] Implement Paste handler: read clipboard, set cell value via API
7. [ ] Implement Select All handler: select all non-empty cells (or expand selection to full grid)
8. [ ] Handle multi-cell selection if supported (copy range, paste range)
9. [ ] Test all menu items and shortcuts
10. [ ] Verify macOS HIG compliance

---

## Dev Notes

### Cut/Copy/Paste Logic

For single-cell operations:
```javascript
// Cut: Copy value to clipboard, then delete cell
async function handleCut() {
  if (!selectedCell) return;
  const value = await GetCellRawValue(selectedCell.row, selectedCell.col);
  await navigator.clipboard.writeText(value);
  await SetCellValue(selectedCell.row, selectedCell.col, '');
  refreshGrid();
}

// Copy: Copy value to clipboard
async function handleCopy() {
  if (!selectedCell) return;
  const value = await GetCellRawValue(selectedCell.row, selectedCell.col);
  await navigator.clipboard.writeText(value);
}

// Paste: Read clipboard, set cell value
async function handlePaste() {
  if (!selectedCell) return;
  const text = await navigator.clipboard.readText();
  await SetCellValue(selectedCell.row, selectedCell.col, text);
  refreshGrid();
}
```

### Select All

Select All typically selects all cells in the grid. Options:
- Select all non-empty cells (per epics: "Select All selects all non-empty cells")
- Or select entire grid range (A1 to last used cell)
- Update `selectedCell` and selection highlight to show range
- May need to extend selection model to support ranges

### macOS Conventions

- Edit menu appears after File menu
- Standard order: Undo, Redo, Cut, Copy, Paste, Select All (we skip Undo/Redo)
- Use separator before Select All
- Accelerators: CmdOrCtrl for cross-platform, Cmd on macOS

---

## Testing Strategy

### Manual Testing

1. **Edit Menu Visibility:** Verify Edit menu appears with all items
2. **Cut:** Select cell, Cut, verify value in clipboard, cell cleared
3. **Copy:** Select cell, Copy, verify value in clipboard, cell unchanged
4. **Paste:** Copy value, select empty cell, Paste, verify value appears
5. **Select All:** Verify all non-empty cells get selected
6. **Keyboard Shortcuts:** Test Cmd+X, Cmd+C, Cmd+V, Cmd+A

### Automated Testing

```javascript
test('Edit menu cut/copy/paste', async ({ electronApp }) => {
  const window = await electronApp.firstWindow();
  // Enter value in cell
  await window.click('[data-cell="A1"]');
  await window.keyboard.type('100');
  await window.keyboard.press('Enter');
  // Trigger Copy via menu
  await electronApp.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const editMenu = menu.items.find(i => i.label === 'Edit');
    const copyItem = editMenu.submenu.items.find(i => i.label === 'Copy');
    copyItem.click();
  });
  // Paste into B1
  await window.click('[data-cell="B1"]');
  await window.keyboard.press('Meta+v');
  // Verify B1 has value
  const b1Value = await window.locator('[data-cell="B1"]').textContent();
  expect(b1Value).toContain('100');
});
```

---

## References

- [Electron Menu Documentation](https://www.electronjs.org/docs/latest/api/menu)
- **[UX Design Specification](../planning-artifacts/ux-design-specification.md)** - Comprehensive UX patterns, keyboard shortcuts, macOS integration
- [Electron clipboard Documentation](https://www.electronjs.org/docs/latest/api/clipboard)
- [macOS Human Interface Guidelines - Edit Menu](https://developer.apple.com/design/human-interface-guidelines/menus)
- Story 7.1: File menu implementation pattern
- Epic 4: File operations, API endpoints

---

## Change Log

- 2026-02-16: Story created with comprehensive context for Electron Edit menu implementation

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16
