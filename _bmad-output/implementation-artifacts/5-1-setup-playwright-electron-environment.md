# Story 5.1: Set Up Playwright Electron Environment

**Epic:** 5 - Playwright Electron Testing  
**Story:** 5.1  
**Estimated Effort:** 2 hours  
**Actual Effort:** 8 hours (including architecture debugging)  
**Status:** Complete  
**Created:** 2026-02-15  
**Completed:** 2026-02-15

---

## Story

As a developer,  
I want to configure Playwright for Electron testing,  
So that I can write automated tests for the Electron app.

---

## Context

**Why This Story Matters:**
Epic 3 and Epic 4 both had 0% success rate on first test due to lack of integration testing. This story establishes the testing infrastructure that will prevent this pattern from recurring.

**Epic 3 Retrospective Findings:**
- 6 integration bugs found during first manual test
- All bugs were API contract mismatches between frontend/backend
- No automated tests caught these issues
- Pattern repeated from Epic 4 (same problem twice)

**Critical Success Factor:**
Epic 5 must deliver WORKING, PASSING tests that catch integration issues. Not just test infrastructure, but actual verified coverage.

---

## Tasks

- [x] Install @playwright/test
- [x] Install electron-playwright-helpers  
- [x] Create playwright.config.js
- [x] Create test fixtures for Electron app
- [x] Write simple smoke test (app launches)
- [x] Verify test execution works
- [ ] Document test setup in README (deferred to Story 5.6)

---

## Acceptance Criteria

### Setup Dependencies

**Given** I have Node.js 18+ installed  
**When** I run `npm install --save-dev @playwright/test electron-playwright-helpers`  
**Then** Playwright and helpers are installed successfully  
**And** package.json devDependencies includes both packages  
**And** no installation errors occur

### Configure Playwright

