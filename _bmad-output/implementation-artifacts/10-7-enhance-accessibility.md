# Story 10.7: Enhance Accessibility

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.7  
**Estimated Effort:** 3-4 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As a user with accessibility needs,  
I want the application to support screen readers and keyboard navigation,  
So that I can use the spreadsheet effectively regardless of my abilities.

---

## Context

**Prerequisites:**
- Story 7.9 complete: UX design system implemented
- UX Design Specification defines comprehensive accessibility requirements

**Current State:**
- Basic keyboard navigation works (arrow keys, Tab, Enter)
- No ARIA labels or semantic HTML roles
- No screen reader support
- No high contrast mode support
- Focus indicators are minimal

**Why This Story:**
The UX Design Specification defines comprehensive accessibility requirements including ARIA labels, semantic HTML roles, screen reader support, and keyboard focus management. Currently, the application lacks these features, making it difficult or impossible for users with disabilities to use effectively. This story implements WCAG AA accessibility standards.

---

## Acceptance Criteria

**Given** the application is running  
**When** a screen reader user navigates the interface  
**Then** all interactive elements are announced correctly:
- Grid structure announced as "Spreadsheet, 1000 rows, 26 columns"
- Cell selection announced as "Cell B3 selected, value: 200"
- Formula cells announced with formula and computed value
- File status changes announced via `aria-live` region

**And** all interactive elements have proper ARIA labels:
- Buttons have descriptive labels ("Save File", not just icon)
- Inputs have associated labels
- Grid has `role="grid"` with proper row/column headers
- Dialogs have `role="dialog"` with proper focus management

**And** keyboard navigation works completely:
- Tab order is logical (toolbar → formula bar → grid)
- Focus indicators are visible (2px outline in primary color)
- Dialogs trap focus (Tab cycles within dialog, Escape closes)
- All actions accessible via keyboard

**And** the app respects accessibility preferences:
- `prefers-reduced-motion` disables animations
- `prefers-contrast` increases contrast
- System text size scaling is respected

---

## Technical Requirements

### Semantic HTML Structure

Update `frontend/app.js` to generate semantic HTML:

```javascript
// Current (non-semantic)
<div id="app">
  <div class="toolbar">...</div>
  <div class="formula-bar-container">...</div>
  <div class="spreadsheet-container">...</div>
</div>

// Updated (semantic)
<div id="app">
  <header role="banner" aria-label="Application toolbar">
    <nav class="toolbar">...</nav>
  </header>
  
  <div role="complementary" aria-label="Formula bar" class="formula-bar-container">
    <span id="cell-ref" aria-label="Selected cell">A1</span>
    <input id="formula-bar" aria-label="Formula input" />
    <div role="status" aria-live="polite" aria-label="File status">
      <span id="file-status"></span>
    </div>
  </div>
  
  <main role="main">
    <div role="grid" 
         aria-label="Spreadsheet" 
         aria-rowcount="1000" 
         aria-colcount="26"
         class="spreadsheet-container">
      <table class="spreadsheet">
        <thead>
          <tr role="row">
            <th role="columnheader" aria-colindex="1">A</th>
            <th role="columnheader" aria-colindex="2">B</th>
          </tr>
        </thead>
        <tbody>
          <tr role="row" aria-rowindex="1">
            <th role="rowheader" aria-rowindex="1">1</th>
            <td role="gridcell" aria-colindex="1" aria-rowindex="1">100</td>
            <td role="gridcell" aria-colindex="2" aria-rowindex="1">200</td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</div>
```

### ARIA Live Regions

Add status announcements for screen readers:

```javascript
// Create live region for announcements
const liveRegion = document.createElement('div');
liveRegion.setAttribute('role', 'status');
liveRegion.setAttribute('aria-live', 'polite');
liveRegion.setAttribute('aria-atomic', 'true');
liveRegion.style.position = 'absolute';
liveRegion.style.left = '-10000px';
liveRegion.style.width = '1px';
liveRegion.style.height = '1px';
liveRegion.style.overflow = 'hidden';
document.body.appendChild(liveRegion);

// Announce file status changes
function announceFileStatus(message) {
  liveRegion.textContent = message;
  // Clear after announcement
  setTimeout(() => { liveRegion.textContent = ''; }, 1000);
}

// Usage
announceFileStatus('File saved to Documents folder');
announceFileStatus('Unsaved changes');
```

### Cell Selection Announcements

```javascript
function selectCell(row, col) {
  // ... existing selection logic
  
  // Announce to screen reader
  const cell = cells[row][col];
  const cellRef = getCellRef(row, col);
  const value = cell.value || 'empty';
  const formula = cell.formula || '';
  
  let announcement = `Cell ${cellRef} selected`;
  if (formula) {
    announcement += `, formula: ${formula}, computed value: ${value}`;
  } else if (value !== 'empty') {
    announcement += `, value: ${value}`;
  }
  
  announceToScreenReader(announcement);
}
```

### Focus Management

**Dialog Focus Trap:**

```javascript
function showDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  dialog.style.display = 'flex';
  
  // Get all focusable elements
  const focusableElements = dialog.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // Focus first element
  firstElement.focus();
  
  // Trap focus within dialog
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    } else if (e.key === 'Escape') {
      closeDialog(dialogId);
    }
  });
}
```

### Focus Indicators

Update CSS for visible focus states:

