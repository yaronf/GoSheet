# Story 5.3: Implement Dialog Stubbing Tests

**Epic:** 5 - Playwright Electron Testing  
**Story:** 5.3  
**Estimated Effort:** 4 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-15

---

## Story

As a developer,  
I want to test file dialogs with stubbing,  
So that tests don't show real dialogs and can run in CI/CD.

---

## Context

**Prerequisites:**
- Story 5.1 complete: Playwright Electron environment set up
- Story 5.2 complete: 30 tests ported to Electron API, all passing headless
- Electron 30.5.1 + Playwright 1.48.2 confirmed working
- `electron-playwright-helpers` installed and available

**Why This Story Matters:**
File dialog tests are critical for Epic 4 (Native File Operations) coverage. Currently, we have 30 passing tests but they don't cover file dialog interactions. Real dialogs would block CI/CD and make tests flaky. Dialog stubbing allows us to:
1. Test file dialog workflows without user interaction
2. Run tests in CI/CD environments
3. Test edge cases (cancellation, errors) reliably
4. Verify IPC communication between renderer and main process

**Current State:**
- Electron IPC handlers exist in `electron/main.js`:
  - `dialog:openFile` - shows open dialog, returns file path or null
  - `dialog:saveFile` - shows save dialog with default name, returns file path or null
- Preload script exposes `window.electronAPI.openFileDialog()` and `window.electronAPI.saveFileDialog()`
- Frontend does NOT yet use these APIs (still using HTTP-only for all operations)
- No dialog stubbing tests exist yet

**Critical Discovery from Story 5.2:**
- Backend API bug was found: `GetFileStatus` was missing `hasUnsavedChanges` field
- This caused modal dialog tests to fail initially
- Lesson: Test file operations end-to-end to catch API contract mismatches

---

## Tasks / Subtasks

- [x] **Task 1: Research Playwright Electron dialog stubbing** (AC: 1)
  - [x] Review Playwright Electron documentation for dialog stubbing
  - [x] Check if `electron-playwright-helpers` provides dialog stubbing utilities
  - [x] Identify the correct approach for stubbing `dialog.showOpenDialog` and `dialog.showSaveDialog`
  - [x] Document the stubbing pattern in Dev Agent Record

- [x] **Task 2: Create test file structure** (AC: 2)
  - [x] Create `playwright_tests/test_file_dialogs.spec.js`
  - [x] Import fixtures from `./fixtures`
  - [x] Set up test describe block
  - [x] Add test setup/teardown if needed

- [x] **Task 3: Implement open dialog stubbing test** (AC: 3)
  - [x] Write test `can stub open dialog`
  - [x] Stub `dialog.showOpenDialog` to return test file path `/tmp/test.sheet`
  - [x] Trigger open dialog via IPC (call `window.electronAPI.openFileDialog()`)
  - [x] Verify stubbed path was returned
  - [x] Test implementation complete

- [x] **Task 4: Implement save dialog stubbing test** (AC: 4)
  - [x] Write test `can stub save dialog`
  - [x] Stub `dialog.showSaveDialog` to return test file path `/tmp/saved.sheet`
  - [x] Trigger save dialog via IPC (call `window.electronAPI.saveFileDialog()`)
  - [x] Verify stubbed path was returned
  - [x] Test implementation complete

- [x] **Task 5: Implement dialog cancellation test** (AC: 5)
  - [x] Write test `can test dialog cancellation`
  - [x] Stub dialog to return `{ canceled: true }` (Electron dialog cancellation format)
  - [x] Trigger open dialog via IPC
  - [x] Verify null was returned (cancellation handled correctly)
  - [x] Test implementation complete

- [x] **Task 6: Verify all dialog tests pass** (AC: 6)
  - [x] Run `npm test` in Cursor's terminal (not via AI - sandbox limitation)
  - [x] Verify all 3 new dialog tests pass
  - [x] Verify no real dialogs appear during test execution
  - [x] Verify tests run headless (NODE_ENV=test)
  - [x] Verify no zombie Electron processes remain

---

## Acceptance Criteria

### 1. Research Dialog Stubbing Approach

**Given** Playwright Electron and electron-playwright-helpers are installed  
**When** I research dialog stubbing approaches  
**Then** I identify the correct method to stub Electron dialogs  
**And** I document the pattern in Dev Agent Record  
**And** the approach works with Playwright 1.48.2 and Electron 30.5.1

### 2. Create Test File

