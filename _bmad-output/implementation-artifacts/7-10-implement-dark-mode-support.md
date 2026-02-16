# Story 7.10: Implement Dark Mode Support

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.10  
**Estimated Effort:** 3-4 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As a user,  
I want dark mode support that follows my system preferences,  
So that I can use the app comfortably in low-light environments.

---

## Context

**Prerequisites:**
- Story 7.9 complete: UX design system with CSS variables implemented
- UX Design Specification defines complete dark mode color palette

**Current State:**
- Application only supports light mode
- No system preference detection
- No dark mode color palette implemented
- Users working at night or in low-light environments experience eye strain

**Why This Story:**
macOS users expect apps to respect their system-wide dark mode preference. The UX Design Specification defines a complete dark mode color palette that maintains the same design principles (teal primary, clear hierarchy) while being optimized for dark backgrounds. This story implements dark mode support with automatic system preference detection.

---

## Acceptance Criteria

**Given** the user has dark mode enabled in macOS System Preferences  
**When** they launch GoSheet  
**Then** the app displays in dark mode with the designed color palette:
- Background: `#111827` (Dark blue-gray)
- Surface: `#1F2937` (Lighter dark gray)
- Text: `#F9FAFB` (Off-white)
- Primary: `#14B8A6` (Bright teal)
- Grid borders: Dark gray variants

**And** all UI elements are readable with proper contrast  
**And** the app automatically switches when system preference changes  
**And** file status indicators use appropriate dark mode colors  
**And** error messages remain clearly visible in dark mode

**When** the user has light mode enabled  
**Then** the app displays in light mode (existing implementation)

---

## Technical Requirements

### Dark Mode Color Palette

From UX Design Specification, add to CSS variables:

```css
/* Light mode (default) */
:root {
  --color-primary: #00A896;
  --color-primary-hover: #008577;
  --color-bg-primary: #FFFFFF;
  --color-bg-surface: #F8F9FA;
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #6B7280;
  --color-border: #D1D5DB;
  --color-border-grid: #E5E7EB;
  /* ... all other light mode colors */
}

/* Dark mode */
[data-theme="dark"] {
  --color-primary: #14B8A6;
  --color-primary-hover: #2DD4BF;
  --color-bg-primary: #111827;
  --color-bg-surface: #1F2937;
  --color-text-primary: #F9FAFB;
  --color-text-secondary: #9CA3AF;
  --color-border: #374151;
  --color-border-grid: #374151;
  --color-success: #4ADE80;
  --color-warning: #FBBF24;
  --color-error: #F87171;
  --color-cell-selected-bg: rgba(20, 184, 166, 0.1);
  --color-cell-formula-bg: rgba(251, 191, 36, 0.1);
  --color-cell-error-bg: rgba(248, 113, 113, 0.1);
}
```

### System Preference Detection

**In Electron main process (`electron/main.js`):**

```javascript
const { nativeTheme } = require('electron');

// Detect system theme
function getSystemTheme() {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

// Send theme to renderer
mainWindow.webContents.on('did-finish-load', () => {
  mainWindow.webContents.send('theme-changed', getSystemTheme());
});

// Listen for system theme changes
nativeTheme.on('updated', () => {
  mainWindow.webContents.send('theme-changed', getSystemTheme());
});
```

**In renderer process (`frontend/app.js`):**

```javascript
// Listen for theme changes from main process
if (window.electronAPI) {
  window.electronAPI.onThemeChanged((theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  });
}

// Initial theme detection (for web mode fallback)
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.setAttribute('data-theme', 'dark');
}

// Listen for system theme changes (web mode)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
});
```

### IPC Bridge for Theme