```css
/* Keyboard focus indicators */
button:focus-visible,
input:focus-visible,
.cell:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Remove default browser outline */
*:focus {
  outline: none;
}

/* Only show custom outline on keyboard focus */
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### High Contrast Mode

```css
@media (prefers-contrast: high) {
  :root {
    --color-text-primary: #000000;
    --color-bg-primary: #FFFFFF;
    --color-border: #000000;
    --color-border-grid: #000000;
  }
  
  [data-theme="dark"] {
    --color-text-primary: #FFFFFF;
    --color-bg-primary: #000000;
    --color-border: #FFFFFF;
  }
  
  /* Thicker borders for visibility */
  .cell {
    border-width: 2px;
  }
  
  .cell.selected {
    border-width: 3px;
  }
}
```

---

## Testing Strategy

### Manual Testing

1. **Screen Reader Testing (VoiceOver on macOS):**
   - Enable VoiceOver (Cmd+F5)
   - Navigate through toolbar buttons
   - Navigate through grid cells
   - Verify cell values and formulas are announced
   - Test file status announcements
   - Test dialog announcements

2. **Keyboard Navigation:**
   - Use only keyboard (no mouse)
   - Navigate all UI elements with Tab
   - Verify focus indicators are visible
   - Test dialog focus trap (Tab cycles within dialog)
   - Test Escape to close dialogs

3. **Reduced Motion:**
   - Enable "Reduce motion" in macOS Accessibility settings
   - Verify animations are disabled or minimal
   - Test all transitions and state changes

4. **High Contrast:**
   - Enable "Increase contrast" in macOS Accessibility settings
   - Verify all text is readable
   - Verify borders are visible
   - Verify focus indicators are prominent

5. **Text Scaling:**
   - Increase text size in macOS Accessibility settings
   - Verify text scales proportionally
   - Verify layout doesn't break
   - Verify grid rows adjust to accommodate larger text

### Automated Testing

Add Playwright tests:

```javascript
test('Grid has proper ARIA attributes', async ({ window }) => {
  const gridAttrs = await window.locator('.spreadsheet-container').evaluate(el => ({
    role: el.getAttribute('role'),
    label: el.getAttribute('aria-label'),
    rowcount: el.getAttribute('aria-rowcount'),
    colcount: el.getAttribute('aria-colcount')
  }));
  
  expect(gridAttrs.role).toBe('grid');
  expect(gridAttrs.label).toBe('Spreadsheet');
  expect(gridAttrs.rowcount).toBeTruthy();
  expect(gridAttrs.colcount).toBeTruthy();
});

test('File status has aria-live region', async ({ window }) => {
  const statusAttrs = await window.locator('#file-status').evaluate(el => {
    const parent = el.closest('[role="status"]');
    return {
      hasLiveRegion: !!parent,
      ariaLive: parent?.getAttribute('aria-live')
    };
  });
  
  expect(statusAttrs.hasLiveRegion).toBe(true);
  expect(statusAttrs.ariaLive).toBe('polite');
});

test('Buttons have descriptive labels', async ({ window }) => {
  const buttons = await window.locator('button').evaluateAll(buttons => {
    return buttons.map(btn => ({
      text: btn.textContent || btn.getAttribute('aria-label'),
      hasLabel: !!(btn.textContent || btn.getAttribute('aria-label'))
    }));
  });
  
  buttons.forEach(btn => {
    expect(btn.hasLabel).toBe(true);
    expect(btn.text.length).toBeGreaterThan(0);
  });
});

test('Dialog traps focus', async ({ window, electronApp }) => {
  // Open a dialog
  await window.locator('#new-btn').click();
  
  // Make changes to trigger unsaved warning
  await window.locator('#cell-0-0').click();
  await window.keyboard.type('test');
  await window.keyboard.press('Enter');
  
  // Trigger dialog
  await window.locator('#new-btn').click();
  await window.waitForSelector('#modal-overlay.active');
  
  // Get focusable elements
  const focusableCount = await window.locator('#modal-overlay button').count();
  expect(focusableCount).toBeGreaterThan(0);
  
  // Test Tab cycling
  for (let i = 0; i < focusableCount + 1; i++) {
    await window.keyboard.press('Tab');
  }
  
  // Focus should still be within dialog
  const focusedElement = await window.evaluate(() => {
    return document.activeElement?.closest('#modal-overlay') !== null;
  });
  expect(focusedElement).toBe(true);
  
  // Test Escape closes dialog
  await window.keyboard.press('Escape');
  await window.waitForSelector('#modal-overlay:not(.active)');
});
```

---

## References

- **[UX Design Specification](../planning-artifacts/ux-design-specification.md)** - Complete accessibility requirements and ARIA specifications
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [macOS Accessibility Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Electron Accessibility Documentation](https://www.electronjs.org/docs/latest/tutorial/accessibility)
- [VoiceOver Testing Guide](https://developer.apple.com/library/archive/technotes/TestingAccessibilityOfiOSApps/TestAccessibilityonYourDevicewithVoiceOver/TestAccessibilityonYourDevicewithVoiceOver.html)

### Architecture Compliance
- **Frontend**: frontend/app.js (HTML generation, event handlers), frontend/spreadsheet.css, frontend/style.css
- **Modal**: #modal-overlay — add focus trap, aria attributes
- **Grid**: .spreadsheet-container, #spreadsheet — add role="grid", aria-rowcount, aria-colcount
- **Playwright**: playwright_tests/ — add ARIA assertion tests

---

## Change Log

- 2026-02-16: Story created to implement accessibility enhancements per UX design specification

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16

Ultimate context engine analysis completed - comprehensive developer guide created.
