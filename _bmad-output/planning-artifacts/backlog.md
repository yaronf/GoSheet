# GoSheet Backlog

Future ideas and feature notes. Promote to sprint via `/bmad-bmm-correct-course` when ready to act.

---

## Ideas

### Language-independent file format

See `[technical-file-format-cross-language-random-access-research-2026-02-23.md](research/technical-file-format-cross-language-random-access-research-2026-02-23.md)`  
→ **Promoted** to Epic 22 (MessagePack) — `[sprint-change-proposal-2026-03-15.md](sprint-change-proposal-2026-03-15.md)`

### Generic font fallback

When applying styles, use a fallback stack (e.g. `"CustomFont", sans-serif`) so that if a font in a .sheet file is not installed, the renderer uses a sensible default instead of the browser's generic. Relevant: `frontend/app-modals.js` `formatToCssPreview`, `docs/FILE_FORMAT.md` (unknown fonts section).

### Select cells/ranges for inclusion in formula

While editing a formula, click a cell/range to include a reference in the formula.
**Epic: 18** ✓ Done -- Later: I'm not sure. I think this works for individual cells, not for ranges. Specifically drag doesn't work
when editing in the formula bar. It does work when editing inline (in a cell) but then it's somehow hidden - the cell may need to be physically expanded or the formula physically shifted to show its last characters.

### User doc

Ensure user documentation is updated once per epic, when applicable.

### Typed cell error enum instead of string sentinels

`Cell.Computed` encodes error type as strings (`"#ERROR division by zero"`, `"#REF!"`, `"#ERROR circular reference: ..."`) and `IsError bool` only tells you *something* went wrong. Distinguishing error kinds requires string matching on `Computed`, which is fragile and leaks display concerns into logic.

Replace with a typed `ErrorKind` enum (e.g. `ErrNone`, `ErrEval`, `ErrRef`, `ErrCircular`, `ErrParse`) on `Cell`, keeping `Computed` for the display string. Callers that need to branch on error type use the enum; the frontend continues to display `Computed` as-is. Note: `ErrorKind` must be gob-registered to survive save/load round-trips, and the file format version should be bumped.
Relevant: `[model/cell.go](../../model/cell.go)`, `[model/formula.go](../../model/formula.go)`, `[controller/app.go](../../controller/app.go)`

### Bug: Dock right-click "Quit" navigates to Welcome screen instead of quitting

In dev mode, right-clicking the dock icon and selecting "Quit" navigates to the Welcome screen instead of quitting the app. Expected: app quits (or shows unsaved-changes dialog then quits).

### Text wrapping within cell

At least a toggle. Does it also require control of row/column width?

### Copy/paste full rows/cols

Today this is behind a "too many cells" check. Needs to be implemnted efficiently.

### Recent Files on Welcome Page

If the file cannot be opened, add an indication (dialog?) and/or remove it from the list. Bug: a dialog is apparently opened and is only shown when the spreadsheet is opened.

### Security warning while building for Electron

installing native dependencies  arch=x64
  • completed installing native dependencies
  • packaging       platform=darwin arch=x64 electron=40.7.0 appOutDir=dist/mac-universal-x64-temp
  • searching for node modules  pm=npm searchDir=/Users/ysheffer/misc/spreadsheet
(node:53685) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, as the arguments are not escaped, only concatenated.
(Use `node --trace-deprecation ...` to show where the warning was created)

