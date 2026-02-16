# Story 7.4: Implement Keyboard Shortcuts

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.4  
**Estimated Effort:** 2-3 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As a user,  
I want keyboard shortcuts for common actions,  
So that I can work efficiently without using the mouse.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron app with IPC handlers
- Epic 4 complete: File operations
- Epic 6 complete: CSV Import/Export
- Stories 7.1, 7.2, 7.3 complete: File, Edit, Help menus

**Current State:**
- Menu items have `accelerator` properties (Cmd+N, Cmd+O, etc.)
- Electron automatically binds accelerators to menu items
- Some shortcuts may only work when menu is focused
- Need to verify all shortcuts work globally within the app

**Why This Story:**
Electron's Menu API binds accelerators to menu items automatically. However, this story ensures:
1. All required shortcuts are properly configured
2. Shortcuts work even when menu bar is hidden or window is focused
3. No conflicts with browser/editor shortcuts (e.g., Cmd+A in formula bar)
4. Shortcuts follow macOS conventions (NFR-U2)

---

## Acceptance Criteria

**Given** the Electron app is running  
**When** I press keyboard shortcuts  
**Then** the following shortcuts work correctly:
- Cmd+N: New spreadsheet
- Cmd+O: Open file
- Cmd+S: Save file
- Cmd+Shift+S: Save As
- Cmd+W: Close window
- Cmd+Q: Quit app
- Cmd+X: Cut
- Cmd+C: Copy
- Cmd+V: Paste
- Cmd+A: Select All

**And** all shortcuts are bound via Electron Menu `accelerator` property  
**And** shortcuts follow macOS conventions  
**And** shortcuts work when window is focused (not just when menu is open)  
**And** shortcuts work even when menu bar is hidden

---

## Technical Requirements

### Electron Menu Accelerators

Accelerators are defined in the menu template. Electron automatically registers them:

```javascript
{
  label: 'New',
  accelerator: 'CmdOrCtrl+N',
  click: () => mainWindow.webContents.send('menu-new')
},
{
  label: 'Save As...',
  accelerator: 'CmdOrCtrl+Shift+S',
  click: () => mainWindow.webContents.send('menu-save-as')
}
```

### Accelerator Format

- `CmdOrCtrl` - Cmd on macOS, Ctrl on Windows/Linux
- `Shift`, `Alt`, `Option` - Modifier keys
- Key names: `N`, `O`, `S`, `W`, `Q`, `X`, `C`, `V`, `A`
- Multiple modifiers: `CmdOrCtrl+Shift+S`

### Shortcut Conflict Handling

**Potential conflicts:**
- **Cmd+A** in formula bar: User may want to select all text in formula bar, not Select All cells
- **Cmd+V** in formula bar: Paste should paste into formula bar when editing
- **Cmd+C** in formula bar: Copy formula bar content when editing

**Resolution:**
- When cell is in edit mode (formula bar focused), Cmd+A/C/V/X apply to formula bar text
- When cell is selected but not editing, Cmd+A/C/V/X apply to spreadsheet (Select All, Copy, Paste, Cut)
- Use `document.activeElement` check in renderer to determine context

### Global Shortcut Registration (Optional)

If menu accelerators don't work in all contexts, use `globalShortcut`:

```javascript
const { globalShortcut } = require('electron');

app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+N', () => {
    mainWindow.webContents.send('menu-new');
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

**Note:** Menu accelerators typically work for app window. Use globalShortcut only if needed for edge cases.

### File Structure

**Modified Files:**
- `electron/menu.js` or `electron/main.js` - Ensure all menu items have correct accelerators
- `frontend/app.js` - Handle shortcut context (edit mode vs selection mode) if needed

---

## Implementation Tasks

1. [ ] Verify all menu items have `accelerator` property
2. [ ] Add Cmd+Shift+S for Save As (ensure correct format)
3. [ ] Test each shortcut with window focused
4. [ ] Handle Cmd+A/C/V/X context: editing vs selection
5. [ ] Verify Cmd+W closes window (may need explicit handler)
6. [ ] Verify Cmd+Q quits app (Electron default)
7. [ ] Document any shortcut conflicts or limitations
8. [ ] Test with menu bar hidden (if applicable)

---

## Dev Notes

### Complete Accelerator List

| Action      | Accelerator       | Menu Item  |
|------------|-------------------|------------|
| New        | CmdOrCtrl+N       | File > New |
| Open       | CmdOrCtrl+O       | File > Open |
| Save       | CmdOrCtrl+S       | File > Save |
| Save As    | CmdOrCtrl+Shift+S | File > Save As |
| Close      | CmdOrCtrl+W       | File > Close |
| Quit       | CmdOrCtrl+Q       | File > Quit |
| Cut        | CmdOrCtrl+X       | Edit > Cut |
| Copy       | CmdOrCtrl+C       | Edit > Copy |
| Paste      | CmdOrCtrl+V       | Edit > Paste |
| Select All | CmdOrCtrl+A       | Edit > Select All |

### Cmd+W and Cmd+Q Behavior

- **Cmd+W:** Close current window. On macOS single-window app, this may quit. Configure in `app.on('window-all-closed')`.
- **Cmd+Q:** Quit app. Electron handles this when in application menu. Ensure File > Quit has accelerator.

### Context-Aware Shortcuts

In `frontend/app.js`, when handling menu-cut, menu-copy, etc.:

```javascript
function handleCopy() {
  // If user is editing formula bar, copy formula bar text instead
  const formulaBar = document.getElementById('formula-bar');
  if (document.activeElement === formulaBar) {
    formulaBar.select();
    document.execCommand('copy');
    return;
  }
  // Otherwise copy selected cell
  // ... cell copy logic
}
```

---

## Testing Strategy

### Manual Testing

1. **File shortcuts:** Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+W, Cmd+Q
2. **Edit shortcuts:** Cmd+X, Cmd+C, Cmd+V, Cmd+A
3. **Context:** Test Cmd+A when formula bar focused vs cell selected
4. **Window focus:** Ensure shortcuts work when grid has focus

### Automated Testing

```javascript
test('keyboard shortcuts trigger actions', async ({ electronApp }) => {
  const window = await electronApp.firstWindow();
  await window.click('body'); // Ensure focus
  await window.keyboard.press('Meta+n');
  // Verify new spreadsheet (e.g., check status or grid cleared)
  await window.keyboard.press('Meta+o');
  // Verify open dialog (may need to stub)
});
```

---

## References

- [Electron MenuItem accelerator](https://www.electronjs.org/docs/latest/api/menu-item#menuitemaccelerator)
- **[UX Design Specification](../planning-artifacts/ux-design-specification.md)** - Comprehensive UX patterns, keyboard shortcuts, macOS integration
- [Electron globalShortcut](https://www.electronjs.org/docs/latest/api/global-shortcut)
- [macOS Keyboard Shortcuts (HIG)](https://developer.apple.com/design/human-interface-guidelines/keyboard)
- Stories 7.1, 7.2: Menu implementation

---

## Change Log

- 2026-02-16: Story created with comprehensive context for Electron keyboard shortcuts

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16