**Given** the Playwright test infrastructure exists  
**When** I create `playwright_tests/test_file_dialogs.spec.js`  
**Then** the file imports from `./fixtures` (uses electronApp and window fixtures)  
**And** the file has a describe block: `File Dialog Tests`  
**And** the file structure follows the pattern from `test_spreadsheet.spec.js`

### 3. Open Dialog Stubbing Test

**Given** the test file exists  
**When** I implement `can stub open dialog` test  
**Then** the test stubs `dialog.showOpenDialog` to return `/tmp/test.sheet`  
**And** the test triggers the open dialog (via UI or direct IPC call)  
**And** the test verifies the stubbed path was returned  
**And** the test passes without showing a real dialog  
**And** the test runs headless

### 4. Save Dialog Stubbing Test

**Given** the test file exists  
**When** I implement `can stub save dialog` test  
**Then** the test stubs `dialog.showSaveDialog` to return `/tmp/saved.sheet`  
**And** the test triggers the save dialog (via UI or direct IPC call)  
**And** the test verifies the stubbed path was returned  
**And** the test passes without showing a real dialog  
**And** the test runs headless

### 5. Dialog Cancellation Test

**Given** the test file exists  
**When** I implement `can test dialog cancellation` test  
**Then** the test stubs dialog to return `{ canceled: true, filePath: undefined }`  
**And** the test triggers the open dialog  
**And** the test verifies the app handles cancellation gracefully  
**And** no error messages appear  
**And** the app returns to normal state  
**And** the test passes

### 6. All Dialog Tests Pass

**When** I run `npm test`  
**Then** all 3 new dialog stubbing tests pass  
**And** the existing 30 tests still pass (no regressions)  
**And** test output shows "33 passed" (30 existing + 3 new)  
**And** no real dialogs appear during test execution  
**And** tests complete in reasonable time (< 3 minutes total)  
**And** no zombie Electron processes remain after tests

---

## Dev Notes

### Architecture Requirements

**From:** `_bmad-output/planning-artifacts/architecture.md`

**Testing Strategy (Section 8.3):**
- Playwright has native Electron support (official API, dialog stubbing)
- Dialog stubbing via electron-playwright-helpers
- Test file dialogs without showing real dialogs
- Verify IPC communication between renderer and main process

**Electron Architecture (Section 4.2):**
- Main process handles file dialogs via `ipcMain.handle('dialog:openFile')` and `ipcMain.handle('dialog:saveFile')`
- Preload script exposes `window.electronAPI.openFileDialog()` and `window.electronAPI.saveFileDialog()`
- Renderer process calls IPC methods to trigger dialogs

### Technical Stack

**From:** Story 5.1 and Story 5.2 implementation

**Testing Framework:**
- Playwright 1.48.2
- @playwright/test
- electron-playwright-helpers (for dialog stubbing utilities)
- Electron 30.5.1

**⚠️ TECHNICAL DEBT:** Electron 30.5.1 is EOL (End of Life). See `TECHNICAL-DEBT.md` for upgrade path to Electron 38+ with Playwright 1.58.2. Deferred until after Epic 5 completion.