**When** I create `playwright.config.js` in project root  
**Then** the config specifies:
- Test directory: `playwright_tests/`
- Timeout: 30 seconds (Electron apps can be slower to start)
- Workers: 1 (Electron apps don't parallelize well)
- Headless: false for development, true for CI
- Retries: 2 (handle occasional flakiness)

### Create Test Fixtures

**When** I create `playwright_tests/fixtures.js`  
**Then** the file contains:
- `electronApp` fixture that launches Electron via `_electron.launch()`
  - Passes path to Electron executable
  - Passes path to main.js
  - Waits for app to be ready
- `window` fixture that gets first window via `electronApp.firstWindow()`
  - Waits for window to load
  - Returns window object for test use
- Cleanup that closes app after tests
  - Ensures no zombie processes
  - Cleans up test files if needed

### Write Smoke Test

**When** I create `playwright_tests/smoke.spec.js`  
**Then** the file contains a simple smoke test:
```javascript
test('Electron app launches successfully', async ({ electronApp, window }) => {
  // Verify app launched
  expect(electronApp).toBeTruthy();
  
  // Verify window exists
  expect(window).toBeTruthy();
  
  // Verify window title
  const title = await window.title();
  expect(title).toContain('GoSheet');
  
  // Verify grid is visible
  const grid = await window.locator('#spreadsheet-grid');
  await expect(grid).toBeVisible();
});
```

### Verify Test Execution

**When** I run `npx playwright test --list`  
**Then** Playwright discovers the smoke test  
**And** no configuration errors occur

**When** I run `npx playwright test`  
**Then** the smoke test passes  
**And** the Electron app launches  
**And** the test completes successfully  
**And** the app closes cleanly (no zombie processes)  
**And** test output shows 1 passed test

### Document Setup

**When** I update README.md  
**Then** the file includes:
- "Running Tests" section
- Command: `npm test` (runs Playwright Electron tests)
- Command: `npm run test:unit` (runs Go unit tests)
- Prerequisites: Node.js 18+, Go 1.21+
- Note: Tests launch actual Electron app (not browser)

---

## Implementation Notes

### Playwright Electron API

Use the `_electron` module from Playwright:
```javascript
const { _electron: electron } = require('playwright');

const electronApp = await electron.launch({
  args: ['electron/main.js']
});

const window = await electronApp.firstWindow();
```

### Key Differences from Browser Testing

1. **Launch Method:** `_electron.launch()` instead of `browser.newPage()`
2. **No URL Navigation:** App loads automatically, no `page.goto()`
3. **Single Window:** Use `electronApp.firstWindow()` to get main window
4. **IPC Access:** Can test IPC communication via `electronApp.evaluate()`
5. **Serial Execution:** Workers: 1 (Electron apps don't parallelize)

### Test File Structure

```
playwright_tests/
├── fixtures.js          # Shared fixtures (electronApp, window)
├── smoke.spec.js        # This story: basic launch test
├── test_spreadsheet.spec.js  # Story 5.2: ported tests
├── test_file_dialogs.spec.js # Story 5.3: dialog stubbing
└── test_file_operations.spec.js # Story 5.4: file workflows
```

### Dependencies Already Installed

From Epic 3 Story 3.6, package.json already has:
- `@playwright/test`: ^1.49.0
- `electron-playwright-helpers`: ^1.7.1

**Action:** Verify versions are current, update if needed.

---

## Definition of Done

- [x] @playwright/test and electron-playwright-helpers installed
- [x] playwright.config.js created with correct settings
- [x] Test fixtures created (electronApp, window)
- [x] Smoke test written and passes
- [x] `npx playwright test` runs successfully
- [x] No zombie Electron processes after test run
- [ ] README updated with test instructions (deferred to Story 5.6)
- [x] **CRITICAL:** Test actually launches Electron app and verifies it works
- [x] No "infrastructure only" - smoke test must PASS

---

## Testing Strategy

### Manual Verification

1. Run `npm test` - smoke test should pass
2. Check process list - no zombie Electron processes
3. Run test 3 times - should pass consistently (no flakiness)
4. Run with `--headed` - should see Electron window briefly

### Success Criteria

- ✅ Smoke test passes
- ✅ Test output shows "1 passed"
- ✅ No errors in console
- ✅ App launches and closes cleanly
- ✅ Test completes in < 10 seconds

---

## Links & References

**Epic 5 Context:**
- Epic: Playwright Electron Testing (Stories 5.1-5.6)
- Goal: Establish automated testing to prevent Epic 3/4 pattern
- Total Effort: ~24 hours (3 days)

**Related Documents:**
- Epic 3 Retrospective: `epic-3-retro-2026-02-15.md`
- Epic 4 Retrospective: `epic-4-retro-2026-02-15.md`
- Epics Document: `planning-artifacts/epics.md`
- Architecture: `planning-artifacts/architecture.md`

**Playwright Electron Docs:**
- Official API: https://playwright.dev/docs/api/class-electron
- electron-playwright-helpers: https://github.com/spaceagetv/electron-playwright-helpers

---

## Notes

**From Epic 3 Retrospective:**
> "Epic 3 repeated the exact same issue as Epic 4: implementation marked 'done' without integration testing, resulting in 100% failure rate on first use."

**Action Item from Retrospective:**
> "MANDATORY: Integration Testing Before 'Done' - No story marked 'done' until tests pass. This is the ENTIRE POINT of Epic 5."

**This Story's Role:**
Story 5.1 establishes the foundation. Stories 5.2-5.5 build the actual test coverage. Story 5.6 integrates into CI/CD. Together, they prevent the Epic 3/4 pattern from ever happening again.

---

---

## Implementation Summary

**Completed:** 2026-02-15  
**Result:** ✅ All smoke tests passing (2/2 tests, 5.3s)

### What Was Built

1. **Playwright Configuration** (`playwright.config.js`)
   - Test directory: `playwright_tests/`
   - Timeout: 30 seconds
   - Workers: 1 (serial execution)
   - Retries: 2
   - Reporters: list + HTML

2. **Test Fixtures** (`playwright_tests/fixtures.js`)
   - `electronApp` fixture: Launches Electron app via `_electron.launch()`
   - `window` fixture: Gets first window via `firstWindow()`
   - Proper cleanup on test completion

3. **Smoke Tests** (`playwright_tests/smoke.spec.js`)
   - Test 1: "Electron app launches successfully" ✅
     - Verifies app launches
     - Verifies window created
     - Verifies title contains "GoSheet"
     - Verifies spreadsheet grid (#spreadsheet) is visible
     - Verifies cell elements are rendered
   - Test 2: "App has expected UI elements" ✅
     - Verifies formula bar visible
     - Verifies file status visible
     - Verifies New/Load/Save buttons visible

### Version Compatibility

**Final Working Configuration:**
- **Electron:** 30.5.1 (downgraded from 40.4.1)
- **Playwright:** 1.48.2 (downgraded from 1.59.0-alpha)
- **Node.js:** 24.13.1 ARM64 (upgraded from 24.10.0 x64)

**Rationale:**
- Electron 40.x + Playwright 1.59.0-alpha has CDP connection timeout issues
- Electron 30.5.1 + Playwright 1.48.2 is a stable, tested combination
- Known npm audit vulnerabilities accepted (dev/test environment only)

### Critical Discoveries

1. **Node.js Architecture Mismatch**
   - Original: x64 Node.js on ARM64 Mac (Rosetta 2)
   - Fixed: Installed ARM64 Node.js via Homebrew
   - Impact: Electron native modules require matching architecture

2. **Cursor Sandbox Limitation**
   - Cursor's sandbox prevents Electron API injection
   - `require('electron')` returns string path instead of API object
   - Workaround: Run tests in Cursor's terminal (not via AI Shell tool)

3. **Playwright Electron 40 Incompatibility**
   - Issue #39008: Electron 30+ rejects `--remote-debugging-port` CLI flag
   - Fix merged in Playwright 1.59.0-alpha (commit 629c2f0)
   - However: 1.59.0-alpha has CDP connection timeout issues with Electron 40.x
   - Solution: Downgrade to Electron 30.5.1 + Playwright 1.48.2

### Test Results

```
Running 2 tests using 1 worker

  ✓  1 [electron] › smoke.spec.js:8:3 › Electron App Smoke Tests › Electron app launches successfully (3.1s)
  ✓  2 [electron] › smoke.spec.js:33:3 › Electron App Smoke Tests › App has expected UI elements (1.7s)

  2 passed (5.3s)
```

### Files Created

- `playwright.config.js` - Playwright configuration
- `playwright_tests/fixtures.js` - Test fixtures for Electron
- `playwright_tests/smoke.spec.js` - Smoke tests

### Files Modified

- `package.json` - Added test scripts (test:unit, test:all, test:headed, test:debug)
- `electron/main.js` - Moved IPC handlers into `setupIpcHandlers()` function

---

**Story Status:** ✅ Complete  
**Next Story:** 5.2 - Port Existing Playwright Tests to Electron API  
**Blocked By:** None
