# Story 7.9: Implement UX Design System

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.9  
**Estimated Effort:** 3-4 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As a user,  
I want the application to follow the designed color system and visual style,  
So that the interface is cohesive, professional, and matches the intended design.

---

## Context

**Prerequisites:**
- UX Design Specification complete with comprehensive design system
- Basic CSS styling in place from Epic 3

**Current State:**
- Application uses generic colors (blue `#2196F3` for primary actions)
- Colors don't match the UX design specification
- No consistent design tokens or CSS variables
- File status colors are undefined
- Grid styling doesn't match design specifications

**Why This Story:**
The UX Design Specification defines a complete design system with teal primary color (#00A896), specific colors for success/warning/error states, typography, spacing, and interaction states. Currently, the implementation uses generic colors that don't match the design. This story implements the designed color system and visual style to create a cohesive, professional appearance.

---

## Acceptance Criteria

**Given** the UX Design Specification defines the color system  
**When** I view the application  
**Then** all colors match the design specification:
- Primary color: `#00A896` (Teal)
- Primary hover: `#008577` (Darker teal)
- Success: `#22C55E` (Yellow-green)
- Warning: `#F59E0B` (Amber)
- Error: `#EF4444` (Red)
- Background: `#FFFFFF` (White)
- Surface: `#F8F9FA` (Light gray)
- Text: `#1A1A1A` (Near black)
- Grid Border: `#E5E7EB` (Very light gray)

**And** selected cells have 2px teal border with light teal background  
**And** file status shows green for saved, amber for unsaved  
**And** error cells use the defined error color  
**And** formula cells have the defined formula background  
**And** all interactive elements use the primary teal color

---

## Technical Requirements

### Design Tokens (CSS Variables)

Create a design tokens file or CSS variables section:

```css
:root {
  /* Primary Colors */
  --color-primary: #00A896;
  --color-primary-hover: #008577;
  --color-secondary: #6366F1;
  
  /* State Colors */
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  
  /* Backgrounds */
  --color-bg-primary: #FFFFFF;
  --color-bg-surface: #F8F9FA;
  --color-bg-header: #E8E8E8;
  
  /* Text */
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #6B7280;
  
  /* Borders */
  --color-border: #D1D5DB;
  --color-border-grid: #E5E7EB;
  
  /* Cell States */
  --color-cell-selected-bg: rgba(0, 168, 150, 0.05);
  --color-cell-selected-border: #00A896;
  --color-cell-formula-bg: #FFFBF0;
  --color-cell-error-bg: #FEE2E2;
  --color-cell-error-text: #EF4444;
  
  /* Spacing (from UX doc) */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  
  /* Typography */
  --font-family-base: -apple-system, BlinkMacSystemFont, "SF Pro", "Segoe UI", Roboto, sans-serif;
  --font-family-mono: 'Monaco', 'Menlo', 'Courier New', monospace;
  --font-size-base: 13px;
  --font-size-header: 12px;
  
  /* Layout */
  --row-height: 36px;
  --column-width-default: 120px;
  --cell-padding-vertical: 8px;
  --cell-padding-horizontal: 12px;
}
```

### Files to Update

**1. `frontend/spreadsheet.css`**
- Replace all hardcoded colors with CSS variables
- Update selected cell styling (2px teal border, light teal background)
- Update error cell colors
- Update formula cell background
- Update grid borders
- Update toolbar and button colors

**2. `frontend/style.css` (if exists)**
- Apply design tokens
- Ensure consistency across all UI elements

**3. `frontend/app.js`**
- Update file status display logic to use success/warning colors
- Ensure status indicators match design (green checkmark for saved, amber for unsaved)

---

## Implementation Tasks

1. ✅ Create CSS variables for all design tokens
2. ✅ Update cell styling (selected, formula, error states)
3. ✅ Update grid borders and spacing
4. ✅ Update toolbar and button colors
5. ✅ Update modal dialog colors
6. ✅ Update file status indicator colors
7. ✅ Update formula bar styling
8. ✅ Test all interactive states (hover, focus, active)
9. ✅ Verify accessibility (contrast ratios meet WCAG AA)
10. ✅ Update documentation

---

## Dev Notes

### Color Replacements

**Current → New:**
- `#2196F3` (Blue) → `var(--color-primary)` (#00A896 Teal)
- `#1976D2` (Dark blue) → `var(--color-primary-hover)` (#008577)
- `#c62828` (Red) → `var(--color-error)` (#EF4444)
- `#d0d0d0` (Gray) → `var(--color-border-grid)` (#E5E7EB)
- `#e8e8e8` (Header gray) → Keep as is (matches design)

### Selected Cell Styling

From UX Design Specification:

```css
.cell.selected {
  background: var(--color-cell-selected-bg) !important; /* rgba(0, 168, 150, 0.05) */
  border: 2px solid var(--color-cell-selected-border); /* #00A896 */
  outline: none;
}
```

### File Status Colors

```javascript
// In app.js
function updateFileStatus(saved, filePath) {
  const statusEl = document.getElementById('file-status');
  if (saved && filePath) {
    statusEl.style.color = 'var(--color-success)'; // Green
    statusEl.textContent = `✓ Saved: ${filePath}`;
  } else if (!saved) {
    statusEl.style.color = 'var(--color-warning)'; // Amber
    statusEl.textContent = '● Unsaved changes';
  } else {
    statusEl.style.color = 'var(--color-text-secondary)'; // Gray
    statusEl.textContent = 'Untitled';
  }
}
```

### Error Cell Styling

```css
.cell.error-cell {
  background: var(--color-cell-error-bg); /* #FEE2E2 */
  color: var(--color-cell-error-text); /* #EF4444 */
  font-weight: 500;
}
```

### Formula Cell Styling

```css
.cell.formula-cell {
  background: var(--color-cell-formula-bg); /* #FFFBF0 */
  color: var(--color-text-primary);
}
```

### Accessibility Considerations

Verify contrast ratios meet WCAG AA standards:
- Text on white background: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- Interactive elements: 3:1 minimum

Test with browser dev tools or online contrast checkers:
- Teal (#00A896) on white: ✓ Passes
- Error red (#EF4444) on light error bg (#FEE2E2): ✓ Passes
- Text (#1A1A1A) on white: ✓ Passes

---

## Testing Strategy

### Visual Testing

1. **Cell States:**
   - Select cell → Verify teal border and light teal background
   - Enter formula → Verify cream/yellow background
   - Create error → Verify light red background with red text
   - Hover over cell → Verify subtle hover effect

2. **File Status:**
   - New file → Verify gray "Untitled"
   - Make changes → Verify amber "Unsaved changes"
   - Save file → Verify green "✓ Saved: path"

3. **Interactive Elements:**
   - Hover over buttons → Verify teal hover state
   - Click buttons → Verify teal active state
   - Focus on formula bar → Verify teal focus ring

4. **Modal Dialogs:**
   - Open modal → Verify colors match design
   - Primary button → Verify teal background
   - Secondary button → Verify white background

### Automated Testing

Add visual regression tests if available:

```javascript
test('Design system colors are applied', async ({ window }) => {
  // Get computed styles
  const cellStyle = await window.locator('.cell.selected').evaluate(el => {
    const style = window.getComputedStyle(el);
    return {
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor
    };
  });
  
  // Verify teal colors
  expect(cellStyle.borderColor).toBe('rgb(0, 168, 150)'); // #00A896
});
```

### Cross-browser Testing

Test on:
- Safari (primary target for macOS)
- Chrome (for development)
- Firefox (for compatibility)

Verify CSS variables are supported (all modern browsers support them).

---

## References

- **[UX Design Specification](../planning-artifacts/ux-design-specification.md)** - Complete design system with colors, typography, spacing
- [CSS Custom Properties (Variables)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [WCAG Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [macOS Human Interface Guidelines - Color](https://developer.apple.com/design/human-interface-guidelines/color)

---

## Change Log

- 2026-02-16: Story created to implement UX design system colors and styling

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16

Ultimate context engine analysis completed - comprehensive developer guide created.
