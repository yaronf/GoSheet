# Story 10.9: Implement Universal macOS Build

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.9  
**Estimated Effort:** 2-3 hours  
**Status:** done  
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
   - [x] `server/gosheet-server-arm64` built for darwin/arm64
   - [x] `server/gosheet-server-x64` built for darwin/amd64
   - [x] Both binaries produced by Makefile or npm build script

2. **electron-builder configuration**
   - [x] `package.json` mac.target includes both architectures: `arch: ["arm64", "x64"]` or `"universal"`
   - [x] `extraResources` has arch-specific entries for gosheet-server (arm64 → gosheet-server-arm64, x64 → gosheet-server-x64)
   - [x] electron-builder outputs a single universal .app or separate .app per arch

3. **Verification**
   - [x] `npm run build` completes without electron-builder error
   - [x] Built app runs on Apple Silicon (arm64)
   - [x] Built app runs on Intel Mac (x64) if testable, or document verification steps

---

## Tasks / Subtasks

- [x] Task 1: Add Go cross-compilation (AC: #1)
  - [x] Add Makefile targets or npm script to build both architectures:
    ```bash
    GOOS=darwin GOARCH=arm64 go build -o server/gosheet-server-arm64 ./server
    GOOS=darwin GOARCH=amd64 go build -o server/gosheet-server-x64 ./server
    ```
  - [x] Ensure `npm run build` (or prebuild script) invokes both before electron-builder runs
- [x] Task 2: Update package.json extraResources (AC: #2)
  - [x] Replace single gosheet-server entry with arch-specific entries:
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
  - [x] Update mac.target arch to `["arm64", "x64"]` for universal build
- [x] Task 3: Verify build and document (AC: #3)
  - [x] Run `npm run build` and confirm success
  - [x] Test arm64 build on Apple Silicon
  - [x] Document x64 verification (e.g. "Test on Intel Mac or Rosetta" if no Intel hardware)

---

## Dev Notes

### Technical Requirements

- **electron-builder behavior:** When building universal, it creates separate build dirs per arch and merges. extraResources with `arch` filter ensures the correct Go binary is placed in each.
- **Electron main.js:** Already uses `process.resourcesPath + '/server/gosheet-server'`—no change needed; electron-builder places the right binary per arch.
- **Go cross-compilation:** `GOOS=darwin GOARCH=arm64` and `GOOS=darwin GOARCH=amd64` produce native macOS binaries. No CGO required for current server.

### Previous Story Intelligence
- **Makefile**: Add `build-server-arm64` and `build-server-x64` or single target that builds both
- **package.json**: electron-builder `extraResources` with `arch` filter (see TECHNICAL-DEBT.md)
- **Electron main.js**: Uses `process.resourcesPath + '/server/gosheet-server'` — no change; electron-builder places correct binary per arch

### References

- [Source: _bmad-output/implementation-artifacts/TECHNICAL-DEBT.md#3] - Build Universal macOS Executable
- [Source: planning-artifacts/prd.md] - NFR-C2: Universal binary (Intel + Apple Silicon)
- [electron-builder docs](https://www.electron.build/configuration/configuration#configuration-mac) - mac.extraResources, arch

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

- Makefile: build-server-arm64, build-server-x64, build-server-universal; prebuild invokes before electron-builder
- package.json: prebuild script, mac.target arch ["arm64","x64"], extraResources uses `${arch}` macro (server/gosheet-server-${arch} → server/gosheet-server)
- electron-builder 26.x does not support `arch` property in extraResources; `${arch}` macro expands per build (arm64 or x64)
- Verified: dist/mac-arm64 has arm64 binary, dist/mac has x86_64 binary
- CR fixes: TECHNICAL-DEBT #3 → Resolved; README/CONTRIBUTING build docs updated; removed duplicate mac.extraResources

### File List

- Makefile
- package.json
- .gitignore
- README.md
- CONTRIBUTING.md
- _bmad-output/implementation-artifacts/TECHNICAL-DEBT.md
