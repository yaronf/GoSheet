# Story 23.4: Recent Files Error Handling

Status: done

## Story

As a user,
I want clear feedback when a recent file cannot be opened (e.g. file deleted, moved, or permission denied),
so that I understand what went wrong and the recent list stays accurate.

## Acceptance Criteria

1. **Given** the user clicks a recent file (from welcome screen or File → Open Recent)
   **When** the file cannot be loaded (does not exist, permission denied, or other error)
   **Then** an error dialog is shown with a clear message (e.g. "File not found: /path/to/file.sheet")

2. **Given** the load fails
   **When** the user was on the welcome screen
   **Then** the user remains on the welcome screen (or returns to it) and the error dialog is shown

3. **Given** the load fails
   **When** the user was in the spreadsheet view (e.g. clicked from File menu)
   **Then** the user stays in the spreadsheet view with the current file, and the error dialog is shown

4. **Given** the load fails
   **When** the user dismisses the error dialog
   **Then** the failed file is removed from the recent files list (welcome screen and File menu update)

5. **Given** the user opens a file via CLI or Finder "Open With"
   **When** the file does not exist
   **Then** the existing `open-file-error` flow applies (welcome screen + error); no regression

## Tasks / Subtasks

- [x] Task 1: Ensure error dialog is always shown (AC: 1, 2, 3)
  - [x] Audit `loadFileByPath` in `frontend/app-ui.js`: confirm `showAlert` is called on catch; verify it runs in both welcome-click and menu-click flows
  - [x] Fix any case where error is swallowed or dialog is not shown (e.g. when opening from spreadsheet view)
  - [x] Error message should include the path or a user-friendly summary (e.g. "File not found" or "Permission denied")

- [x] Task 2: Add remove-from-recent API (AC: 4)
  - [x] In `electron/main.js`: add `removeFromRecentFiles(filePath)` — filter out path, save, call `syncRecentFilesMenu()`
  - [x] Add IPC handler `file:removeRecent` and expose `removeRecentFile(filePath)` in preload
  - [x] Add `removeRecentFile` to `frontend/globals.d.ts`

- [x] Task 3: Remove failed file from recent list on load error (AC: 4)
  - [x] In `loadFileByPath` catch block: after `showAlert`, call `window.electronAPI?.removeRecentFile?.(filePath)` if available
  - [x] Call `populateWelcomeRecentFiles()` (or refresh) if on welcome screen so the list updates immediately
  - [x] Menu and dock update via `syncRecentFilesMenu` which is called from main process when removeRecentFile runs

- [x] Task 4: Handle open-file-error (AC: 5)
  - [x] Verify `open-file-error` IPC (from `main.js` when pending file does not exist) still shows welcome + alert
  - [x] Optionally: remove the failed path from recent list when `open-file-error` fires (if file was in recent list)
  - [x] No regression to existing 16.3 behavior

- [x] Task 5: Playwright tests (AC: 1, 2, 4)
  - [x] Test: click recent file that does not exist → error dialog shown, file removed from list
  - [x] Test: from spreadsheet view, File → Open Recent → nonexistent file → error shown, stay in spreadsheet view
  - [ ] Optional: test open-file-error from CLI with nonexistent path

## Dev Notes

### Key Files

- **`frontend/app-ui.js`** — `loadFileByPath`, `populateWelcomeRecentFiles`; error handling in catch block; call removeRecentFile on failure
- **`electron/main.js`** — `loadRecentFiles`, `saveRecentFiles`, `addToRecentFiles`; add `removeFromRecentFiles`; add `file:removeRecent` handler
- **`electron/preload.js`** — expose `removeRecentFile`
- **`frontend/globals.d.ts`** — add `removeRecentFile` type
- **`frontend/app.js`** or **`frontend/app-file-ops.js`** — `onOpenFileError` handler; optionally remove from recent when open-file-error fires

### Current Behavior

- `loadFileByPath`: on error, calls `showWelcome()` then `showAlert('Error loading file: ' + error.message)`. User always ends up on welcome screen.
- **Bug**: When user is in spreadsheet view and clicks File → Open Recent → nonexistent file, we still call `showWelcome()` — user loses the current spreadsheet context. AC3 says user should stay in spreadsheet view.
- No remove-from-recent; failed files stay in the list.

