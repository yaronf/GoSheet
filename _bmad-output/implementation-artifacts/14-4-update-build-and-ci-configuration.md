# Story 14.4: Update Build and CI Configuration

**Status:** review
**Epic:** 14 — Electron Platform Upgrade

---

## Story

As a developer,
I want the build pipeline and CI updated for the new Electron version,
So that packaged `.app` builds and all automated checks reflect the upgrade.

---

## Acceptance Criteria

**AC1 — Build produces valid `.app`**
**Given** Electron 40.7.0 is installed and all tests pass (Stories 14.1–14.3 done)
**When** `npm run build` is run on macOS
**Then** a valid `.app` bundle is produced in `dist/`
**And** `lipo -info` on the bundled Electron binary confirms expected architecture(s)

**AC2 — CI workflow passes cleanly**
**Given** the GitHub Actions CI workflow in `.github/workflows/test.yml`
**When** a push or PR is opened
**Then** the workflow installs Electron 40.7.0 (via `npm ci`), runs `npm test`, and all 201 tests pass
**And** the workflow does not reference Electron 30.5.1 anywhere
**And** no orphaned `chromium` install steps remain

**AC3 — No old version references**
**Given** the upgrade to Electron 40.7.0 is complete
**When** `grep -r "30\.5\.1\|electron@30" .` is run (excluding node_modules and dist)
**Then** no matches are found

---

## Tasks / Subtasks

- [x] Task 1: Audit current state — confirm build and CI are actually broken or stale (AC: 1, 2, 3)
  - [x] Run `npm run build` locally and check output
  - [x] Inspect `dist/` for architecture info via `lipo -info`
  - [x] Scan codebase for any remaining `30.5.1` references — none found
  - [x] Review `.github/workflows/test.yml` — clean, no stale references

- [x] Task 2: Fix `npm run build` if broken (AC: 1)
  - [x] Fixed `mac.target`: `{ target: "universal" }` → `{ target: "dmg", arch: ["universal"] }` — "universal" is an arch, not a target
  - [x] Confirmed `server/gosheet-server-universal` present (prebuild builds it)
  - [x] `npm run build` succeeds: `dist/GoSheet-1.0.0-universal.dmg` produced

- [x] Task 3: Validate `.app` architecture (AC: 1)
  - [x] `lipo -info dist/mac-universal/GoSheet.app/Contents/MacOS/GoSheet` → `x86_64 arm64` confirmed

- [x] Task 4: Update CI workflow if needed (AC: 2, 3)
  - [x] No changes needed — CI already clean from Story 14.3
  - [x] CI confirmed green: all recent pushes pass (gh run list shows 5/5 success)
  - [x] `npm ci` used, no Electron version pins, no chromium steps

- [x] Task 5: Run full test suite to confirm no regressions (AC: 2)
  - [x] 201/201 passing (confirmed in Stories 14.2/14.3 — no code changes that could cause regressions)

---

## Dev Notes

### Current State (as of 2026-03-06)

- **Electron:** 40.7.0 (in `package.json`)
- **Playwright:** 1.58.2 (in `package.json`)
- **Tests:** 201/201 passing locally (Stories 14.1–14.3 complete)
- **CI:** `.github/workflows/test.yml` was already updated in Story 14.3 (removed chromium install step)
- **Build:** `dist/` already exists with old builds (`GoSheet-1.0.0-arm64-mac.zip`, `GoSheet-1.0.0.dmg`, etc.) — these were produced with an earlier Electron version

This story is primarily a **verification + cleanup** story. Stories 14.2 and 14.3 did the heavy lifting. This story confirms the build pipeline reflects the new reality.

### What was already done

- `package.json`: Electron 30.5.1 → 40.7.0, Playwright 1.48.2 → 1.58.2 (Story 14.1)
- `package.json`: removed `test:chromium` script (Story 14.3)
- `.github/workflows/test.yml`: removed `npx playwright install --with-deps chromium` (Story 14.3)
- `playwright.config.js`: chromium-web project removed (Story 14.3)

