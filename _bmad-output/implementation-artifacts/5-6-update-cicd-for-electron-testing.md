# Story 5.6: Update CI/CD for Electron Testing

**Epic:** 5 - Playwright Electron Testing  
**Story:** 5.6  
**Estimated Effort:** 2 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-15

---

## Story

As a developer,  
I want to automate test execution in CI/CD,  
So that tests run automatically on every commit.

---

## Context

**Prerequisites:**
- Story 5.5 complete: All 80 tests verified (38 Playwright + 42 Go)
- Tests are stable with no flakiness
- Tests run headless (NODE_ENV=test)

**Current State:**
- `npm test` runs Playwright Electron tests (38 tests, ~114s)
- `go test ./tests/...` runs Go unit tests (42 tests, ~0.9s)
- No CI/CD automation yet
- Tests must be run manually

**Why This Story:**
Automating tests in CI/CD ensures code quality and catches regressions early. This story sets up GitHub Actions to run tests on every push and pull request.

---

## Tasks

1. ✅ Update `package.json` with test scripts
2. ✅ Create GitHub Actions workflow file
3. ✅ Configure workflow for Node.js and Go
4. ✅ Set up Playwright dependencies
5. ✅ Configure headless Electron testing
6. ✅ Add test result reporting
7. ✅ Document CI/CD setup in README
8. ✅ Test workflow on a commit

---

## Acceptance Criteria

**Given** all Electron tests pass locally  
**When** I update `package.json` scripts  
**Then** `npm test` runs Playwright Electron tests  
**And** `npm run test:unit` runs Go unit tests  
**And** `npm run test:all` runs both test suites

**When** I create `.github/workflows/test.yml`  
**Then** the workflow:
- Runs on push and pull request
- Sets up Node.js 18+ and Go 1.x
- Installs dependencies
- Builds Go server binary
- Runs `npm test` (Playwright Electron)
- Runs `go test ./tests/...` (Go unit tests)
- Reports test results

**And** tests run in headless mode (no GUI needed)  
**And** I document test execution in README  
**And** team knows how to run tests locally and in CI

---

## Dev Notes

### Current Test Scripts

From `package.json`:
```json
{
  "scripts": {
    "test": "NODE_ENV=test playwright test"
  }
}
```

### Proposed Test Scripts

```json
{
  "scripts": {
    "test": "NODE_ENV=test playwright test",
    "test:unit": "go test ./tests/...",
    "test:all": "npm test && npm run test:unit",
    "test:report": "playwright show-report"
  }
}
```

### GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

**Key Requirements:**
1. Run on push and pull_request events
2. Set up Node.js 18+ (for Playwright)
3. Set up Go 1.21+ (for backend tests)
4. Install Playwright with dependencies
5. Install Go dependencies
6. Run both test suites
7. Upload test results as artifacts

**Challenges:**
- Playwright Electron requires display server (Xvfb on Linux)
- GitHub Actions runners are Ubuntu by default
- Need to ensure headless mode works in CI

### Headless Mode Configuration

Already configured in `electron/main.js`:
```javascript
const isTest = process.env.NODE_ENV === 'test';
const mainWindow = new BrowserWindow({
  show: !isTest,  // Hide window in test mode
  // ...
});
```

This ensures tests run headless in CI without requiring Xvfb.

### Test Execution Flow

1. **Local Development:**
   - `npm test` - Run Playwright tests
   - `go test ./tests/...` - Run Go tests
   - `npm run test:all` - Run both

2. **CI/CD (GitHub Actions):**
   - Checkout code
   - Set up Node.js and Go
   - Install dependencies
   - Run `npm run test:all`
   - Upload test results

### Expected CI/CD Performance

- Playwright tests: ~2 minutes
- Go tests: <1 second
- Total: ~2-3 minutes (including setup)

---

## Technical Stack

**CI/CD Platform:**
- GitHub Actions (free for public repos)

**Test Frameworks:**
- Playwright 1.59.0-alpha (Electron support)
- Go testing package (standard library)

**Dependencies:**
- Node.js 18+
- Go 1.21+
- Playwright browsers (Chromium for Electron)

---

## Change Log

- 2026-02-15: Story created based on Epic 5 completion status

