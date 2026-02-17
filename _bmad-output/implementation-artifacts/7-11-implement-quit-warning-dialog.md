# Story 7.11: Implement Quit Warning Dialog

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.11  
**Estimated Effort:** 2-3 hours  
**Status:** done  
**Created:** 2026-02-17

---

## Story

As a user,  
I want to be warned before quitting the application if I have unsaved changes,  
So that I don't accidentally lose my work.

---

## Context

**Prerequisites:**
- Story 4.7: File status tracking is implemented and working
- Story 7.1: File menu with Quit command exists
- Electron app lifecycle handlers are in place

**Current State:**
- User can quit the app with Cmd+Q or by closing the window
- No warning is shown if there are unsaved changes
- User may accidentally lose work

**Desired State:**
- When user tries to quit (Cmd+Q, close window, or Quit menu item) with unsaved changes, show a warning dialog
- Dialog offers "Cancel" (stay in app) or "Quit Without Saving" (lose changes and quit)
- If no unsaved changes, quit immediately without dialog
- App remains fully functional if user cancels the quit

---

## Acceptance Criteria

1. **Quit with Unsaved Changes**
   - [x] When user presses Cmd+Q with unsaved changes, show warning dialog
   - [x] When user clicks window close button with unsaved changes, show warning dialog
   - [x] Dialog shows clear message: "You have unsaved changes"
   - [x] Dialog offers two buttons: "Cancel" and "Quit Without Saving"
   - [x] "Cancel" is the default button (safer option)

2. **Dialog Behavior**
   - [x] Clicking "Cancel" closes dialog and keeps app running
   - [x] App remains fully functional after canceling (can edit cells, use menus, etc.)
   - [x] Clicking "Quit Without Saving" immediately quits the application
   - [x] Dialog is modal (blocks interaction with main window)

3. **Quit without Unsaved Changes**
   - [x] When no unsaved changes exist, Cmd+Q quits immediately (no dialog)
   - [x] When no unsaved changes exist, closing window quits immediately (no dialog)

4. **Status Synchronization**
   - [x] Warning check uses the same unsaved changes status displayed in the UI
   - [x] Status is checked at the moment of quit attempt (not cached from earlier)

---

## Technical Requirements

### Implementation Approach

**Electron Main Process (`electron/main.js`):**
1. Add `close` event handler to `mainWindow`
2. Call `event.preventDefault()` to stop the close
3. Query renderer process for current unsaved changes status
4. If unsaved changes exist, show native dialog using `dialog.showMessageBox()`
5. Based on user choice, either quit or do nothing
6. Handle edge cases (errors, window already closing, etc.)

**Frontend (`frontend/app.js`):**
1. Expose `currentHasUnsavedChanges` variable to Electron main process
2. Keep this variable synchronized with `displayFileStatus()` function
3. Ensure variable is accessible via `window.currentHasUnsavedChanges`

### Key Challenges

1. **Async Event Handling:** The `close` event handler must prevent default immediately, then handle async dialog
2. **Recursive Close:** Calling `mainWindow.close()` or `app.quit()` after setting flag to allow close
3. **State Management:** Using a flag (`isQuitting`) to track whether we've already decided to quit
4. **App Usability:** Ensuring app remains responsive if user cancels the quit

### Dialog Specification

```javascript
{
  type: 'warning',
  buttons: ['Cancel', 'Quit Without Saving'],
  defaultId: 0,  // Cancel is default
  title: 'Unsaved Changes',
  message: 'You have unsaved changes.',
  detail: 'Do you want to quit without saving?'
}
```

---

## Implementation Tasks

0. [x] **Research Electron close event handling**
   - Study `close` vs `closed` events
   - Understand `event.preventDefault()` behavior
   - Research best practices for quit confirmation dialogs
   - **See:** `_bmad-output/planning-artifacts/research/technical-electron-quit-dialog-research-2026-02-17.md`

1. [x] **Expose unsaved changes status to Electron**
   - Change `currentHasUnsavedChanges` to `window.currentHasUnsavedChanges` in `frontend/app.js`
   - Update `displayFileStatus()` to set `window.currentHasUnsavedChanges`
   - Test that Electron can read this value via `executeJavaScript()`

2. [x] **Implement close event handler**
   - Add `mainWindow.on('close', ...)` handler in `createWindow()`
   - Add module-level `isQuitting` flag
   - Implement logic to check status and show dialog
   - Handle user's choice (cancel or quit)