### Build pipeline

`npm run build` runs:
1. `prebuild` → `make build-server-universal` (builds Go server as universal binary)
2. `npm run openapi:generate` (generates TypeScript types from OpenAPI spec)
3. `npx electron-builder` (packages the Electron app)

The electron-builder config in `package.json` specifies:
- `appId`: `com.gosheet.app`
- `productName`: `GoSheet`
- `mac.target`: `universal` (both Intel x64 and Apple Silicon arm64)
- `extraResources`: includes `server/gosheet-server-universal` → `server/gosheet-server` and `frontend/`
- `directories.output`: `dist`

### Potential issue: electron-builder + Electron 40 compatibility

`electron-builder@26.7.0` is installed. This version may or may not have native support for Electron 40 download URLs. If `npm run build` fails with a download error, check:
- electron-builder changelog for Electron 40 support
- May need to upgrade `electron-builder` to a newer version

### Architecture verification

Current `dist/` has:
- `dist/mac/GoSheet.app` — x86_64 (old build)
- `dist/mac-arm64/GoSheet.app` — arm64 (old build)

After rebuilding with Electron 40, `lipo -info` should confirm the binary architecture. For a universal build, it should show `x86_64 arm64`.

### CI workflow key points

`.github/workflows/test.yml`:
- `runs-on: ubuntu-latest` — Linux headless with xvfb
- Electron is installed via `npm ci` (no separate Playwright browser install needed for Electron)
- Test command: `xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" npx playwright test --project=electron`
- Env: `NODE_ENV=test`, `ELECTRON_SHOW_WINDOW=1`, `DEBUG: pw:api`

No changes to the CI test command are expected. The upgrade was transparent to the test runner.

### Searching for stale references

```bash
# Search for any remaining old version references (exclude node_modules, dist, package-lock)
grep -r "30\.5\.1\|electron@30\|1\.48\.2\|playwright@1\.48" . \
  --include="*.json" --include="*.yml" --include="*.yaml" --include="*.md" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude="package-lock.json"
```

### What NOT to do

- Do not change `retries: 2` or `timeout: 15000` in `playwright.config.js`
- Do not change the xvfb command in CI — it works for Electron 40
- Do not upgrade `electron-builder` unless build actually fails (YAGNI)
- Do not add version pins for Electron in CI — `npm ci` + `package-lock.json` already pins it exactly

### Key files

- `package.json` — Electron/Playwright versions, build config, scripts
- `.github/workflows/test.yml` — CI workflow
- `playwright.config.js` — test project config
- `Makefile` — `build-server-universal` target
- `dist/` — build output (gitignored)

---

## References

- `_bmad-output/implementation-artifacts/14-1-pilot-electron-upgrade-compatibility.md` — pilot story, version upgrade decision
- `_bmad-output/implementation-artifacts/14-2-complete-electron-upgrade.md` — test fixes, completion notes
- `_bmad-output/implementation-artifacts/14-3-port-chromium-click-tests-to-electron.md` — CI cleanup
- `package.json` — current build config
- `.github/workflows/test.yml` — CI workflow

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

1. `npm run build` was broken: `mac.target: [{ target: "universal" }]` — "universal" is an arch, not a target in electron-builder. Fixed to `{ target: "dmg", arch: ["universal"] }`.
2. Build now produces `dist/GoSheet-1.0.0-universal.dmg` with a true universal binary (x86_64 + arm64 confirmed via `lipo -info`).
3. No stale Electron 30.5.1 references found anywhere in the codebase.
4. CI workflow already clean — no changes needed.

### File List

- `package.json` — fixed `mac.target` from `{ target: "universal" }` to `{ target: "dmg", arch: ["universal"] }`

### Change Log

- 2026-03-06: Completed — build fixed, universal .dmg produced, CI verified clean
