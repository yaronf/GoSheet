# Story 8.4: Verify macOS Window Close Behavior

**Epic:** 8 - Welcome Screen & Lifecycle  
**Story:** 8.4  
**Estimated Effort:** 0.5-1 hour  
**Status:** ready-for-dev  
**Created:** 2026-02-18

---

## Story

As a user,
I want closing the window (red button or Cmd+W) to behave correctly on macOS,
So that the app quits when I expect it to and warns me about unsaved changes.

---

## Context

**Prerequisites:**
- Story 8.3 complete: Graceful shutdown (recent files persist, cleanup)
- Story 7.11 complete: Quit warning for unsaved changes

**Current State (Implemented in Story 7.11):**
- `mainWindow.on('close', ...)` in `electron/main.js` (lines 159-252) already:
  - Prevents close initially, checks `window.currentHasUnsavedChanges`
  - Shows unsaved warning dialog when applicable (Cancel / Quit Without Saving)
  - Calls `app.quit()` when user confirms or has no unsaved changes
- `before-quit` routes Cmd+Q / File → Quit through `mainWindow.close()`, so all paths use the same handler
- Closing window (red button or Cmd+W) triggers the same flow; app quits correctly on macOS

**Desired State:**
- Verify the above behavior works as expected
- Fix any edge cases discovered during verification

**Why This Story:**
Story 7.5 documented this as a future fix. Story 7.11 implemented it. This story verifies the fix and addresses any remaining edge cases.

---

## Acceptance Criteria

1. **Window Close Triggers Unsaved Check**
   - [ ] When user closes window (Cmd+W or red button) with unsaved changes, warning appears
   - [ ] User can cancel (stay in app) or confirm (close and quit)
   - [ ] Same behavior as File → Quit

2. **macOS Single-Window Behavior**
   - [ ] On macOS, closing the window quits the app (no "window closed but app still running")
   - [ ] Per FR51: single spreadsheet at a time; closing = quitting

3. **No Regressions**
   - [ ] File → Quit still works correctly
   - [ ] Cmd+Q still works correctly
   - [ ] Graceful shutdown (Story 8.3) still occurs

---

## Tasks / Subtasks

- [ ] Task 1: Verify window close behavior (AC: #1, #2)
  - [ ] Cmd+W with unsaved changes → warning appears; Cancel keeps app open; Quit Without Saving quits
  - [ ] Cmd+W with no unsaved changes → app quits immediately
  - [ ] Red button (close) → same behavior as Cmd+W
  - [ ] App fully quits on macOS (no "ghost" dock icon with no window)
- [ ] Task 2: Verify quit paths (AC: #3)
  - [ ] File → Quit → same unsaved check and behavior
  - [ ] Cmd+Q → same behavior
  - [ ] All paths use consistent dialog and flow
- [ ] Task 3: Fix any edge cases (if discovered)
  - [ ] Document and fix any regressions or edge cases found during verification

---

## Technical Requirements

### Implementation (Already in electron/main.js)

- **Window close:** `mainWindow.on('close', ...)` (lines 159-252) - preventDefault, check unsaved, show dialog, app.quit()
- **before-quit:** Routes Cmd+Q through mainWindow.close() so same handler runs
- **window-all-closed:** On macOS, does not call app.quit() (close handler already calls it when user confirms)

### References

- [Source: electron/main.js] - Lines 159-252 (close handler), 436-461 (before-quit)
- [Source: _bmad-output/implementation-artifacts/7-5-implement-recent-files-list.md] - Original bug note
- [Source: _bmad-output/implementation-artifacts/7-11-implement-quit-warning-dialog.md] - Implementation

---

## Dev Notes

### Verification Checklist

- Cmd+W with unsaved → warning; Cmd+W with saved → quit; red button same; Cmd+Q same
- Verify app fully quits on macOS when window closed (no ghost app)

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled by dev agent)
