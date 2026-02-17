# Story 7.11: Implement Quit Warning Dialog

**Epic:** 7 - macOS Integration & Polish  
**Story:** 7.11  
**Estimated Effort:** 2-3 hours  
**Status:** ready-for-dev  
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
   - [ ] When user presses Cmd+Q with unsaved changes, show warning dialog
   - [ ] When user clicks window close button with unsaved changes, show warning dialog
   - [ ] Dialog shows clear message: "You have unsaved changes"
   - [ ] Dialog offers two buttons: "Cancel" and "Quit Without Saving"
   - [ ] "Cancel" is the default button (safer option)

2. **Dialog Behavior**
   - [ ] Clicking "Cancel" closes dialog and keeps app running
   - [ ] App remains fully functional after canceling (can edit cells, use menus, etc.)
   - [ ] Clicking "Quit Without Saving" immediately quits the application
   - [ ] Dialog is modal (blocks interaction with main window)

3. **Quit without Unsaved Changes**
   - [ ] When no unsaved changes exist, Cmd+Q quits immediately (no dialog)
   - [ ] When no unsaved changes exist, closing window quits immediately (no dialog)

4. **Status Synchronization**
   - [ ] Warning check uses the same unsaved changes status displayed in the UI
   - [ ] Status is checked at the moment of quit attempt (not cached from earlier)

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

0. [ ] **Research Electron close event handling**
   - Study `close` vs `closed` events
   - Understand `event.preventDefault()` behavior
   - Research best practices for quit confirmation dialogs

1. [ ] **Expose unsaved changes status to Electron**
   - Change `currentHasUnsavedChanges` to `window.currentHasUnsavedChanges` in `frontend/app.js`
   - Update `displayFileStatus()` to set `window.currentHasUnsavedChanges`
   - Test that Electron can read this value via `executeJavaScript()`

2. [ ] **Implement close event handler**
   - Add `mainWindow.on('close', ...)` handler in `createWindow()`
   - Add module-level `isQuitting` flag
   - Implement logic to check status and show dialog
   - Handle user's choice (cancel or quit)

3. [ ] **Test quit scenarios**
   - Test Cmd+Q with unsaved changes → shows dialog
   - Test Cmd+Q without unsaved changes → quits immediately
   - Test window close button with unsaved changes → shows dialog
   - Test clicking "Cancel" → app remains usable
   - Test clicking "Quit Without Saving" → app quits

4. [ ] **Handle edge cases**
   - Test if `executeJavaScript()` fails (error handling)
   - Test rapid quit attempts (prevent multiple dialogs)
   - Test quit during file operations (ensure no corruption)

5. [ ] **Update documentation**
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

- [ ] Quit warning dialog appears when trying to quit with unsaved changes
- [ ] Dialog does not appear when quitting without unsaved changes
- [ ] "Cancel" button keeps app running and fully functional
- [ ] "Quit Without Saving" button quits the app
- [ ] All manual tests pass
- [ ] No console errors or warnings
- [ ] Code is clean and well-commented
- [ ] Story marked as `done` in `sprint-status.yaml`

---

## Dev Notes

### Known Issues to Avoid

1. **Recursive Close Problem:** Don't call `mainWindow.close()` recursively - use `app.quit()` instead
2. **Async Handler Issues:** Don't use `async/await` in close handler - use promise chains
3. **Event Prevention:** Always call `event.preventDefault()` first, before any async operations
4. **State Flag Scope:** `isQuitting` flag must be at module level, not inside function

### Alternative Approaches Considered

1. **beforeunload event:** Doesn't work reliably in Electron
2. **IPC message:** Too complex, direct `executeJavaScript()` is simpler
3. **Polling status:** Not needed, status is already tracked in real-time

---

## References

- Electron `BrowserWindow` close event: https://www.electronjs.org/docs/latest/api/browser-window#event-close
- Electron `dialog.showMessageBox`: https://www.electronjs.org/docs/latest/api/dialog#dialogshowmessageboxbrowserwindow-options
- Story 4.7: File Status Tracking (provides the unsaved changes state)
- Story 7.1: File Menu (provides the Quit menu item)

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-02-17 | AI | Story created based on user request for quit warning dialog |
