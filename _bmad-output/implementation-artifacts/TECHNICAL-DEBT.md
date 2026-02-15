# Technical Debt

This document tracks known technical debt items that should be addressed in future work.

---

## 1. Upgrade Electron to Supported Version

**Status:** Deferred  
**Priority:** Medium  
**Discovered:** 2026-02-15 (Epic 5, Story 5.3)

### Issue

Currently using **Electron 30.5.1** which is EOL (End of Life) and no longer receiving security updates.

### Current Supported Versions (Feb 2026)

- **Electron 40** - Supported until June 30, 2026
- **Electron 39** - Supported until May 5, 2026  
- **Electron 38** - Supported until March 10, 2026
- **Electron 30** - ❌ EOL (unsupported)

### Why We're on 30.5.1

During Story 5.1 implementation, we discovered compatibility issues:
- **Electron 40.4.1 + Playwright 1.59.0-alpha:** CDP (Chrome DevTools Protocol) connection timeout
- `electronApp.firstWindow()` would hang indefinitely
- **Solution:** Downgraded to Electron 30.5.1 + Playwright 1.48.2 (known stable combination)

### Recommended Upgrade Path

1. **Test Electron 38.x + Playwright 1.58.2** (latest stable, released Feb 6, 2026)
   - Electron 38 is supported until March 10, 2026
   - Playwright 1.58.2 is stable (not alpha)
   - Less risky than jumping to Electron 40

2. **If successful, upgrade to Electron 40.x**
   - Longest support window (until June 30, 2026)
   - Latest features and security updates

3. **If unsuccessful, try Electron 39.x**
   - Middle ground between 38 and 40

### Testing Checklist

When upgrading, verify:
- [ ] All 30+ Playwright tests pass
- [ ] Tests run headless (NODE_ENV=test)
- [ ] No CDP connection timeouts
- [ ] `electronApp.firstWindow()` resolves correctly
- [ ] No zombie Electron processes after tests
- [ ] App launches and functions correctly
- [ ] File dialogs work via IPC

### References

- [Story 5.1: Setup Playwright Electron Environment](5-1-setup-playwright-electron-environment.md) - Original version compatibility issues
- [Electron Release Schedule](https://releases.electronjs.org/schedule)
- [Playwright Release Notes](https://playwright.dev/docs/release-notes)

### Estimated Effort

2-4 hours (testing and validation)

---

## 2. Rename Wails-Related Functions and Files

**Status:** Not Started  
**Priority:** Low  
**Discovered:** 2026-02-15 (Epic 6 planning)

### Issue

The codebase contains many functions, files, and identifiers that include "Wails" in their names, despite the project having migrated to Electron in Epic 3.

### Examples of Wails References

**Files:**
- `api_wails.go` - Wails API wrapper (now obsolete)
- `fileservice_wails.go` - Wails file service implementation (now obsolete)

**Functions/Types:**
- `WailsAPI` struct and methods
- `WailsFileService` struct and methods
- Various function comments referencing Wails

### Impact

- **Functional:** None - code works correctly
- **Maintenance:** Confusing for future developers
- **Documentation:** Misleading naming

### Recommended Approach

1. **Identify all Wails references:**
   - Search codebase for "Wails", "wails", "WAILS"
   - Document all files, functions, types, comments

2. **Categorize by action needed:**
   - **Delete:** Obsolete Wails-specific files (api_wails.go, fileservice_wails.go)
   - **Rename:** Functions/types still in use with Wails in name
   - **Update:** Comments and documentation

3. **Execute cleanup:**
   - Remove obsolete files
   - Rename active code
   - Update comments and docs
   - Run all tests to verify no breakage

### Estimated Effort

2-3 hours (search, rename, test)

### References

- Epic 3: Electron Implementation - Migration from Wails to Electron
- [Electron Migration Analysis](../planning-artifacts/electron-migration-analysis.md)

---

## Future Technical Debt Items

Add additional technical debt items here as they are discovered.
