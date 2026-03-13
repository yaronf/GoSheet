# GoSheet Backlog

Future ideas and feature notes. Promote to sprint via `/bmad-bmm-correct-course` when ready to act.

---

## Ideas

### Agentic API

See `[technical-agent-access-layer-research.md](research/technical-agent-access-layer-research.md)`
**Epic: 20**

### Language-independent file format

See `[technical-file-format-cross-language-random-access-research-2026-02-23.md](research/technical-file-format-cross-language-random-access-research-2026-02-23.md)`

### Select cells/ranges for inclusion in formula

While editing a formula, click a cell/range to include a reference in the formula.
**Epic: 18** ✓ Done

### User doc

Ensure user documentation is updated once per story, when applicable.

### Toolbar

Remove the alignment buttons, add style buttons. And make them dynamic: new styles add buttons etc. And of course rendered as the style.
**Epic: 19** (Story 19.4)

### Fold Insert menu into Edit menu

The Insert menu items (insert row/column) should live in the Edit menu, eliminating the separate Insert menu.
**Epic: 19** (Story 19.3)

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

### Bug Cannot select whole row/col from the cell selection box
**Epic: 19** (Story 19.5)

### Prevent copying ranges into non-empty ranges

Or add an "are you sure" modal.
**Epic: 19** (Story 19.6)

### Copy/pasted formulas - bug

When a range is copied, the formulas should have their references shifted. Absolute refs (`$A$1`) do not shift.
**Epic: 19** (Stories 19.1 + 19.2)