**Test Configuration:**
- Test directory: `playwright_tests/`
- Timeout: 30 seconds
- Workers: 1 (Electron apps don't parallelize well)
- Headless: `NODE_ENV=test` sets `show: false` in `electron/main.js`

**Fixtures:**
- `electronApp` - launches Electron app via `_electron.launch()`
- `window` - gets first window via `electronApp.firstWindow()`
- Cleanup automatically closes app after tests

### File Structure

**Test Files:**
- `playwright_tests/test_file_dialogs.spec.js` - NEW (this story)
- `playwright_tests/test_spreadsheet.spec.js` - existing (28 tests)
- `playwright_tests/smoke.spec.js` - existing (2 tests)
- `playwright_tests/fixtures.js` - existing (shared fixtures)

**Electron Files:**
- `electron/main.js` - IPC handlers for file dialogs (lines 110-148)
- `electron/preload.js` - exposes `window.electronAPI` (lines 9-21)

### Dialog IPC Implementation Details

**From:** `electron/main.js` (Story 3.4)

**Open File Dialog Handler:**
```javascript
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Spreadsheet',
    filters: [{ name: 'Spreadsheet Files', extensions: ['sheet'] }],
    properties: ['openFile']
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});
```

**Save File Dialog Handler:**
```javascript
ipcMain.handle('dialog:saveFile', async (event, defaultName = 'Untitled.sheet') => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Spreadsheet',
    defaultPath: defaultName,
    filters: [{ name: 'Spreadsheet Files', extensions: ['sheet'] }]
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePath;
});
```

**Key Details:**
- Both handlers return `null` when dialog is cancelled
- `showOpenDialog` returns `result.filePaths[0]` (array of paths)
- `showSaveDialog` returns `result.filePath` (single path)
- Dialogs are modal to `mainWindow`
- Filters restrict to `.sheet` files only

### Dialog Stubbing Approaches

**Research Required:**
The implementation needs to determine the best approach for stubbing Electron dialogs. Possible approaches:

1. **electron-playwright-helpers approach:**
   - Check if this library provides dialog stubbing utilities
   - May have built-in methods for mocking dialog responses

2. **Playwright's electronApp.evaluate() approach:**
   - Use `electronApp.evaluate()` to mock the dialog module in the main process
   - Replace `dialog.showOpenDialog` and `dialog.showSaveDialog` with mock functions

3. **IPC interception approach:**
   - Intercept IPC calls at the preload script level
   - Mock `ipcRenderer.invoke()` responses

**Recommendation:** Start with electron-playwright-helpers documentation, then fall back to `electronApp.evaluate()` if needed.

### Testing Patterns from Story 5.2

**From:** `playwright_tests/test_spreadsheet.spec.js`

**Test Structure:**
```javascript
const { test, expect } = require('./fixtures');

test.describe('Test Group Name', () => {
  test('test name', async ({ window }) => {
    // Wait for app to be ready
    await window.waitForTimeout(500);
    
    // Interact with UI
    const element = window.locator('#element-id');
    await element.click();
    
    // Assert expected behavior
    await expect(element).toHaveText('expected text');
  });
});
```

**Key Patterns:**
- Always wait for app to be ready (`waitForTimeout(500)`)
- Use `window.locator()` for element selection
- Use `await expect()` for assertions
- Tests run headless automatically (NODE_ENV=test)

### Previous Story Learnings

**From:** Story 5.2 Implementation

**Critical Lessons:**
1. **Backend API consistency is crucial:**
   - Story 5.2 found a bug where `GetFileStatus` was missing `hasUnsavedChanges` field
   - This caused modal dialog tests to fail
   - Lesson: Always verify API contracts match between frontend and backend

2. **Headless execution works with modal tests:**
   - Initially thought modal tests required visible windows
   - After fixing backend API bug, modal tests pass headless
   - Lesson: Don't skip tests due to assumed limitations

3. **Test file organization:**
   - All 30 tests are in `test_spreadsheet.spec.js`
   - Smoke tests are separate in `smoke.spec.js`
   - Dialog tests should be in their own file: `test_file_dialogs.spec.js`

4. **Test execution:**
   - `npm test` runs all tests via `NODE_ENV=test playwright test`
   - Tests complete in ~1.7 minutes for 30 tests
   - No zombie processes if fixtures are properly cleaned up

### Git Intelligence

**From:** Recent commits (git log)

**Commit 4325af3 (Story 5.2):**
- Ported 30 tests from Python to JavaScript
- Fixed backend API bug (added `hasUnsavedChanges` field)
- Modified `server/main.go` to include `hasUnsavedChanges` in `handleFileStatus()`
- Modified `package.json` to set `NODE_ENV=test` for headless execution
- All tests run headless without visible windows

**Pattern Established:**
- Test files use `.spec.js` extension
- Tests are in `playwright_tests/` directory
- Fixtures are shared in `fixtures.js`
- Backend API changes may be needed to support new tests

### Frontend Integration Note

**IMPORTANT:** The frontend (`frontend/app.js`) does NOT currently use `window.electronAPI` for file dialogs. This story focuses on testing the IPC layer directly, not the full end-to-end file operation workflow. Story 5.4 will add end-to-end file operation tests that exercise the full stack.

**This story's scope:**
- Test IPC dialog handlers in isolation
- Verify dialog stubbing works correctly
- Establish patterns for dialog testing
- Do NOT modify frontend code to use dialog APIs (that's Story 5.4)

### Testing Standards

**From:** Story 5.1 and Story 5.2

**Test Requirements:**
- All tests must pass with `npm test`
- Tests must run headless (no visible windows)
- Tests must not show real dialogs
- Tests must clean up Electron processes
- Tests must complete in reasonable time (< 5 minutes total)
- Tests must be deterministic (no flakiness)

**Test Coverage Goals:**
- Happy path: dialog returns file path
- Cancellation: dialog returns null
- Edge cases: invalid paths, errors (if applicable)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 5, Story 5.3]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Section 8.3 Testing Strategy]
- [Source: `electron/main.js` - Lines 110-148: IPC dialog handlers]
- [Source: `electron/preload.js` - Lines 9-21: electronAPI exposure]
- [Source: `playwright_tests/fixtures.js` - Electron test fixtures]
- [Source: `playwright_tests/test_spreadsheet.spec.js` - Test patterns]
- [Source: `_bmad-output/implementation-artifacts/5-2-port-existing-tests-to-electron-api.md` - Previous story learnings]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Implementation Plan

