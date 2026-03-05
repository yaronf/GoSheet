---
title: 'Universal macOS Binary'
slug: 'universal-macos-binary'
created: '2026-03-05'
status: 'Implementation Complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Go', 'Electron', 'electron-builder', 'lipo']
files_to_modify: ['Makefile', 'package.json', '_bmad-output/implementation-artifacts/TECHNICAL-DEBT.md']
code_patterns: []
test_patterns: []
---

# Tech-Spec: Universal macOS Binary

**Created:** 2026-03-05

## Overview

### Problem Statement

`npm run build` produces a single-arch Go server binary (arm64 or x64) inside the `.app` bundle. Intel Mac users require a separate download from Apple Silicon users.

### Solution

Use `lipo` to merge the two cross-compiled Go server binaries into a single fat universal binary. Update electron-builder to use a `universal` target and reference the fat binary in `extraResources`.

### Scope

**In Scope:**
- Add `lipo` step to `build-server-universal` in `Makefile`
- Update `package.json` build target to `universal` and point `extraResources` at the fat binary
- Verify with `lipo -info` after build
- Mark tech debt item 2 resolved in `TECHNICAL-DEBT.md`

**Out of Scope:**
- Windows/Linux builds
- Electron version upgrade

## Context for Development

### Codebase Patterns

- Cross-compilation already works: `build-server-arm64` and `build-server-x64` targets exist in Makefile
- `build-server-universal` already runs both; just needs a `lipo` merge step added
- `package.json` `prebuild` already calls `make build-server-universal`
- Current `extraResources` uses `"from": "server/gosheet-server-${arch}"` — works for two-bundle builds but not for a universal target

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `Makefile` | Add `lipo` step to `build-server-universal` |
| `package.json` | Change build target to `universal`, update `extraResources` |
| `_bmad-output/implementation-artifacts/TECHNICAL-DEBT.md` | Mark item 2 resolved |

### Technical Decisions

- `lipo -create -output server/gosheet-server-universal server/gosheet-server-arm64 server/gosheet-server-x64` produces the fat binary
- electron-builder universal target: set `"target": "universal"` (not an arch value — `universal` is a target name in electron-builder, not an architecture)
- `extraResources` entry uses `"from": "server/gosheet-server-universal"` with no arch filter. When building a `universal` target, electron-builder internally builds arm64 and x64 sub-bundles then merges them. During this process it copies `extraResources` into each sub-bundle before merging — providing a fat binary means both sub-bundles get the same file, which is correct. If this causes a "same file in both arches" error from electron-builder, add `"x64ArchFiles": "Contents/Resources/server/gosheet-server"` to the `mac` config as a fallback
- Arch-specific binaries remain as build intermediates, cleaned by `make clean`
- CGO: GoSheet's Go server has no CGO dependencies (`encoding/gob`, `net/http`, etc. are pure Go). Cross-compilation is safe without `CGO_ENABLED=0`, but it can be added for explicitness
- The Makefile has two targets both named `install`: one that runs `npm install` (line 7) and one that installs to `/Applications` (line 89). Task 5 refers to the `/Applications` install target (line 89).

## Implementation Plan

### Tasks

- [x] Task 1: Add `lipo` merge step to `build-server-universal` in `Makefile`
  - File: `Makefile`
  - Action: After the `build-server-x64` dependency, add:
    ```
    @which lipo > /dev/null 2>&1 || (echo "Error: lipo not found. Install Xcode Command Line Tools: xcode-select --install" && exit 1)
    lipo -create -output server/gosheet-server-universal server/gosheet-server-arm64 server/gosheet-server-x64
    ```
  - Notes: Keep the existing `generate`, `build-server-arm64`, `build-server-x64` dependencies unchanged

- [x] Task 2: Add `server/gosheet-server-universal` to `clean` target in `Makefile`
  - File: `Makefile`
  - Action: Append `server/gosheet-server-universal` to the `rm -f` line in the `clean` target

