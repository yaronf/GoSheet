# Story 7.3: Implement Help Menu

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.3  
**Estimated Effort:** 2 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As a user,  
I want a Help menu with app information,  
So that I can learn about the application.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron app with IPC handlers
- Story 7.1 complete: File menu (menu infrastructure exists)
- Story 7.2 complete: Edit menu (optional, for menu pattern consistency)

**Current State:**
- File and Edit menus exist
- No Help menu or About dialog
- App version available in `package.json` (1.0.0)

**Why This Story:**
macOS apps traditionally include a Help menu with an About dialog. This provides users with app identity, version, and copyright information. Electron provides `app.getName()` and `app.getVersion()` for this purpose.

---

## Acceptance Criteria

**Given** the Electron app is running  
**When** I view the menu bar  
**Then** a Help menu is visible with the following items:
- About GoSheet

**When** I click About GoSheet  
**Then** an About dialog appears showing:
- App name: "GoSheet"
- Version number (from package.json/build)
- Copyright information
- Brief description: "Lightweight, fast spreadsheet for macOS"

**And** the dialog follows macOS Human Interface Guidelines  
**And** on macOS, the Help menu appears in the standard position (right side of menu bar or under app menu)

---

## Technical Requirements

### Electron Menu API

Add Help menu to the application menu template:

```javascript
const { app, shell } = require('electron');

const helpMenu = {
  label: 'Help',
  role: 'help', // macOS places Help in standard location
  submenu: [
    {
      label: 'About GoSheet',
      click: () => {
        // Show About dialog - see implementation options below
        showAboutDialog();
      }
    }
  ]
};
```

### About Dialog Implementation

**Option 1: Native dialog (Electron dialog module)**
```javascript
const { dialog } = require('electron');
dialog.showMessageBox(mainWindow, {
  type: 'info',
  title: 'About GoSheet',
  message: 'GoSheet',
  detail: `Version ${app.getVersion()}\n\nLightweight, fast spreadsheet for macOS\n\n© ${new Date().getFullYear()} All rights reserved.`
});
```

**Option 2: Custom HTML dialog (more polished)**
- Create `frontend/about.html` or inline modal in app
- Use `BrowserWindow` with `modal: true` and `parent: mainWindow`
- Or use in-app modal (like existing confirm dialog in app.js)
- Display app icon, name, version, description, copyright

**Option 3: Electron's built-in About panel (macOS)**
```javascript
const { app } = require('electron');
app.setAboutPanelOptions({
  applicationName: 'GoSheet',
  applicationVersion: app.getVersion(),
  copyright: `© ${new Date().getFullYear()}`,
  credits: 'Lightweight, fast spreadsheet for macOS'
});
// Then in menu click:
app.showAboutPanel();
```

**Recommended:** Use `app.setAboutPanelOptions()` and `app.showAboutPanel()` - this uses the native macOS About panel, which automatically follows HIG.

### Integration Points

**package.json:** Version is in `"version": "1.0.0"` - Electron's `app.getVersion()` reads this.

**File Structure:**
- `electron/main.js` or `electron/menu.js` - Add Help menu, call `app.setAboutPanelOptions()` on app ready
- Menu template includes Help with About GoSheet item

---

## Implementation Tasks

1. [ ] Call `app.setAboutPanelOptions()` in main process (app.whenReady)
2. [ ] Add Help menu template with About GoSheet item
3. [ ] Implement menu click to call `app.showAboutPanel()`
4. [ ] Verify version displays correctly from package.json
5. [ ] Test on macOS - verify native About panel appears
6. [ ] Verify Help menu position (role: 'help' for macOS)
7. [ ] Add optional "Report Issue" or "Documentation" link if desired (use shell.openExternal)

---

## Dev Notes

### macOS About Panel

The native About panel is the preferred approach on macOS:
```javascript
app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'GoSheet',
    applicationVersion: app.getVersion(),
    copyright: `© ${new Date().getFullYear()}`,
    credits: 'Lightweight, fast spreadsheet for macOS'
  });
});
```

### Help Menu Role

Using `role: 'help'` ensures macOS places the Help menu in the standard location (often under the app name in the menu bar on macOS).

### Optional: Add More Help Items

Consider adding (future):
- "GoSheet Documentation" - opens docs URL via `shell.openExternal()`
- "Report an Issue" - opens GitHub issues
- "Keyboard Shortcuts" - opens help page

For MVP, About GoSheet is sufficient per FR41.

---

## Testing Strategy

### Manual Testing

1. **Help Menu:** Verify Help menu appears in menu bar
2. **About Dialog:** Click About GoSheet, verify dialog shows
3. **Content:** Verify app name, version, copyright, description
4. **macOS:** Verify native About panel appearance (not custom dialog)

### Automated Testing

```javascript
test('Help menu shows About', async ({ electronApp }) => {
  const result = await electronApp.evaluate(async ({ app, Menu }) => {
    const menu = Menu.getApplicationMenu();
    const helpMenu = menu.items.find(i => i.label === 'Help');
    const aboutItem = helpMenu?.submenu?.items.find(i => i.label === 'About GoSheet');
    return {
      hasHelpMenu: !!helpMenu,
      hasAboutItem: !!aboutItem,
      version: app.getVersion()
    };
  });
  expect(result.hasHelpMenu).toBe(true);
  expect(result.hasAboutItem).toBe(true);
  expect(result.version).toBeTruthy();
});
```

---

## References

- [Electron app.setAboutPanelOptions](https://www.electronjs.org/docs/latest/api/app#appsetaboutpaneloptionsoptions)
- [Electron app.showAboutPanel](https://www.electronjs.org/docs/latest/api/app#appshowaboutpanel)
- [macOS Human Interface Guidelines - About](https://developer.apple.com/design/human-interface-guidelines/windows-and-views/about-window)
- Story 7.1: Menu implementation pattern

---

## Change Log

- 2026-02-16: Story created with comprehensive context for Electron Help menu implementation

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16