3. [x] **Test quit scenarios**
   - Test Cmd+Q with unsaved changes → shows dialog
   - Test Cmd+Q without unsaved changes → quits immediately
   - Test window close button with unsaved changes → shows dialog
   - Test clicking "Cancel" → app remains usable
   - Test clicking "Quit Without Saving" → app quits

4. [x] **Handle edge cases**
   - Test if `executeJavaScript()` fails (error handling)
   - Test rapid quit attempts (prevent multiple dialogs)
   - Test quit during file operations (ensure no corruption)

5. [x] **Update documentation**
   - Document the quit warning behavior in user docs
   - Add technical notes about the implementation approach

---

## Files to Update

1. `electron/main.js` - Add close event handler and dialog logic
2. `frontend/app.js` - Expose `window.currentHasUnsavedChanges`

---

## Testing Strategy

### Manual Testing

1. **Basic Quit Warning**
   - Open app, make changes to a cell
   - Press Cmd+Q
   - Verify dialog appears with correct message
   - Click "Cancel"
   - Verify app is still running and usable (try editing a cell)
   - Press Cmd+Q again
   - Click "Quit Without Saving"
   - Verify app quits

2. **Quit Without Changes**
   - Open app (don't make changes)
   - Press Cmd+Q
   - Verify app quits immediately (no dialog)

3. **Window Close Button**
   - Open app, make changes
   - Click red close button
   - Verify dialog appears
   - Test both Cancel and Quit options

4. **After Save**
   - Open app, make changes
   - Save the file (Cmd+S)
   - Press Cmd+Q
   - Verify app quits immediately (no dialog, since changes are saved)

### Automated Testing (Future)

- Add Playwright test for quit warning dialog
- Mock unsaved changes state
- Verify dialog appears and buttons work correctly

---

## Definition of Done

- [x] Quit warning dialog appears when trying to quit with unsaved changes
- [x] Dialog does not appear when quitting without unsaved changes
- [x] "Cancel" button keeps app running and fully functional
- [x] "Quit Without Saving" button quits the app
- [x] All manual tests pass
- [x] No console errors or warnings
- [x] Code is clean and well-commented
- [x] Story marked as `done` in `sprint-status.yaml`

---

## Dev Notes

### ⚠️ IMPORTANT: Read Research Document First

**Before implementing this story, you MUST read:**
`_bmad-output/planning-artifacts/research/technical-electron-quit-dialog-research-2026-02-17.md`

This research document explains:
- Why the previous attempt failed (app became unusable after canceling)
- The correct implementation pattern with working code examples
- Critical differences from common patterns found online
- Detailed testing strategy

### Known Issues to Avoid

1. **Recursive Close Problem:** The `close` event handler calls `app.quit()` (not `mainWindow.close()`). However, the `before-quit` handler DOES call `mainWindow.close()` to trigger the dialog - this is intentional and correct.
2. **Async Handler Issues:** Don't use `async/await` in close handler - use promise chains (`.then()`)
3. **Event Prevention:** Always call `event.preventDefault()` immediately and synchronously
4. **State Flag Scope:** `isQuitting` flag must be at module level, not inside function
5. **App Usability:** After canceling dialog, app MUST remain fully functional (this was the main bug in previous attempt)
6. **Error Handling:** Don't auto-quit on errors - show a dialog asking user what to do
7. **Race Conditions:** Debounce rapid quit attempts to prevent multiple dialogs

### Alternative Approaches Considered

1. **beforeunload event:** Doesn't work reliably in Electron (see research doc)
2. **IPC message:** Too complex, direct `executeJavaScript()` is simpler
3. **Polling status:** Not needed, status is already tracked in real-time

---

## References

- **Research Document:** `_bmad-output/planning-artifacts/research/technical-electron-quit-dialog-research-2026-02-17.md` (MUST READ before implementation)
- Electron `BrowserWindow` close event: https://www.electronjs.org/docs/latest/api/browser-window#event-close
- Electron `dialog.showMessageBox`: https://www.electronjs.org/docs/latest/api/dialog#dialogshowmessageboxbrowserwindow-options
- Story 4.7: File Status Tracking (provides the unsaved changes state)
- Story 7.1: File Menu (provides the Quit menu item)

---

## Dev Agent Record

### Implementation Plan

Implemented quit warning dialog following the research document pattern to avoid issues from previous failed attempt:

**Key Technical Decisions:**
1. Use promise chains (`.then()`) instead of `async/await` to avoid timing issues with `event.preventDefault()`
2. Use `app.quit()` instead of `mainWindow.close()` to avoid recursive close events
3. Handle both `close` and `before-quit` events to properly intercept Cmd+Q on macOS
4. Use two flags: `isQuitting` (final decision) and `quitDialogShown` (prevent multiple dialogs)

**Critical Discovery:**
On macOS, Cmd+Q triggers `before-quit` BEFORE `close`, and `before-quit` kills the Go server. We had to:
1. Prevent `before-quit` first
2. Trigger `mainWindow.close()` from `before-quit` handler
3. Show dialog in `close` handler
4. Only allow `before-quit` to proceed when `isQuitting=true`

### File List

**Source Code:**
- `frontend/app.js` - Added `window.currentHasUnsavedChanges` variable and updated `displayFileStatus()` to expose it
- `electron/main.js` - Added `isQuitting`, `quitDialogShown`, and `lastQuitAttempt` flags; implemented `close` event handler with dialog logic and improved error handling; modified `before-quit` handler to prevent premature server shutdown and add debouncing

**Tests:**
- `playwright_tests/test_quit_warning.spec.js` - Added automated tests for quit warning dialog behavior and `currentHasUnsavedChanges` synchronization

**Documentation:**
- `_bmad-output/planning-artifacts/research/technical-electron-quit-dialog-research-2026-02-17.md` - Created comprehensive research document explaining implementation approach and lessons learned from previous failed attempt
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status from `ready-for-dev` → `in-progress` → `review`

### Completion Notes

✅ All manual tests passed:
- Quit with unsaved changes + Cancel → app stays open and fully functional
- Quit with unsaved changes + Quit Without Saving → app quits cleanly
- Quit without unsaved changes → quits immediately (no dialog)
- Window close button works identically to Cmd+Q
- After save, quit works without dialog

**Debugging Journey:**
1. Initial implementation worked for dialog display but app became unusable after Cancel
2. Root cause: `before-quit` event was killing Go server before dialog was shown
3. Solution: Intercept `before-quit`, prevent it, trigger `close` event, show dialog, then allow quit only when `isQuitting=true`
4. Added `quitDialogShown` flag to prevent infinite `before-quit` loops and allow retry after Cancel

**Testing:**
- Manual testing completed successfully
- Automated Playwright tests added (6 tests covering quit dialog behavior)
- All acceptance criteria met
- App remains fully functional after canceling quit
- No console errors or warnings

**Code Review Improvements (2026-02-17):**
- Added comprehensive error handling with user choice dialog instead of auto-quit
- Added window destroyed check before executeJavaScript()
- Added debouncing (500ms) to prevent rapid quit attempts
- Added logging for dialog choices to aid debugging
- Created automated Playwright tests for regression prevention
- Updated File List to include all changed files (tests, docs, sprint status)

---

## Senior Developer Review (AI)

**Review Date:** 2026-02-17  
**Reviewer:** Senior Developer (Adversarial Mode)  
**Outcome:** ✅ Approved with Fixes Applied

### Issues Found and Fixed

**HIGH Severity (3 fixed):**
1. ✅ Added automated Playwright tests (6 tests) - `test_quit_warning.spec.js`
2. ✅ Improved error handling - shows user dialog instead of auto-quit on errors
3. ✅ Updated File List to include all changed files (tests, docs, sprint status)

**MEDIUM Severity (4 fixed):**
4. ✅ Added debouncing (500ms) to prevent race conditions from rapid quit attempts
5. ✅ Added window destroyed check before `executeJavaScript()`
6. ✅ Clarified Dev Notes about `mainWindow.close()` usage (intentional in `before-quit`)
7. ✅ Added logging for dialog choices to aid debugging

**LOW Severity (noted, not blocking):**
8. ℹ️ Magic number `defaultId: 0` - added inline comment for clarity
9. ℹ️ Story status mismatch - will be resolved when marked `done`
10. ℹ️ "Save and Quit" option - noted as future enhancement

### Action Items

None - all HIGH and MEDIUM issues have been fixed.

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-02-17 | AI | Story created based on user request for quit warning dialog |
| 2026-02-17 | AI | Implemented quit warning dialog with proper event handling for macOS |
| 2026-02-17 | AI (Review) | Fixed error handling, added tests, improved robustness based on code review |
