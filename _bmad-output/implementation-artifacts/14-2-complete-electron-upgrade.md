# Story 14.2: Complete Electron Upgrade

**Status:** ready-for-dev
**Epic:** 14 — Electron Platform Upgrade

---

## Story

As a developer,
I want the full Electron upgrade completed with all tests green,
So that the app runs on a secure, actively-maintained runtime.

---

## Acceptance Criteria

**Given** the pilot (Story 14.1) identified any breakages
**When** all API and behavior changes are addressed
**Then** `npm run test:electron` passes fully from Claude Code CLI in the Cursor terminal
**And** `npm run test` passes in CI (GitHub Actions)
**And** the `package.json` `electron` version is ≥ 38.0.0

**Given** the upgrade is complete
**When** `npm run build` is run
**Then** a valid `.app` bundle is produced in `dist/`

---

## Tasks / Subtasks

- [ ] Task 1: Run full Electron test suite locally (AC: 1)
  - [ ] Run `npm run test:electron` from Claude Code CLI in Cursor terminal
  - [ ] All 196 tests in 27 files pass
  - [ ] Note any failures with error messages

- [ ] Task 2: Fix any failures found in Task 1 (AC: 1)
  - [ ] Investigate each failing test — distinguish flakiness from real breakage
  - [ ] Fix code or test as appropriate
  - [ ] Re-run until all 196 tests pass

- [ ] Task 3: Run full test suite including Chromium (AC: 1)
  - [ ] Run `npm test` (both chromium-web and electron projects)
  - [ ] All tests pass (196 Electron + 5 Chromium)

- [ ] Task 4: Push and verify CI passes (AC: 1)
  - [ ] Commit any fixes and push to main
  - [ ] Wait for GitHub Actions CI run to complete
  - [ ] Confirm all tests pass in CI

- [ ] Task 5: Document findings (AC: 1)
  - [ ] Add "Completion Notes" summarising: total tests run, any fixes made, CI result

---

## Dev Notes

### Context from Story 14.1 (pilot)

The Electron upgrade is **already done** — Electron 40.7.0 and Playwright 1.58.2 are installed in `package.json`. Story 14.1 verified a representative subset (smoke, file operations, menu — 18/18 tests) and found **zero API breakages**.

This story's sole job is to run the **remaining 178 untested specs** and fix anything that fails.

### Test suite breakdown (27 Electron spec files, 196 tests)

Already validated in Story 14.1:
- `smoke.spec.js` ✅
- `test_file_operations.spec.js` ✅
- `test_menu.spec.js` ✅

Remaining to validate:
- `test_spreadsheet.spec.js` — core CRUD, formulas, navigation
- `test_formula_errors.spec.js` — formula error handling
- `test_csv_import.spec.js`, `test_csv_roundtrip.spec.js`, `test_csv_export_debug.spec.js`
- `test_keyboard_shortcuts.spec.js`
- `test_insert_row_column.spec.js`, `test_context_menu.spec.js`
- `test_merge.spec.js`, `test_merge_centering.spec.js`
- `test_alignment.spec.js`, `test_rtl.spec.js`, `test_quote_prefix.spec.js`
- `test_manage_styles.spec.js`, `test_cell_hover_tooltip.spec.js`
- `test_accessibility.spec.js`
- `test_bug_fixes.spec.js`
- `test_edit_menu.spec.js`, `test_help_menu.spec.js`
- `test_file_dialogs.spec.js`
- `test_window_close.spec.js`, `test_quit_warning.spec.js`
- `test_dock_menu.spec.js`
- `test_dark_mode.spec.js`

### How to run

```bash
# Full electron suite (from Claude Code CLI in Cursor terminal):
NODE_ENV=test npx playwright test --project=electron

# Full suite (electron + chromium):
npm test

# Single file for debugging:
NODE_ENV=test npx playwright test --project=electron test_spreadsheet.spec.js
```

### Expected failure pattern (if any)

Since Story 14.1 found zero API breakages, failures in this story are most likely:
1. **Timing/flakiness** — tests that are inherently flaky; Playwright retries=2 should handle most
2. **Test-specific state assumptions** — tests that assumed Electron 30 behavior on edge cases
3. **New Playwright 1.58 assertion semantics** — minor changes in how `toHaveText`, `toBeVisible` work

If a test fails consistently (not just on retry), investigate before fixing. Check:
- Is the failure reproducible on Electron 30 too? (check git history)
- Is it a Playwright API change (check 1.48→1.58 release notes)?
- Is it a real app regression?

### Key test infrastructure

- `playwright_tests/fixtures.js` — Electron app launch fixture, shared across all Electron tests
- `playwright_tests/helpers.js` — `setCellViaApi`, `ensureSpreadsheetView`, etc.
- `playwright.config.js` — `workers: 1`, `retries: 2`, 15s timeout per test
- `NODE_ENV=test` — disables quit dialogs, hides window by default
- `ELECTRON_SHOW_WINDOW=1` — shows window (needed for some tests, set in CI)

### CI workflow

`.github/workflows/test.yml` runs:
```
xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" npx playwright test --project=electron
```
with `NODE_ENV=test` and `ELECTRON_SHOW_WINDOW=1`. This is unchanged from before the upgrade.

### What NOT to do

- Do not change `retries: 2` or `timeout: 15000` unless a test genuinely needs more time
- Do not mark tests as `test.skip()` to make them pass — fix the root cause
- Do not modify test logic unless the test itself is wrong (prefer fixing the app)

---

## References

- `_bmad-output/implementation-artifacts/14-1-pilot-electron-upgrade-compatibility.md` — pilot findings (no breakages, versions installed)
- `playwright.config.js` — test project configuration
- `playwright_tests/fixtures.js` — Electron launch fixture
- `playwright_tests/helpers.js` — shared test utilities
- `.github/workflows/test.yml` — CI workflow

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

### Change Log
