# Story 8.1: Design Welcome Screen Layout

**Epic:** 8 - Welcome Screen & Lifecycle  
**Story:** 8.1  
**Estimated Effort:** 2-3 hours  
**Status:** done  
**Created:** 2026-02-18

---

## Story

As a user,
I want a clean welcome screen when I launch the app,
So that I can quickly choose what to do next.

---

## Context

**Prerequisites:**
- Epic 7 complete (menus, keyboard shortcuts, recent files, dark mode, quit warning)
- Story 7.5: Recent files list is implemented and persisted
- Story 7.9: UX design system (Pico.css, CSS variables) is in place

**Current State:**
- App loads directly to spreadsheet view (toolbar + formula bar + grid)
- No welcome screen exists; users see empty grid immediately
- Recent files appear in File → Open Recent menu only

**Desired State:**
- Welcome screen as initial view when app launches (or when no file is open)
- Layout designed with specified elements; implementation in Story 8.2

**Why This Story:**
FR48 requires welcome screen on first launch. This story defines the layout and structure. Story 8.2 will implement the display logic (when to show, navigation to spreadsheet).

---

## Acceptance Criteria

1. **Layout Elements (FR48)**
   - [ ] App title: "GoSheet"
   - [ ] Subtitle: "Lightweight, fast spreadsheet for macOS"
   - [ ] Three large buttons:
     - "Create New Spreadsheet" (primary action)
     - "Open Existing File"
     - "Import from CSV"
   - [ ] Recent Files section (list of up to 5 recent files) (FR49)
   - [ ] Quick tip: "Tip: Use Cmd+N for new spreadsheet"

2. **Design Quality**
   - [ ] Layout is clean and minimal
   - [ ] Design follows macOS HIG (NFR-U1)
   - [ ] Layout is responsive to window resizing

3. **Visual Consistency**
   - [ ] Uses existing design tokens (CSS variables from Story 7.9)
   - [ ] Works in light and dark mode (data-theme attribute)
   - [ ] Matches toolbar/formula bar styling (Pico.css foundation)

---

## Tasks / Subtasks

- [ ] Task 1: Create welcome screen HTML structure (AC: #1)
  - [ ] Add welcome-screen container to frontend (new section or conditional in app.js)
  - [ ] Structure: app title (H1), subtitle (p), three buttons, recent files section, tip
  - [ ] Use semantic HTML (section, h1, button, ul/ol for recent files)
- [ ] Task 2: Style welcome screen (AC: #2, #3)
  - [ ] Add CSS for welcome screen layout (spreadsheet.css or new welcome.css)
  - [ ] Use --color-primary, --color-bg-primary, --color-text-primary from design system
  - [ ] Primary button: larger, prominent; secondary buttons: standard
  - [ ] Vertical centering or top-aligned layout; adequate spacing (space-8, space-12)
- [ ] Task 3: Implement responsive layout (AC: #2)
  - [ ] Flexbox or grid for centering
  - [ ] Min-width/max-width for readability
  - [ ] Test at 800x600 and 1200x800 (Electron window sizes)
- [ ] Task 4: Recent Files section placeholder (AC: #1)
  - [ ] "No recent files" state (Story 8.2 will populate from API)
  - [ ] Structure for up to 5 file entries (filename + parent dir)
- [ ] Task 5: Document layout decisions (AC: #2)
  - [ ] Add brief dev notes on layout rationale
  - [ ] Reference UX spec sections if applicable

---

## Technical Requirements

### Architecture Compliance

- **Frontend location:** `frontend/` - welcome screen is HTML/CSS in the same frontend as spreadsheet
- **No backend changes** - this story is layout/design only; Story 8.2 adds logic
- **Electron:** No main process changes; window loads same URL; routing happens in renderer

### Reuse Existing Patterns

- **Styling:** Use Pico.css (already loaded), spreadsheet.css patterns, CSS variables from Story 7.9
- **Buttons:** Match toolbar-btn styling or use Pico button classes; primary = modal-btn-primary style
- **Dark mode:** Ensure all elements use CSS variables (--color-*) so data-theme="dark" works
- **Recent files data:** Story 7.5 stores recent files; structure the list for future `getRecentFiles()` or menu data

### File Structure

```
frontend/
  index.html          # Unchanged - app div loads content
  app.js              # Add welcome screen HTML; conditional render (or always render, hide spreadsheet)
  spreadsheet.css     # Add .welcome-screen, .welcome-actions, .welcome-recent-files
  style.css           # Global overrides (if needed)
```

### Layout Specification (from UX spec)

- **Spacing:** space-7 (48px) between major sections; space-4 (16px) between buttons
- **Typography:** H1 for app title (existing heading scale); subtitle smaller, muted
- **Buttons:** Large, tappable (min 44px height per HIG); primary button stands out
- **Recent files:** List style; each item shows filename; optional: parent directory
- **Tip:** Small, muted text at bottom

### Do NOT Implement (Story 8.2)

- When to show welcome vs spreadsheet (launch logic)
- Button click handlers (Create New, Open, Import)
- Loading recent files from storage
- Navigation from welcome to spreadsheet

---

## Dev Notes

### Project Structure Notes

- App currently injects spreadsheet HTML into `#app` in app.js (line ~145)
- Welcome screen can be a separate block injected when appropriate, OR a wrapper that shows welcome OR spreadsheet
- For this story (design only): Create the welcome HTML/CSS; can be shown by default with spreadsheet hidden, or as a separate "view" that Story 8.2 will switch to/from

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8] - Story 8.1 acceptance criteria
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] - Welcome screen, spacing (space-7), typography
- [Source: _bmad-output/planning-artifacts/prd.md] - FR48, FR49
- [Source: frontend/spreadsheet.css] - Existing design tokens, toolbar styles
- [Source: frontend/app.js] - Current #app innerHTML structure

### Testing

- Manual: Launch app, verify welcome screen layout renders (Story 8.2 will control when)
- Or: Temporarily show welcome instead of spreadsheet to verify layout
- Visual: Check light/dark mode, window resize

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled by dev agent)