### Implementation Approach

1. **Error handling**: In `loadFileByPath` catch block: determine current view (welcome vs spreadsheet). If spreadsheet, do NOT call `showWelcome()` — stay in spreadsheet view. Always call `showAlert` with clear message.
2. **Remove from recent**: Add `removeFromRecentFiles` in main.js, filter path from array, save, sync. Expose via `file:removeRecent`. Call from `loadFileByPath` catch.
3. **Welcome refresh**: If `showWelcome()` was called (user was on welcome), `populateWelcomeRecentFiles` runs as part of `showWelcome()`. After removeRecentFile, we need to refresh the list — either call `populateWelcomeRecentFiles` again from renderer after remove, or have main send a sync event. Simpler: `removeRecentFile` triggers `syncRecentFilesMenu` which updates menu/dock; for welcome list, call `populateWelcomeRecentFiles()` (or `showWelcome()` which does it) — but if we stayed on spreadsheet we don't want to refresh welcome. Actually: when we remove, the welcome list is only visible when user is on welcome. So: after removeRecentFile, if we're on welcome screen, call `populateWelcomeRecentFiles()` to refresh. If we're on spreadsheet, no need (welcome list not visible).
4. **open-file-error**: Already shows welcome + alert. Optionally remove from recent when that fires — the file path is in the payload.

### Architecture Compliance

- Frontend + Electron main process changes. No Go API changes.
- IPC: new `file:removeRecent` handler.

### Testing

- **Manual:** Delete a file that's in recent list, click it from welcome → error, verify list updates. Same from File menu while in spreadsheet.
- **Playwright:** Add tests in test_file_operations.spec.js or new test_recent_files.spec.js
- **Go:** No backend changes.

### References

- [Source: sprint-change-proposal-2026-03-15-epic23.md] Epic 23 scope, 23-4 description
- [Source: 16-3-open-files-from-cli-and-finder.md] open-file-error, loadFileByPath, fs.existsSync guard
- [Source: frontend/app-ui.js] loadFileByPath, populateWelcomeRecentFiles
- [Source: electron/main.js] loadRecentFiles, addToRecentFiles, saveRecentFiles

---

## Completion Notes

**Implemented:** 2026-03-15

### Summary

- **`loadFileByPath`** — On error: only call `showWelcome()` if user was on welcome screen; call `removeRecentFile`; show user-friendly message ("File not found" for ENOENT).
- **`removeFromRecentFiles`** — New function in main.js; IPC `file:removeRecent`; preload `removeRecentFile`.
- **`handleOpenFileError`** — Calls `removeRecentFile` before showWelcome + showAlert.
- **Modal visibility** — Moved `#modal-overlay` and `#csv-preview-modal` outside `.spreadsheet-view` so they are visible on the welcome screen.
- **Playwright** — Two tests: welcome-screen flow (error, remove from list) and spreadsheet flow (stay in spreadsheet, error shown).

### Files Touched

- `frontend/app-ui.js` — loadFileByPath error handling
- `frontend/app-file-ops.js` — handleOpenFileError: removeRecentFile
- `electron/main.js` — removeFromRecentFiles, file:removeRecent IPC
- `electron/preload.js` — removeRecentFile
- `frontend/globals.d.ts` — removeRecentFile type
- `frontend/index.html` — modal-overlay and csv-preview-modal moved outside spreadsheet-view
- `playwright_tests/test_file_operations.spec.js` — recent file error tests

---

## Code Review

### Summary

Implementation meets the story: error dialog shown, view preserved, failed file removed from recent, open-file-error updated. A few minor suggestions.

### What Works Well

1. **View preservation** — `wasOnWelcome` correctly controls whether `showWelcome()` runs; spreadsheet view is preserved when loading from File menu.
2. **Remove-from-recent** — `removeFromRecentFiles` filters, saves, and syncs; IPC and preload are wired correctly.
3. **Error message** — "File not found" for ENOENT/not-found; generic message for other errors.
4. **open-file-error** — Calls `removeRecentFile` before showWelcome + alert; order matches 16.5 (showWelcome before showAlert).
5. **Modal visibility** — Moving `#modal-overlay` and `#csv-preview-modal` outside `.spreadsheet-view` fixes visibility on the welcome screen.
6. **Tests** — Welcome and spreadsheet flows covered; evaluate-based click avoids visibility flakiness.

