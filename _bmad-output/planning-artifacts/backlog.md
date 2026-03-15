# GoSheet Backlog

Future ideas and feature notes. Promote to sprint via `/bmad-bmm-correct-course` when ready to act.

---

## Ideas

### Select cells/ranges for inclusion in formula

→ **Promoted** to Epic 23 (enhancement) — `[sprint-change-proposal-2026-03-15-epic23.md](sprint-change-proposal-2026-03-15-epic23.md)`  
**Epic 18** ✓ Done. Gaps: drag doesn't work in formula bar; inline ref may be hidden.

### User doc

Ensure user documentation is updated once per epic, when applicable.

### Typed cell error enum instead of string sentinels

`Cell.Computed` encodes error type as strings (`"#ERROR division by zero"`, `"#REF!"`, `"#ERROR circular reference: ..."`) and `IsError bool` only tells you *something* went wrong. Distinguishing error kinds requires string matching on `Computed`, which is fragile and leaks display concerns into logic.

Replace with a typed `ErrorKind` enum (e.g. `ErrNone`, `ErrEval`, `ErrRef`, `ErrCircular`, `ErrParse`) on `Cell`, keeping `Computed` for the display string. Callers that need to branch on error type use the enum; the frontend continues to display `Computed` as-is. Note: `ErrorKind` must be gob-registered to survive save/load round-trips, and the file format version should be bumped.
Relevant: `[model/cell.go](../../model/cell.go)`, `[model/formula.go](../../model/formula.go)`, `[controller/app.go](../../controller/app.go)`

### Bug: Dock right-click "Quit" navigates to Welcome screen instead of quitting

In dev mode, right-clicking the dock icon and selecting "Quit" navigates to the Welcome screen instead of quitting the app. Expected: app quits (or shows unsaved-changes dialog then quits).

### Manually set column width

Allow user to set column width (e.g. via drag on column header edge). Would improve text-wrap UX and general layout control.

### Security warning while building for Electron

installing native dependencies  arch=x64
  • completed installing native dependencies
  • packaging       platform=darwin arch=x64 electron=40.7.0 appOutDir=dist/mac-universal-x64-temp
  • searching for node modules  pm=npm searchDir=/Users/ysheffer/misc/spreadsheet
(node:53685) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, as the arguments are not escaped, only concatenated.
(Use `node --trace-deprecation ...` to show where the warning was created)

