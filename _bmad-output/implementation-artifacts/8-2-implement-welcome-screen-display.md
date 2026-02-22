# Story 8.2: Implement Welcome Screen Display

**Epic:** 8 - Welcome Screen & Lifecycle  
**Story:** 8.2  
**Estimated Effort:** 3-4 hours  
**Status:** done  
**Created:** 2026-02-18

---

## Story

As a user,
I want the welcome screen to appear on first launch,
So that I can easily get started with the app.

---

## Context

**Prerequisites:**
- Story 8.1 complete: Welcome screen layout designed (HTML/CSS)
- Story 7.5 complete: Recent files list implemented and persisted
- Epic 4 complete: File operations (New, Open, Import CSV)

**Current State:**
- Welcome screen layout exists (Story 8.1) but is not shown
- App loads directly to spreadsheet view
- Recent files available via File → Open Recent and storage

**Desired State:**
- Welcome screen shown when app launches (or when no file is open)
- Button handlers navigate to spreadsheet or trigger dialogs
- Recent files section populated from storage

**Why This Story:**
FR48 requires welcome screen on first launch. Story 8.1 defined layout; this story implements display logic, when to show, and navigation.

---

## Acceptance Criteria

1. **First Launch (FR48)**
   - [ ] When app launches with no recent files, welcome screen is displayed
   - [ ] Three action buttons are visible and clickable
   - [ ] Recent Files section shows "No recent files"

2. **Returning User (FR48, FR49)**
   - [ ] When app launches with recent files, welcome screen is displayed
   - [ ] Recent Files section shows up to 5 recent files
   - [ ] Each recent file shows filename and parent directory
   - [ ] Clicking a recent file opens that file

3. **Button Actions**
   - [ ] "Create New Spreadsheet" → welcome screen replaced with empty spreadsheet grid
   - [ ] "Open Existing File" → native Open dialog appears
   - [ ] "Import from CSV" → CSV import dialog appears

4. **Navigation**
   - [ ] After Create/Open/Import, spreadsheet view is shown
   - [ ] When user closes file (File → Close or similar), welcome screen shown again (if single-window app)

---

## Tasks / Subtasks

- [ ] Task 1: Implement launch logic (AC: #1, #2)
  - [ ] Determine when to show welcome vs spreadsheet (no file open = welcome)
  - [ ] On app load: check if file is open; if not, show welcome screen
  - [ ] Use existing getRecentFiles() or equivalent to populate recent files
- [ ] Task 2: Wire button handlers (AC: #3)
  - [ ] Create New: call NewSpreadsheet or equivalent, show grid
  - [ ] Open: trigger open file dialog (same as File → Open)
  - [ ] Import CSV: trigger CSV import dialog (same as File → Import CSV)
- [ ] Task 3: Populate recent files section (AC: #2)
  - [ ] Fetch recent files from storage (up to 5 for welcome screen)
  - [ ] Render list with filename + parent directory
  - [ ] Handle "No recent files" state
  - [ ] Wire click handler to open file (same as File → Open Recent)
- [ ] Task 4: Implement view switching (AC: #4)
  - [ ] Show spreadsheet when file is created/opened/imported
  - [ ] Show welcome when file is closed and no file open
  - [ ] Ensure single-window behavior (per FR51)

---

## Technical Requirements

### Architecture Compliance

- **Frontend:** `frontend/app.js` - view switching, button handlers
- **IPC:** Use existing `window.electronAPI` for file operations
- **Recent files:** Use same data source as File menu (Story 7.5)

### Reuse Existing Patterns

- **New spreadsheet:** Same flow as File → New
- **Open file:** Same flow as File → Open (showOpenDialog)
- **Import CSV:** Same flow as File → Import CSV
- **Recent files:** getRecentFiles() or equivalent from main process

### File Structure

```
frontend/
  app.js              # View state: welcome vs spreadsheet; show/hide logic
  (welcome HTML from 8.1)
electron/
  main.js             # May need IPC for getRecentFiles if not already exposed
```

### Do NOT Implement (Other Stories)

- Graceful shutdown (Story 8.3)
- Window close behavior fix (Story 8.4)
- End-to-end verification (Story 8.5)

---

## Dev Notes

### Project Structure Notes

- App injects content into `#app`; welcome screen and spreadsheet are mutually exclusive views
- Consider: `showWelcome()` / `showSpreadsheet()` helpers
- File status: when no file open, welcome shown; when file open, spreadsheet shown

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8] - Story 8.2 acceptance criteria
- [Source: _bmad-output/implementation-artifacts/8-1-design-welcome-screen-layout.md] - Layout structure
- [Source: _bmad-output/implementation-artifacts/7-5-implement-recent-files-list.md] - Recent files API
- [Source: frontend/app.js] - Current app structure, IPC usage

### Testing

- Manual: Launch app, verify welcome shows; click each button; verify recent files
- Playwright: Consider adding welcome screen tests (optional for this story)

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled by dev agent)