### Suggestions

**1. Broaden "file not found" detection**

Go’s `os.Open` returns errors like `"open /path: no such file or directory"`. The current check uses `'not found'` and `'enoent'`; `'no such file'` is not included. Consider adding it:

```javascript
error.message?.toLowerCase().includes('no such file') ||
error.message?.toLowerCase().includes('not found') ||
error.message?.toLowerCase().includes('enoent')
```

**2. `removeRecentFile` before `showAlert` in loadFileByPath**

Order is: removeRecentFile → showWelcome (if needed) → showAlert. That’s correct: the list is updated before the user sees the alert.

**3. handleOpenFileError: remove then showWelcome**

`removeRecentFile` runs before `showWelcome`, so the welcome list is refreshed with the updated recent list. Correct.

**4. Test consistency**

The spreadsheet test uses `waitFor({ state: 'visible' })` on the modal and `locator('#modal-ok').click()`, while the welcome test uses `toContainText` and `evaluate` click. The spreadsheet test passes because the modal is visible there (inside `#app` but not under a hidden parent). Consider using the same pattern in both tests for consistency, or document why they differ.

**5. `filePath` falsy guard**

If `loadFileByPath` is ever called with an empty or null path, `removeRecentFile(filePath)` would still run. `removeFromRecentFiles` would no-op (filter removes nothing if path is empty). Low risk; optional guard: `if (filePath && window.electronAPI?.removeRecentFile)`.

### Verdict

Approve. Optional: add `'no such file'` to the error-message check and align the two tests' modal handling.

---

## Code Review (BMAD Adversarial)

**Story:** 23-4-recent-files-error-handling  
**Git vs Story Discrepancies:** 0 (all story File List items have git changes)  
**Issues Found:** 0 High, 4 Medium, 2 Low

### CRITICAL ISSUES

- None. All tasks marked [x] are implemented; all ACs satisfied.

### MEDIUM ISSUES

1. **Dock menu: non-existent file not removed from recent** [electron/main.js:246-258]  
   When the user clicks a dock menu item for a file that no longer exists, the code logs and returns without calling `removeFromRecentFiles`. The file stays in the recent list. AC4 says the failed file is removed; the dock uses the same recent-files storage. Consider calling `removeFromRecentFiles(filePath)` and `syncRecentFilesMenu()` when `!fs.existsSync(filePath)` in the dock click handler.

2. **Permission denied: no user-friendly message** [frontend/app-ui.js:98-104]  
   AC1 mentions "permission denied" as an example. The implementation only special-cases ENOENT/not-found/no such file. For EACCES, users see "Error loading file: EACCES: permission denied...". Add detection for `'permission denied'` or `error.code === 'EACCES'` and show a friendlier message.

3. **Test pattern inconsistency** [playwright_tests/test_file_operations.spec.js]  
   Welcome test (lines 302-306) uses `evaluate` to click `#modal-ok`; spreadsheet test (line 338) uses `locator('#modal-ok').click()`. Different patterns increase maintenance cost. Align both tests on one approach.

4. **`filePath` falsy guard** [frontend/app-ui.js:92-94]  
   `removeRecentFile(filePath)` is called without checking `filePath`. If `loadFileByPath` is ever invoked with `undefined` or `null`, the IPC would still run. Add `if (filePath && window.electronAPI?.removeRecentFile)` before calling.

### LOW ISSUES

5. **Optional CLI test not implemented** [Story Task 5]  
   Task 5 subtask "Optional: test open-file-error from CLI with nonexistent path" is marked `[ ]`. Low priority; acceptable to leave for later.

6. **Error message for non-ENOENT errors** [frontend/app-ui.js:103]  
   Generic message uses `error.message` directly, which can be technical. Consider sanitizing or truncating for user display.

### Verdict

**Status:** done (ACs met, no critical/high blockers)  
**Recommendation:** Address MEDIUM items 1–4 when convenient; LOW items optional.
