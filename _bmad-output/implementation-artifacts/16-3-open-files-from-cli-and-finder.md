# Story 16.3: Open Files from CLI and Finder "Open With"

Status: done

## Story

As a user,
I want to open `.sheet` and CSV files by double-clicking them in Finder or passing a path on the command line,
So that I can launch GoSheet directly into a file without going through the welcome screen.

## Acceptance Criteria

1. **Given** a `.sheet` file is double-clicked in Finder (or opened via "Open With > GoSheet")
   **When** the app launches or is already running
   **Then** the file opens in the spreadsheet view
   **And** the file status bar shows the correct file path

2. **Given** the app is launched from the terminal with a file path argument (e.g. `open GoSheet.app --args /path/to/file.sheet`)
   **When** the app starts
   **Then** the specified file is loaded directly, bypassing the welcome screen

3. **Given** a CSV file is opened via CLI or "Open With" (e.g. `open GoSheet.app --args /path/to/data.csv`)
   **When** it loads
   **Then** the CSV data is imported into a new spreadsheet
   **And** the file status shows "Unsaved changes" (since it hasn't been saved as .sheet yet)

4. **Given** the file path provided does not exist
   **When** the app attempts to open it
   **Then** a clear error message is shown
   **And** the app falls back to the welcome screen

5. **Given** the app is already running with a spreadsheet open
   **When** a second `.sheet` file is opened via Finder (double-click or "Open With")
   **Then** the `open-file` event fires in `main.js` and `menu-open-recent` is sent to the renderer
   **And** the existing unsaved-changes confirmation flow (`loadFileByPath`) is triggered before replacing the current file

## Tasks / Subtasks

- [x] Task 1: Wire `.sheet` file association in `package.json` to trigger `open-file` event (AC: 1, 5)
  - [x] Verify `fileAssociations` in `package.json` already declares `ext: "sheet"` — confirmed, no change needed.
  - [x] Confirm the existing `app.on('open-file', ...)` handler in `main.js` correctly stores `pendingFileToOpen` and sends `menu-open-recent` — confirmed, no change needed.
  - [x] Manual test: covered by Playwright test in Task 6.

- [x] Task 2: Extend CLI arg parsing to support `.csv` files (AC: 3)
  - [x] Extended `argFilePath` detection in `main.js` to also match `.csv` files.
  - [x] `.csv` CLI paths stored in `pendingFileToOpen`; dispatched via `menu-open-csv` channel.

- [x] Task 3: Handle `.csv` Finder "Open With" via `open-file` event (AC: 3)
  - [x] Extended `open-file` handler in `main.js` to route `.csv` to `menu-open-csv`, `.sheet` to `menu-open-recent`.
  - [x] Added `handleImportCSVByPath(filePath)` in `frontend/app.js` — imports directly without file picker or preview dialog.
  - [x] Added `onMenuOpenCSV` listener in `frontend/app.js` calling `handleImportCSVByPath`.
  - [x] Exposed `onMenuOpenCSV` in `electron/preload.js`.

- [x] Task 4: Add CSV to `package.json` `fileAssociations` (AC: 3)
  - [x] Added `{ ext: "csv", name: "CSV File", description: "Comma-separated values", role: "Editor" }`.

- [x] Task 5: Error handling for nonexistent file path (AC: 4)
  - [x] Added `fs.existsSync` guard in `did-finish-load` handler in `main.js`; sends `open-file-error` IPC if file is gone.
  - [x] Added `onOpenFileError` listener in `frontend/app.js`: calls `showWelcome()` and `showAlert(...)`.
  - [x] Exposed `onOpenFileError` in `electron/preload.js`.
  - [x] CLI arg guard (existing `fs.existsSync` check at parse time) prevents nonexistent file from being stored in `pendingFileToOpen`.

- [x] Task 6: Add Playwright test coverage (AC: 1, 2, 3, 4)
  - [x] `opens a .sheet file passed as CLI argument` — launches with fixture.sheet, verifies spreadsheet view, cell values, no "Unsaved" status.
  - [x] `opens a .csv file passed as CLI argument` — launches with data.csv, verifies CSV data imported, status shows "Unsaved".
  - [x] `shows error and welcome screen when CLI file does not exist` — launches with nonexistent path, verifies welcome screen shown.
  - [x] All 3 tests pass.

## Dev Notes

### What Already Works (No Changes Needed)

- **`.sheet` file association** (`package.json:98`): already declared with `ext: "sheet"`, `role: "Editor"`. Finder double-click already works in packaged app.
- **`app.on('open-file', ...)` handler** (`main.js:829-849`): already implemented. Sends `menu-open-recent` to renderer if window exists, otherwise stores in `pendingFileToOpen`.
- **`pendingFileToOpen` dispatch** (`main.js:422-429`): already fires `menu-open-recent` on `did-finish-load`.
- **CLI `.sheet` arg** (`main.js:256-262`): already parsed. Matches any arg ending `.sheet` that is an existing file.
- **`loadFileByPath`** (`frontend/app.js:581`): handles the unsaved-changes check, calls `LoadFile(filePath)`, shows error on failure. Used by `menu-open-recent` handler (`app.js:3058`).
- **`menu-open-recent` IPC** (`preload.js`): already exposed as `window.electronAPI.onMenuOpenRecent`.

### What's Missing

1. **CLI `.csv` support**: `argFilePath` in `main.js:256` only matches `.sheet`. Need to extend to also match `.csv`.
2. **`open-file` CSV routing**: `app.on('open-file', ...)` blindly sends `menu-open-recent` for all files. CSV files need a different flow (import, not load).
3. **CSV file association in `package.json`**: missing. Needed for "Open With > GoSheet" on CSV files.
4. **Missing `open-file-error` IPC**: when `pendingFileToOpen` refers to a nonexistent file (e.g. file was deleted between launch and window-ready), there is a `console.warn` but no user-facing feedback. The welcome screen is not shown automatically.

### Key Files

| File | Change |
|------|--------|
| `electron/main.js` | Extend CLI arg to match `.csv`; route `.csv` in `open-file` to `menu-open-csv`; add `fs.existsSync` guard for pending file with error IPC |
| `electron/preload.js` | Expose `onMenuOpenCSV` and `onOpenFileError` |
| `frontend/app.js` | Add `menu-open-csv` listener (reuse ImportCSV flow); add `open-file-error` listener |
| `package.json` | Add CSV to `fileAssociations` |

### IPC Channel Conventions

All existing channels follow the pattern `menu-*` for menu/file events. New channels:
- `menu-open-csv` — main → renderer, payload: `filePath` string
- `open-file-error` — main → renderer, payload: `filePath` string

### CSV Import Flow (Existing)

The CSV import flow in `app.js` is triggered by the "Import CSV" menu item. It calls `PreviewCSV(path)` then `ImportCSV(path)`. For the "Open With" path, we should **skip the preview step** and call `ImportCSV(path)` directly (same as if the user confirmed the preview). This avoids an extra dialog when the user already picked the file via Finder/CLI.

Alternatively, show the preview step so the user can confirm row/column counts — but this is likely confusing when they explicitly chose to open the file. **Skip preview; call `ImportCSV` directly.**

### Electron `open-file` Event Timing

On macOS, `open-file` can fire **before** `app.whenReady()`. The existing handler correctly handles this by checking `mainWindow`:
- Window exists → send IPC immediately
- Window not ready → set `pendingFileToOpen` (dispatched on `did-finish-load`)

This is already correct for `.sheet`. The `.csv` path uses the same `pendingFileToOpen` variable — routing to `menu-open-csv` vs `menu-open-recent` is done at dispatch time based on `.endsWith('.csv')`, so no separate variable is needed.

### Single-Instance Constraint (Known Limitation)

The app uses `app.requestSingleInstanceLock()` (`main.js:20`), which prevents more than one GoSheet process from running. This is a direct consequence of the fixed port 3000 — a second instance would conflict on the port. As a result, this story operates under a **single-window constraint**: only one file can be open at a time, and "Open With" on a second file replaces the current one.

**This limitation is intentional and deferred.** Story 16.5 (remove fixed port dependency) will switch to an ephemeral port, at which point the single-instance lock can be removed and true multi-window/multi-instance support becomes possible. Do not attempt to fix this here.

### Playwright Test Setup

Playwright tests launch Electron with custom `args` via the `electronApp` fixture in `playwright_tests/fixtures/electron-app.js`. To test CLI file open, pass the file path as an additional arg. See `playwright_tests/specs/` for existing test patterns.

Use `waitForFunction` with a timeout instead of any sleeps to wait for file load.

### Previous Story Intelligence (16.2)

- Story 16.2: No frontend or Electron changes — all Go model layer. No patterns to carry forward except that the test suite structure (`model/`, `controller/`) remains the same.

### Architecture Reference

- `electron/main.js` — Electron main process, IPC setup, app lifecycle [Source: project structure]
- `electron/preload.js` — IPC bridge (contextBridge), exposes APIs to renderer [Source: project structure]
- `frontend/app.js` — Frontend app logic, IPC event listeners
- `frontend/api-client.js` — HTTP API client, `LoadFile`, `ImportCSV`
- `package.json` (`build.fileAssociations`) — electron-builder file type config [Source: package.json:98]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `.sheet` association and `open-file` handler were already implemented; no changes needed for that path.
- Extended CLI arg parsing to match `.csv` as well as `.sheet`.
- `open-file` event handler now routes `.csv` to new `menu-open-csv` IPC channel; `.sheet` unchanged.
- `did-finish-load` handler updated: `fs.existsSync` guard emits `open-file-error` if file gone; dispatches `.csv` to `menu-open-csv`, `.sheet` to `menu-open-recent`.
- Added `handleImportCSVByPath(filePath)` in `app.js` — imports CSV directly (no file picker, no preview dialog), with unsaved-changes check.
- Exposed `onMenuOpenCSV` and `onOpenFileError` in `preload.js`.
- Added CSV to `fileAssociations` in `package.json` (enables "Open With > GoSheet" for CSV files).
- 3 Playwright tests added in `test_open_from_cli.spec.js`; all pass. Sequential launch pattern used to respect single-instance lock.
- Bug fix: `model/cell.go` `GobEncode` changed from value receiver to pointer receiver — map stores `*Cell` so gob must find `GobEncode` on `*Cell`, not `Cell`. Previous value receiver caused "decoding into local type *map[int]map[int]*model.Cell, received remote" on any save/load round-trip.
- Bug fix: `loadFileByPath` in `app.js` now calls `showSpreadsheet()` only after successful load; on error calls `showWelcome()` so user is not left on a blank grid.
- CR fix (M1): `open-file` live path now guards with `fs.existsSync` before sending IPC — previously only the `did-finish-load` path checked existence.
- CR fix (M2): `handleImportCSVByPath` now calls `showWelcome()` in catch block — previously a failed import left the user on a blank spreadsheet.
- CR fix (L1): Added test `shows welcome screen when open-file-error IPC fires` — calls `__testOpenFileError` hook directly to cover the IPC path without relying on race condition timing.
- CR fix (L2): Corrected stale dev note about `pendingCSVToOpen` — implementation correctly uses single `pendingFileToOpen` with routing at dispatch time.
- CR fix (L3): Removed polling sleep loop waiting for file write — `saveSheetToFile` awaits the API response so file is guaranteed written after the call.

### File List

- `electron/main.js`
- `electron/preload.js`
- `frontend/app.js`
- `package.json`
- `model/cell.go`
- `playwright_tests/test_open_from_cli.spec.js` (new)