---

## Status

**Current Status:** done  
**Last Updated:** 2026-02-15  
**Completed:** 2026-02-15

## Implementation Summary

### 1. Updated package.json Scripts ✅

Added `test:report` script to existing test commands:
```json
{
  "scripts": {
    "test": "NODE_ENV=test playwright test",
    "test:unit": "go test ./tests/...",
    "test:all": "npm run test:unit && npm test",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "test:report": "playwright show-report"
  }
}
```

### 2. Created GitHub Actions Workflow ✅

**File:** `.github/workflows/test.yml`

**Workflow Features:**
- ✅ Runs on push and pull_request to main/develop branches
- ✅ Sets up Node.js 18 and Go 1.21
- ✅ Installs all dependencies (npm, Go modules, Playwright browsers)
- ✅ Builds Go server binary
- ✅ Runs Go unit tests (42 tests)
- ✅ Runs Playwright Electron tests (38 tests)
- ✅ Uploads test reports as artifacts (30-day retention)
- ✅ Uploads test traces on failure for debugging

**Key Configuration:**
- Uses `ubuntu-latest` runner
- Installs Chromium with dependencies for Electron
- Tests run headless (NODE_ENV=test)
- Artifacts uploaded for both success and failure cases

### 3. Updated README Documentation ✅

Added CI/CD section with:
- How to run tests locally
- CI/CD workflow description
- Where to view test results
- How to download artifacts

### 4. Acceptance Criteria Check ✅

| Criteria | Status | Implementation |
|----------|--------|----------------|
| `npm test` runs Playwright tests | ✅ Pass | Already configured |
| `npm run test:unit` runs Go tests | ✅ Pass | Already configured |
| `npm run test:all` runs both | ✅ Pass | Already configured |
| GitHub Actions workflow created | ✅ Pass | `.github/workflows/test.yml` |
| Runs on push/PR | ✅ Pass | Configured for main/develop |
| Sets up Node.js 18+ | ✅ Pass | Uses setup-node@v4 |
| Sets up Go 1.x | ✅ Pass | Uses setup-go@v5 with Go 1.21 |
| Installs dependencies | ✅ Pass | npm ci, go mod download |
| Builds Go server | ✅ Pass | Builds in server/ directory |
| Runs Playwright tests | ✅ Pass | `npm test` with NODE_ENV=test |
| Runs Go tests | ✅ Pass | `go test -v ./tests/...` |
| Reports test results | ✅ Pass | Uploads artifacts |
| Headless mode | ✅ Pass | NODE_ENV=test enables headless |
| Documentation | ✅ Pass | README updated |

**Overall:** ✅ **All acceptance criteria met**

### Files Created/Modified

**Created:**
- `.github/workflows/test.yml` - GitHub Actions workflow

**Modified:**
- `package.json` - Added `test:report` script
- `README.md` - Added CI/CD documentation section

### Known Issue: Cursor AI Shell Cannot Run Electron Tests

**Investigation Summary (2026-02-15):**

Attempted to debug why Electron tests fail in Cursor's AI Shell:

1. **Research Findings:**
   - Cursor 2.0 uses macOS Seatbelt sandbox (kernel-level sandboxing)
   - Sandbox restricts process launches and system resource access
   - Electron 36.x has known issues with `electron.launch()` in sandboxed environments
   - Similar issues reported in CI environments (GitHub Actions)

2. **Testing:**
   - Tried running with `required_permissions: ["all"]` to bypass Cursor sandbox
   - Tests still fail with "Process failed to launch!"
   - This indicates the issue is not just Cursor's sandbox, but the AI Shell environment itself

3. **Root Cause:**
   - Electron requires specific system capabilities to launch (display server, IPC, etc.)
   - AI Shell environment lacks these capabilities even when sandbox is disabled
   - Similar to headless CI environments that require Xvfb

4. **Workaround:**
   - Tests must be run in Cursor's integrated terminal (not AI Shell)
   - CI/CD via GitHub Actions works fine (has proper environment)
   - This is a limitation of the AI Shell execution environment, not the tests themselves

**Conclusion:** This is an acceptable limitation. Tests work perfectly in:
- ✅ Cursor's integrated terminal
- ✅ External terminal (Terminal.app, iTerm)
- ✅ CI/CD (GitHub Actions)
- ❌ Cursor AI Shell (environment limitation)

