# Story 8.3: Implement Graceful Shutdown

**Epic:** 8 - Welcome Screen & Lifecycle  
**Story:** 8.3  
**Estimated Effort:** 2-3 hours  
**Status:** done  
**Created:** 2026-02-18

---

## Story

As a user,
I want the app to close gracefully when I quit,
So that my settings and recent files are preserved.

---

## Context

**Prerequisites:**
- Story 7.5 complete: Recent files list with persistence
- Story 7.11 complete: Quit warning dialog for unsaved changes
- Epic 4 complete: Unsaved changes detection

**Current State:**
- Quit warning exists (Story 7.11)
- Recent files persisted on add/remove; may need explicit save on quit
- Window close behavior documented as bug in Story 8.4 (separate fix)

**Desired State:**
- Quit (Cmd+Q or File → Quit) closes app gracefully
- Recent files list saved to disk on quit
- Temp files cleaned up
- App state (window size, position) persisted if applicable
- No crashes or data loss

**Why This Story:**
FR50 requires graceful close when user quits. Ensures data integrity and clean shutdown.

---

## Acceptance Criteria

1. **Quit Flow (FR50)**
   - [ ] When user quits (Cmd+Q or File → Quit), if unsaved changes exist, warning appears (FR10, Epic 4)
   - [ ] If user confirms quit, app closes gracefully
   - [ ] Recent files list is saved to disk before exit
   - [ ] No crashes or data loss

2. **Cleanup**
   - [ ] Temp files (if any) are cleaned up on quit
   - [ ] No orphaned processes or locks

3. **Window Close (Cmd+W or red button)**
   - [ ] If unsaved changes, warning appears (FR10)
   - [ ] If user confirms close, window closes
   - [ ] On macOS, closing the window quits the app (single window per FR51)
   - [ ] Shutdown is graceful with no crashes

**Note:** Story 8.4 addresses the specific "window close bug" (close vs quit behavior). This story focuses on graceful shutdown logic (save state, cleanup) when quit/close is triggered.

---

## Tasks / Subtasks

- [ ] Task 1: Ensure recent files persist on quit (AC: #1)
  - [ ] Verify recent files are written to disk before app exits
  - [ ] Add explicit save if currently only saved on add/remove
  - [ ] Use app.on('before-quit') or window 'close' handler
- [ ] Task 2: Temp file cleanup (AC: #2)
  - [ ] Identify any temp files (CSV preview, etc.)
  - [ ] Clean up on quit
- [ ] Task 3: Window close handling (AC: #3)
  - [ ] Ensure Cmd+W / red button triggers same unsaved-check flow as Quit
  - [ ] On macOS: closing last window quits app (Electron default or explicit)
  - [ ] Coordinate with Story 8.4 if window-close behavior needs fix
- [ ] Task 4: App state persistence (optional)
  - [ ] Persist window size/position to userData if not already done
  - [ ] Restore on next launch

---

## Technical Requirements

### Architecture Compliance

- **Electron:** `main.js` - before-quit, window close handlers
- **Storage:** `app.getPath('userData')` for recent-files.json, window-state.json

### Electron APIs

```javascript
app.on('before-quit', () => {
  // Save recent files, cleanup
});

mainWindow.on('close', (e) => {
  // Check unsaved; prevent close if user cancels
});
```

### Reuse Existing Patterns

- **Unsaved check:** Same logic as Story 7.11 (quit warning)
- **Recent files:** Story 7.5 storage path and format

---

## Dev Notes

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8] - Story 8.3 acceptance criteria
- [Source: _bmad-output/implementation-artifacts/7-5-implement-recent-files-list.md] - Recent files storage
- [Source: _bmad-output/implementation-artifacts/7-11-implement-quit-warning-dialog.md] - Quit warning
- [Source: _bmad-output/implementation-artifacts/7-5-implement-recent-files-list.md] - Window close bug → Story 8.4

### Testing

- Manual: Quit with unsaved changes (cancel, confirm); quit with saved; verify recent files persist
- Verify no temp files left in userData after quit

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

- Task 1: Added `ensureRecentFilesSaved()` called in `before-quit` to defensively persist recent files before exit (normally saved on each add/remove)
- Task 2: Added `cleanupTempFiles()` to remove Go server temp files (`/tmp/gosheet_download.gosheet`, `/tmp/gosheet_upload.gosheet`) on quit
- Task 3: Window close handling already implemented in Story 7.11 (mainWindow.on('close') with unsaved check; Cmd+W and red button use same flow)
- Task 4: Window state persistence skipped (optional)
### File List

- electron/main.js (modified): ensureRecentFilesSaved(), cleanupTempFiles(), before-quit calls both
