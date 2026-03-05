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

### Benefits of Upgrading

- **Security:** Receive security patches and updates
- **New APIs:** Access to `app.getRecentDocuments()` (added in v36+) needed for Story 7.6 Dock Integration
- **Bug fixes:** Numerous stability improvements
- **Future compatibility:** Stay on supported versions

### Recommended Upgrade Path

1. **Test Electron 38.x + Playwright 1.58.2** (latest stable, released Feb 6, 2026)
   - Electron 38 is supported until March 10, 2026
   - Playwright 1.58.2 is stable (not alpha)
   - Less risky than jumping to Electron 40
   - Includes `app.getRecentDocuments()` API

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
- [ ] `app.getRecentDocuments()` API is available
- [ ] Story 7.6 (Dock Integration) can be unblocked

### References

- [Story 5.1: Setup Playwright Electron Environment](5-1-setup-playwright-electron-environment.md) - Original version compatibility issues
- [Electron Release Schedule](https://releases.electronjs.org/schedule)
- [Playwright Release Notes](https://playwright.dev/docs/release-notes)

### Estimated Effort

2-4 hours (testing and validation)

---

## 2. Rename Wails-Related Functions and Files

**Status:** Resolved (Epics 9 & 10)
**Priority:** Low
**Discovered:** 2026-02-15 (Epic 6 planning)

All Wails-related files and identifiers have been removed from the Go source code. Only historical references remain in `_bmad-output/` planning documents.

---

## 3. Build Universal macOS Executable

**Status:** Resolved (Story 10.9)  
**Priority:** Medium  
**Discovered:** 2026-02-16 (Post Epic 6)

### Issue

The current build process fails when creating a universal macOS binary (x64 + arm64) because the Go server binary is architecture-specific but electron-builder expects it to be different for each architecture.

### Current Behavior

When running `npm run build`, electron-builder attempts to create a universal binary but fails with:

```
⨯ Detected file "Contents/Resources/server/gosheet-server" that's the same 
  in both x64 and arm64 builds and not covered by the x64ArchFiles rule: "undefined"
```

### Current Workaround

Build for a single architecture only:
```bash
npx electron-builder --mac --arm64  # For Apple Silicon
npx electron-builder --mac --x64    # For Intel Macs
```

The arm64 build succeeds and is usable on Apple Silicon Macs, but we cannot distribute a single universal binary that works on both architectures.

### Root Cause

1. The Go server (`server/gosheet-server`) is compiled for the host architecture only
2. electron-builder expects different binaries for x64 and arm64 when creating a universal build
3. We're providing the same binary for both architectures, which electron-builder rejects

### Recommended Solution

**Option 1: Build separate Go binaries for each architecture**

1. Cross-compile Go server for both architectures:
   ```bash
   # Build for arm64
   GOOS=darwin GOARCH=arm64 go build -o server/gosheet-server-arm64 ./server
   
   # Build for x64
   GOOS=darwin GOARCH=amd64 go build -o server/gosheet-server-x64 ./server
   ```

2. Update `package.json` to include both binaries:
   ```json
   "extraResources": [
     {
       "from": "server/gosheet-server-arm64",
       "to": "server/gosheet-server",
       "filter": ["**/*"],
       "arch": ["arm64"]
     },
     {
       "from": "server/gosheet-server-x64",
       "to": "server/gosheet-server",
       "filter": ["**/*"],
       "arch": ["x64"]
     }
   ]
   ```

3. Update Makefile to build both architectures

**Option 2: Configure x64ArchFiles rule**

Add configuration to tell electron-builder that the Go server is intentionally the same:
```json
"mac": {
  "x64ArchFiles": "Contents/Resources/server/gosheet-server"
}
```

However, this may not work correctly as the binary would still be wrong for one architecture.

**Recommended:** Option 1 (cross-compile separate binaries)

### Impact

- **Functional:** App works fine on single architecture
- **Distribution:** Cannot provide universal binary for users
- **User Experience:** Intel Mac users need separate download from Apple Silicon users

### Estimated Effort

2-3 hours (cross-compilation setup, testing on both architectures)

### References

- electron-builder universal build documentation
- Go cross-compilation guide

---

## Future Technical Debt Items

Add additional technical debt items here as they are discovered.