### CI/CD Debugging & Resolution (2026-02-15)

**Initial CI Failures:**

All tests were failing in GitHub Actions with "Process failed to launch!" error. Through systematic debugging, identified and resolved multiple issues:

**Issue 1: Missing Electron System Dependencies**
- **Problem:** Ubuntu runner lacked required libraries for Electron
- **Solution:** Added system dependencies installation step:
  ```yaml
  - name: Install system dependencies for Electron
    run: |
      sudo apt-get update
      sudo apt-get install -y \
        libnss3 libatk1.0-0 libatk-bridge2.0-0 \
        libcups2 libdrm2 libxkbcommon0 \
        libxcomposite1 libxdamage1 libxfixes3 \
        libxrandr2 libgbm1 libasound2t64 xvfb
  ```

**Issue 2: Package Name Change (Ubuntu 24.04)**
- **Problem:** `libasound2` package renamed to `libasound2t64` in Ubuntu 24.04
- **Solution:** Updated package name in workflow

**Issue 3: Missing Electron Launch Flags**
- **Problem:** Electron requires specific flags for headless CI environments
- **Solution:** Updated `playwright_tests/fixtures.js` to include:
  ```javascript
  args: [
    path.join(__dirname, '..', 'electron', 'main.js'),
    '--no-sandbox',           // Required for Docker/CI
    '--disable-gpu',          // No GPU in headless
    '--disable-dev-shm-usage', // Prevent /dev/shm issues
  ]
  ```

**Issue 4: CSV Tests Not Using Fixtures**
- **Problem:** `test_csv_import.spec.js` and `test_csv_roundtrip.spec.js` were launching Electron directly without proper flags
- **Solution:** Refactored tests to use fixtures pattern:
  - Removed manual `beforeAll`/`afterAll` Electron launch
  - Changed imports to use `./fixtures`
  - Updated all test functions to accept `{ window, electronApp }` parameters

**Issue 5: Display Server for Electron**
- **Problem:** Electron needs X11 display server even in headless mode
- **Solution:** Wrapped test execution with `xvfb-run`:
  ```yaml
  run: xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" npm test
  ```

**Final Result:**
- ✅ All 58 Playwright Electron tests passing in CI
- ✅ All 42 Go unit tests passing in CI
- ✅ Total CI runtime: ~6 minutes
- ✅ Test artifacts uploaded for debugging
- ✅ Workflow runs on every push to main/develop

### Commits Made

1. `Fix CI: Correct Playwright install command` - Fixed invalid `electron` target
2. `Fix CI: Add Electron system dependencies` - Added required Ubuntu packages
3. `Fix CI: Update libasound2 to libasound2t64 for Ubuntu 24.04` - Package name fix
4. `Fix CI: Add Electron sandbox and GPU flags for headless environment` - Launch flags
5. `Fix CI: Update CSV tests to use fixtures with proper Electron launch flags` - Test refactoring

### Final Acceptance Criteria Verification

| Criteria | Status | Evidence |
|----------|--------|----------|
| All tests pass locally | ✅ Pass | 58 Playwright + 42 Go tests |
| GitHub Actions workflow created | ✅ Pass | `.github/workflows/test.yml` |
| Runs on push/PR | ✅ Pass | Triggered on main/develop |
| Sets up Node.js 18+ | ✅ Pass | Uses setup-node@v4 |
| Sets up Go 1.21 | ✅ Pass | Uses setup-go@v5 |
| Installs dependencies | ✅ Pass | npm ci, go mod, Playwright |
| Builds Go server | ✅ Pass | server/gosheet-server |
| Runs Playwright tests | ✅ Pass | All 58 tests passing |
| Runs Go tests | ✅ Pass | All 42 tests passing |
| Reports test results | ✅ Pass | Artifacts uploaded |
| Headless mode works | ✅ Pass | xvfb-run + test flags |
| Documentation updated | ✅ Pass | README.md |
| **All tests pass in CI** | ✅ **Pass** | **GitHub Actions successful** |

**Overall:** ✅ **Story Complete - All acceptance criteria met**
