# Story 10.9: Implement Universal macOS Build

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.9  
**Estimated Effort:** 2-3 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-17

---

## Story

As a developer or distributor,  
I want a single universal macOS binary (Intel + Apple Silicon),  
So that users on either architecture can use the same download and the app satisfies NFR-C2.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron app builds for arm64
- Go server builds and runs correctly

**Current State:**
- `package.json` mac target uses `arch: ["arm64"]` only
- Go server is built for host architecture only (`go build -o server/gosheet-server ./server`)
- electron-builder fails when creating universal build: "Detected file ... that's the same in both x64 and arm64 builds"
- NFR-C2 requires Universal binary (Intel + Apple Silicon)

**Why This Story:**
electron-builder expects different Go binaries for each architecture when building universal. We must cross-compile the Go server for both arm64 and x64, then configure extraResources with arch-specific entries.

---

## Acceptance Criteria

1. **Cross-compiled Go binaries**
   - [ ] `server/gosheet-server-arm64` built for darwin/arm64
   - [ ] `server/gosheet-server-x64` built for darwin/amd64
   - [ ] Both binaries produced by Makefile or npm build script

2. **electron-builder configuration**
   - [ ] `package.json` mac.target includes both architectures: `arch: ["arm64", "x64"]` or `"universal"`
   - [ ] `extraResources` has arch-specific entries for gosheet-server (arm64 → gosheet-server-arm64, x64 → gosheet-server-x64)
   - [ ] electron-builder outputs a single universal .app or separate .app per arch

3. **Verification**
   - [ ] `npm run build` completes without electron-builder error
   - [ ] Built app runs on Apple Silicon (arm64)
   - [ ] Built app runs on Intel Mac (x64) if testable, or document verification steps

---

## Tasks / Subtasks

- [ ] Task 1: Add Go cross-compilation (AC: #1)
  - [ ] Add Makefile targets or npm script to build both architectures:
    ```bash
    GOOS=darwin GOARCH=arm64 go build -o server/gosheet-server-arm64 ./server
    GOOS=darwin GOARCH=amd64 go build -o server/gosheet-server-x64 ./server
    ```
  - [ ] Ensure `npm run build` (or prebuild script) invokes both before electron-builder runs
- [ ] Task 2: Update package.json extraResources (AC: #2)
  - [ ] Replace single gosheet-server entry with arch-specific entries:
    ```json
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
    ```
  - [ ] Update mac.target arch to `["arm64", "x64"]` for universal build
- [ ] Task 3: Verify build and document (AC: #3)
  - [ ] Run `npm run build` and confirm success
  - [ ] Test arm64 build on Apple Silicon
  - [ ] Document x64 verification (e.g. "Test on Intel Mac or Rosetta" if no Intel hardware)

---

## Dev Notes

### Technical Requirements

- **electron-builder behavior:** When building universal, it creates separate build dirs per arch and merges. extraResources with `arch` filter ensures the correct Go binary is placed in each.
- **Electron main.js:** Already uses `process.resourcesPath + '/server/gosheet-server'`—no change needed; electron-builder places the right binary per arch.
- **Go cross-compilation:** `GOOS=darwin GOARCH=arm64` and `GOOS=darwin GOARCH=amd64` produce native macOS binaries. No CGO required for current server.

### References

- [Source: _bmad-output/implementation-artifacts/TECHNICAL-DEBT.md#3] - Build Universal macOS Executable
- [Source: planning-artifacts/prd.md] - NFR-C2: Universal binary (Intel + Apple Silicon)
- [electron-builder docs](https://www.electron.build/configuration/configuration#configuration-mac) - mac.extraResources, arch

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled by dev agent)