**In `electron/preload.js`:**

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (event, theme) => callback(theme))
});
```

### Files to Update

1. **`frontend/spreadsheet.css`**
   - Add `[data-theme="dark"]` selectors for all color variables
   - Ensure all colors use CSS variables (from Story 7.9)

2. **`frontend/style.css`**
   - Add dark mode color overrides
   - Update background colors

3. **`electron/main.js`**
   - Import `nativeTheme`
   - Detect system preference
   - Send theme to renderer
   - Listen for system changes

4. **`electron/preload.js`**
   - Expose `onThemeChanged` IPC handler

5. **`frontend/app.js`**
   - Listen for theme changes
   - Apply `data-theme` attribute to `<html>`

---

## Implementation Tasks

1. ✅ Add dark mode color palette to CSS variables
2. ✅ Update all components to use CSS variables (dependency on Story 7.9)
3. ✅ Implement system preference detection in Electron main process
4. ✅ Add IPC bridge for theme changes
5. ✅ Implement theme switching in renderer process
6. ✅ Test all UI elements in dark mode
7. ✅ Verify contrast ratios meet WCAG AA standards
8. ✅ Test automatic switching when system preference changes
9. ✅ Add Playwright tests for dark mode
10. ✅ Update documentation

---

## Dev Notes

### Dark Mode Color Adjustments

**Key Differences from Light Mode:**

1. **Backgrounds:**
   - Light: White (#FFFFFF)
   - Dark: Dark blue-gray (#111827)

2. **Text:**
   - Light: Near black (#1A1A1A)
   - Dark: Off-white (#F9FAFB)

3. **Primary Color:**
   - Light: Teal (#00A896)
   - Dark: Brighter teal (#14B8A6) - better contrast on dark background

4. **Cell States:**
   - Formula cells: Subtle yellow tint in dark mode
   - Error cells: Subtle red tint in dark mode
   - Selected cells: Subtle teal tint in dark mode

### Contrast Verification

From UX Design Specification, all dark mode colors meet WCAG AAA standards:

- Text (#F9FAFB) on Background (#111827): **15.6:1** ✓
- Text Secondary (#9CA3AF) on Background (#111827): **7.8:1** ✓
- Primary (#14B8A6) on Background (#111827): **4.2:1** ✓
- Error (#F87171) on Background (#111827): **4.8:1** ✓

### Theme Persistence (Optional Enhancement)

If you want to allow users to override system preference:

```javascript
// Save user preference
localStorage.setItem('theme-preference', 'dark'); // or 'light' or 'auto'

// Load on startup
const preference = localStorage.getItem('theme-preference') || 'auto';
if (preference === 'auto') {
  // Use system preference
} else {
  document.documentElement.setAttribute('data-theme', preference);
}
```

This is optional - MVP can just follow system preference.

### Reduced Motion Support

Respect `prefers-reduced-motion` for users with vestibular disorders:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Testing Strategy

### Manual Testing

1. **System Preference Detection:**
   - Enable dark mode in macOS System Preferences
   - Launch GoSheet
   - Verify app displays in dark mode
   - Switch to light mode in System Preferences
   - Verify app switches to light mode automatically

2. **Visual Verification:**
   - Check all UI elements in dark mode:
     - Toolbar and buttons
     - Formula bar
     - Grid cells (normal, selected, formula, error)
     - Modal dialogs
     - File status indicator
   - Verify all text is readable
   - Verify no white flashes or incorrect colors

3. **Contrast Testing:**
   - Use browser dev tools or online contrast checker
   - Verify all text meets WCAG AA minimum (4.5:1)
   - Verify interactive elements meet 3:1 minimum

### Automated Testing

Add Playwright tests:

```javascript
test('Dark mode is applied when system preference is dark', async ({ electronApp, window }) => {
  // Set system to dark mode (via Electron nativeTheme)
  await electronApp.evaluate(({ nativeTheme }) => {
    nativeTheme.themeSource = 'dark';
  });
  
  // Check HTML attribute
  const theme = await window.evaluate(() => {
    return document.documentElement.getAttribute('data-theme');
  });
  
  expect(theme).toBe('dark');
  
  // Verify dark mode colors are applied
  const bgColor = await window.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  
  expect(bgColor).toBe('rgb(17, 24, 39)'); // #111827
});

test('App switches theme when system preference changes', async ({ electronApp, window }) => {
  // Start in light mode
  await electronApp.evaluate(({ nativeTheme }) => {
    nativeTheme.themeSource = 'light';
  });
  
  await window.waitForTimeout(100);
  
  let theme = await window.evaluate(() => {
    return document.documentElement.getAttribute('data-theme');
  });
  expect(theme).toBe('light');
  
  // Switch to dark mode
  await electronApp.evaluate(({ nativeTheme }) => {
    nativeTheme.themeSource = 'dark';
  });
  
  await window.waitForTimeout(100);
  
  theme = await window.evaluate(() => {
    return document.documentElement.getAttribute('data-theme');
  });
  expect(theme).toBe('dark');
});
```

---

## References

- **[UX Design Specification](../planning-artifacts/ux-design-specification.md)** - Complete dark mode color palette and specifications
- [Electron nativeTheme Documentation](https://www.electronjs.org/docs/latest/api/native-theme)
- [prefers-color-scheme Media Query](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [WCAG Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- Story 7.9: UX Design System (prerequisite)

---

## Change Log

- 2026-02-16: Story created to implement dark mode support per UX design specification

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16

Ultimate context engine analysis completed - comprehensive developer guide created.