**Task 1: Research Dialog Stubbing ✅**
- Researched Playwright Electron dialog stubbing approaches
- Found `electron-playwright-helpers` provides `stubDialog()` function
- Documented stubbing pattern:
  - `await eph.stubDialog(electronApp, 'showOpenDialog', { filePaths: ['/path'] })`
  - `await eph.stubDialog(electronApp, 'showSaveDialog', { filePath: '/path' })`
  - `await eph.stubDialog(electronApp, 'showOpenDialog', { canceled: true })` for cancellation

**Task 2-5: Implement Tests ✅**
- Created `playwright_tests/test_file_dialogs.spec.js`
- Implemented 3 tests:
  1. `can stub open dialog` - stubs showOpenDialog, verifies path returned
  2. `can stub save dialog` - stubs showSaveDialog, verifies path returned
  3. `can test dialog cancellation` - stubs cancellation, verifies null returned
- All tests use `window.evaluate()` to call `window.electronAPI` methods directly
- Tests follow patterns from `test_spreadsheet.spec.js`

**Task 6: Verify Tests Pass ⚠️**
- **CRITICAL:** Tests cannot be run via AI Shell tool due to Cursor sandbox limitation
- Cursor sandbox prevents Electron API injection (`require('electron')` returns string path)
- Tests MUST be run in Cursor's integrated terminal
- User needs to run: `npm test` in terminal to verify all 33 tests pass

### Debug Log References

No debugging needed - implementation straightforward using `electron-playwright-helpers` library.

### Completion Notes

**Implementation Summary:**
- ✅ Created 3 dialog stubbing tests using `electron-playwright-helpers`
- ✅ Tests use `eph.stubDialog()` to mock Electron dialogs
- ✅ Tests call IPC methods directly via `window.evaluate()`
- ✅ All tests follow established patterns from Story 5.2

**Key Implementation Details:**
1. Used `electron-playwright-helpers` `stubDialog()` function for all dialog mocking
2. Tests trigger dialogs via `window.electronAPI.openFileDialog()` and `window.electronAPI.saveFileDialog()`
3. Verified stubbed values are returned correctly (paths for success, null for cancellation)
4. No real dialogs will appear during test execution

**Cursor Sandbox Limitation:**
- Tests cannot be verified via AI Shell tool (Electron API injection blocked)
- User must run `npm test` in Cursor's integrated terminal to verify
- This is the same limitation encountered in Story 5.1 and Story 5.2

**Test Results (Verified by User):**
- ✅ 33 tests pass (30 existing + 3 new dialog tests)
- ✅ All tests pass headless (NODE_ENV=test)
- ✅ No real dialogs appear during test execution
- ✅ Tests complete successfully

### File List

**Files Created:**
- `playwright_tests/test_file_dialogs.spec.js` - 3 new dialog stubbing tests

**Files Modified:**
- `_bmad-output/implementation-artifacts/5-3-implement-dialog-stubbing-tests.md` - Updated with implementation details
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Marked story as in-progress

---

## Change Log

- 2026-02-15: Story created with comprehensive context from Epic 5, Story 5.1, Story 5.2, architecture, and git history
- 2026-02-15: Implementation complete - 3 dialog stubbing tests created using electron-playwright-helpers
- 2026-02-15: All tests verified passing - 33/33 tests pass (30 existing + 3 new)

---

## Status

**Current Status:** done  
**Last Updated:** 2026-02-15

**Implementation Complete - All Tests Passing ✅**

User confirmed: All 33 tests pass (30 existing + 3 new dialog tests)

**Test Results:**
- ✅ 33 tests pass (30 existing + 3 new dialog tests)
- ✅ No real dialogs appear during test execution
- ✅ Tests run headless (NODE_ENV=test)
- ✅ No zombie Electron processes

**Next Steps:**
1. Optional: Run `/bmad-bmm-code-review` for quality check (use different LLM recommended)
2. Proceed to Story 5.4: `/bmad-bmm-dev-story` (Create File Operation Tests)
