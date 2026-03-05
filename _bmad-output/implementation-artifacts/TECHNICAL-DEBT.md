# Technical Debt

This document tracks known technical debt items that should be addressed in future work.

---

## 1. Upgrade Electron to Supported Version

**Status:** Deferred
**Priority:** High (security)
**Discovered:** 2026-02-15 (Epic 5, Story 5.3)

Currently on **Electron 30.5.1** (EOL). Blocked by Playwright CDP compatibility: Electron 40+ causes `electronApp.firstWindow()` to hang. The known stable combo is Electron 30.5.1 + Playwright 1.48.2.

**Upgrade path:** Test Electron 38+ with the latest stable Playwright. When working, also unlocks `app.getRecentDocuments()` for Story 7.6 (Dock Integration).

**Checklist:** All Playwright tests pass, no CDP timeouts, file dialogs work, no zombie processes.

---

## 2. Build Universal macOS Executable

**Status:** Deferred
**Priority:** Low
**Discovered:** 2026-02-16 (Post Epic 6)

Single-arch builds work (`npx electron-builder --mac --arm64`). A universal binary requires cross-compiling the Go server for both arm64 and amd64 and configuring `extraResources` in `package.json` with per-arch entries. Estimated 2-3 hours.

---

## Future Technical Debt Items

Add additional technical debt items here as they are discovered.
