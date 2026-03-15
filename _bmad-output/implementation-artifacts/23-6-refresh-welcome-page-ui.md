# Story 23.6: Refresh Welcome Page UI

Status: done

## Story

As a user,
I want a refreshed, polished welcome page when I launch GoSheet,
so that the app feels modern and inviting.

## Acceptance Criteria

1. **Given** the user launches the app (or returns to welcome)
   **When** the welcome screen is shown
   **Then** the layout, typography, and spacing feel updated and cohesive

2. **Given** the welcome screen is visible
   **When** the user views the Recent Files section
   **Then** the list is clearly readable and visually distinct from actions

3. **Given** the welcome screen
   **When** the user hovers or focuses interactive elements
   **Then** feedback is clear (e.g. hover states, focus indicators)

4. **Given** the welcome screen
   **When** dark mode is active
   **Then** colors and contrast remain readable and consistent

## Tasks / Subtasks

- [x] Task 1: Audit current welcome screen (AC: 1)
  - [x] Review `frontend/index.html` welcome-screen markup
  - [x] Review `frontend/style.css` and `frontend/spreadsheet.css` for welcome styles
  - [x] Document current layout, typography, spacing

- [x] Task 2: Refresh layout and typography (AC: 1, 2)
  - [x] Update welcome title/subtitle styling
  - [x] Improve spacing between sections (actions, recent files, tip)
  - [x] Ensure Recent Files section has clear visual hierarchy

- [x] Task 3: Add hover and focus states (AC: 3)
  - [x] Style `.welcome-btn` hover/focus
  - [x] Style `.welcome-recent-item` hover/focus
  - [x] Ensure focus indicators meet accessibility expectations

- [x] Task 4: Dark mode support (AC: 4)
  - [x] Verify welcome screen uses CSS variables for colors
  - [x] Test in dark theme; adjust if needed

- [x] Task 5: Manual verification
  - [x] Launch app, verify welcome screen looks refreshed
  - [x] Test with 0, 1, and 5 recent files
  - [x] Toggle dark mode and verify

## Dev Notes

### Key Files

- **`frontend/index.html`** — welcome-screen section, welcome-recent-list
- **`frontend/style.css`** — global styles, CSS variables
- **`frontend/spreadsheet.css`** — welcome styles, background image
- **`frontend/assets/welcome-bg.png`** — light background image (grid/data motif)

### Current Behavior

- Welcome screen uses Pico.css base + custom styles
- Recent files list: `populateWelcomeRecentFiles` in `app-ui.js`
- Dark mode: `theme-changed` IPC, CSS variables

### Architecture Compliance

- Frontend-only. No Go API or Electron changes.

### Design Decisions (2026-03-15)

- **Title font:** Plus Jakarta Sans — modern, polished, professional (chosen from 5 options in `welcome-font-options.html`).
- **Color accent:** "Go" in the title uses primary teal (`--color-primary: #00A896`) with font-weight 700; "Sheet" remains text-primary. Aligns with UX design system.
- **Background:** Light image (`frontend/assets/welcome-bg.png`) with subtle grid/data motif. Disabled in dark mode (`[data-theme='dark']`).
- **Animation:** Staggered entrance (title → subtitle → actions → recent files → tip), 300ms ease-out, subtle translateY. Per UX spec: respects `prefers-reduced-motion: reduce` (animations disabled when set).

### References

- [Source: sprint-change-proposal-2026-03-15-epic23.md] Epic 23 scope
- [Source: ux-design-specification.md] Animation guidelines (200ms, prefers-reduced-motion)
- [Source: 7-9-implement-ux-design-system.md] Design tokens, primary teal
- [Source: frontend/index.html] welcome-screen markup
- [Source: frontend/app-ui.js] populateWelcomeRecentFiles

---

## Completion Notes

**Implemented:** 2026-03-15

### Summary

- **Background:** Light image (`welcome-bg.png`) with grid/data motif; disabled in dark mode.
- **Title:** Plus Jakarta Sans font; "Go" in primary teal accent.
- **Animation:** Staggered entrance (title → subtitle → actions → recent files → tip), 300ms ease-out; respects `prefers-reduced-motion`.
- **Hover/focus:** Existing `.welcome-btn` and `.welcome-recent-item` hover states retained; CSS variables for colors.

### Files Touched

- `frontend/index.html` — Google Fonts (Plus Jakarta Sans), title markup with accent span
- `frontend/spreadsheet.css` — welcome-screen background, animation, .welcome-title, .welcome-title-accent
- `frontend/assets/welcome-bg.png` — light background image (copied from assets/)
- `frontend/welcome-font-options.html` — font options page (reference)