- [x] Task 3: Update electron-builder target to `universal` in `package.json`
  - File: `package.json`
  - Action: In `build.mac.target[0]`, change `"target": "default"` to `"target": "universal"` and remove the `"arch"` array entirely (the `universal` target implies both arches). The result should be:
    ```json
    "target": [
      {
        "target": "universal"
      }
    ]
    ```

- [x] Task 4: Update `extraResources` to reference fat binary in `package.json`
  - File: `package.json`
  - Action: Change the first `extraResources` entry from `"from": "server/gosheet-server-${arch}"` to `"from": "server/gosheet-server-universal"`

- [x] Task 5: Update the `/Applications` install target (line 89 in `Makefile`) to handle `dist/mac-universal/` path
  - File: `Makefile`
  - Action: Update the `APP` variable assignment to check `dist/mac-universal/GoSheet.app` first, then fall back to `dist/mac-arm64/` and `dist/mac/`. Result:
    ```makefile
    APP=$$([ -d "dist/mac-universal/GoSheet.app" ] && echo "dist/mac-universal/GoSheet.app" || \
           ([ -d "dist/mac-arm64/GoSheet.app" ] && echo "dist/mac-arm64/GoSheet.app" || echo "dist/mac/GoSheet.app")); \
    ```
  - Notes: This is the `install:` target at line 89, not the `install:` at line 7 (which runs `npm install`)

- [x] Task 6: Mark tech debt item 2 resolved
  - File: `_bmad-output/implementation-artifacts/TECHNICAL-DEBT.md`
  - Action: Update item 2 status line to `Resolved (2026-03-05)`

### Acceptance Criteria

- [ ] AC1: Given `make build-server-universal` is run, when it completes successfully, then `server/gosheet-server-universal` exists and `lipo -info server/gosheet-server-universal` reports both `x86_64` and `arm64`
- [ ] AC2: Given `npm run build` completes and the app is installed to `/Applications`, when `lipo -info /Applications/GoSheet.app/Contents/Resources/server/gosheet-server` is run, then output reports both `x86_64` and `arm64`
- [ ] AC3: Given `npm run build` completes, when `dist/` is inspected, then there is a single `dist/mac-universal/GoSheet.app` rather than separate arm64/x64 artifacts, and `lipo -info "dist/mac-universal/GoSheet.app/Contents/MacOS/GoSheet"` reports both `x86_64` and `arm64` (confirms the Electron binary itself is universal, not just the Go server)
- [ ] AC4: Given the universal `.app` is installed on Apple Silicon, when the app is launched natively, then it opens, loads files, and performs calculations correctly
- [ ] AC5: Given the universal `.app` is installed on Apple Silicon, when `arch -x86_64 /Applications/GoSheet.app/Contents/Resources/server/gosheet-server --help` is run (Rosetta 2 emulation), then the binary executes without crashing (validates x86_64 slice)
- [ ] AC6: Given `make clean` is run, when it completes, then `server/gosheet-server-universal` is removed alongside the arch-specific binaries

## Additional Context

### Dependencies

- `lipo` is a standard macOS developer tool (Xcode Command Line Tools), no installation needed

### Testing Strategy

- Run `make build-server-universal` and verify fat binary with `lipo -info server/gosheet-server-universal`
- Run `npm run build` and verify `dist/mac-universal/GoSheet.app` exists (single artifact)
- Run `make install` and verify it installs correctly
- Smoke-test native (arm64): open file, edit cell, save
- Smoke-test x86_64 slice via Rosetta: `arch -x86_64 /Applications/GoSheet.app/Contents/Resources/server/gosheet-server --help`

### Notes

- If electron-builder's `universal` target causes issues, fallback is `"target": "default", "arch": ["arm64", "x64"]` with `${arch}` substitution in `extraResources` (two-bundle approach, already working)
- The Makefile has a naming collision: two targets called `install`. This is a pre-existing defect; do not fix it in this spec, just be aware of it
- Universal `.app` will be larger than a single-arch build (includes both arm64 and x86_64 slices) — this is an intentional tradeoff for single-download convenience
