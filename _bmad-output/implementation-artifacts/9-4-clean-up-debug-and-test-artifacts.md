# Story 9.4: Clean Up Debug and Test Artifacts

**Epic:** 9 - Documentation & Project Cleanup  
**Story:** 9.4  
**Estimated Effort:** 30 minutes  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As a developer,  
I want debug scripts and test artifacts removed,  
So that the repository only contains production-ready code.

---

## Context

**Prerequisites:**
- Epic 5 complete: Playwright Electron testing infrastructure finalized
- Story 5.6 complete: CI/CD pipeline working

**Current State:**
- Repository contains debug scripts from Epic 5 investigation:
  - `debug_app_ui.py`, `debug_app_ui2.py`, `debug_app_ui3.py`
  - `debug_pyax.py`, `debug_pyax2.py`
  - `test_file_dialog_manual.py`
- Old test scripts from Wails era:
  - `test.sh`, `test-electron-launch.sh`, `run_native_tests.sh`
- Multiple old virtual environments:
  - `venv/`, `venv-native-tests/`, `.venv/`, `.venv-native-tests/`
- Obsolete requirements files:
  - `requirements-native.txt`, `requirements-native-tests.txt`
- Test artifacts that regenerate:
  - `test_data.csv`, `test-results/`, `playwright-report/`
- `.pytest_cache/` not in `.gitignore`

**Why This Story:**
These debug scripts and artifacts were useful during development but are no longer needed. They clutter the repository and confuse contributors. Removing them creates a clean, professional codebase ready for release.

---

## Acceptance Criteria

**Given** the testing infrastructure is finalized  
**When** I review the project files  
**Then** the following debug files are deleted:
- `debug_app_ui.py`, `debug_app_ui2.py`, `debug_app_ui3.py`
- `debug_pyax.py`, `debug_pyax2.py`
- `test_file_dialog_manual.py`

**And** the following old test scripts are deleted:
- `test.sh`
- `test-electron-launch.sh`
- `run_native_tests.sh`

**And** the following old virtual environments are deleted:
- `venv/`
- `venv-native-tests/`
- `.venv/`
- `.venv-native-tests/`

**And** obsolete requirements files are deleted:
- `requirements-native.txt`
- `requirements-native-tests.txt`

**And** test artifacts are deleted:
- `test_data.csv`
- `test-results/` (if not needed for CI)
- `playwright-report/` (if not needed for CI)

**And** `.pytest_cache/` is added to `.gitignore`  
**And** only production-ready test infrastructure remains

---

## Technical Requirements

### Files to Delete

```bash
# Debug scripts (Epic 5 investigation)
rm debug_app_ui.py
rm debug_app_ui2.py
rm debug_app_ui3.py
rm debug_pyax.py
rm debug_pyax2.py
rm test_file_dialog_manual.py

# Old test scripts (Wails era)
rm test.sh
rm test-electron-launch.sh
rm run_native_tests.sh

# Old virtual environments
rm -rf venv/
rm -rf venv-native-tests/
rm -rf .venv/
rm -rf .venv-native-tests/

# Obsolete requirements files
rm requirements-native.txt
rm requirements-native-tests.txt

# Test artifacts (regenerate on each run)
rm test_data.csv
rm -rf test-results/
rm -rf playwright-report/
rm -rf .pytest_cache/
```

### .gitignore Updates

Add these patterns to prevent future clutter:

```gitignore
# Python
.venv/
venv/
*.pyc
__pycache__/
.pytest_cache/

# Test artifacts
test-results/
playwright-report/
test_data.csv

# Debug scripts
debug_*.py
test_*_manual.py
```

### Production-Ready Test Infrastructure

**Keep these:**
- `playwright_tests/` - Production test suite
- `tests/` - Go unit tests
- `playwright.config.js` - Playwright configuration
- `.github/workflows/test.yml` - CI/CD pipeline
- `package.json` test scripts
- `Makefile` test targets

---

## Implementation Tasks

1. ✅ Review each file to confirm it's safe to delete
2. ✅ Delete debug scripts
3. ✅ Delete old test scripts
4. ✅ Delete old virtual environments
5. ✅ Delete obsolete requirements files
6. ✅ Delete test artifacts
7. ✅ Update .gitignore
8. ✅ Verify tests still run
9. ✅ Verify CI/CD still works
10. ✅ Commit changes

---

## Dev Notes

### Why These Files Were Created

**Debug Scripts (Epic 5):**
- Created during pyax investigation
- Used to test macOS Accessibility API
- Used to debug WebView access issues
- No longer needed after Electron migration

**Old Test Scripts:**
- `test.sh`: Original Wails test runner
- `test-electron-launch.sh`: Early Electron testing
- `run_native_tests.sh`: pyax test runner
- All replaced by `npm test` and CI/CD

**Virtual Environments:**
- Created for pyax testing (Python)
- No longer needed (Playwright uses Node.js)

**Requirements Files:**
- `requirements-native.txt`: pyax dependencies
- `requirements-native-tests.txt`: pyax test dependencies
- No longer needed (no Python in production)

### Safety Check

Before deleting virtual environments, verify no active processes:

```bash
# Check for Python processes
ps aux | grep python

# Deactivate if in a venv
deactivate
```

### Test Artifacts

These directories regenerate on each test run:
- `test-results/` - Playwright test results
- `playwright-report/` - HTML test report
- `.pytest_cache/` - pytest cache

Safe to delete and add to `.gitignore`.

---

## Testing Strategy

### Manual Testing

1. **File Deletion:**
   - Verify each file/directory is deleted
   - Use `git status` to confirm deletions
   - Use `ls -la` to verify they're gone

2. **Test Verification:**
   - Run `npm test` - should pass
   - Run `npm run test:all` - should pass
   - Verify no errors about missing files

3. **CI/CD Verification:**
   - Push changes to GitHub
   - Verify GitHub Actions workflow succeeds
   - Check that test reports are still generated

4. **Development Workflow:**
   - Run tests locally
   - Verify test reports generate correctly
   - Verify no broken dependencies

### Automated Testing

No new tests needed, but verify existing tests pass:

```bash
# Run all tests
npm run test:all

# Verify CI/CD
git push
# Check GitHub Actions tab
```

---

## References

- [Story 5.6](5-6-update-cicd-for-electron-testing.md) - CI/CD setup
- [Epic 5 Findings](epic-5-findings-wails-webview-testing-limits.md) - Why pyax was abandoned
- `.gitignore` - Current ignore patterns

---

## Change Log

- 2026-02-16: Story created to clean up debug scripts and test artifacts

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16

Cleanup task to remove debug scripts and test artifacts.
