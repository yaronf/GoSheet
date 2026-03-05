# GoSheet Backlog

Future ideas and feature notes. Promote to sprint via `/bmad-bmm-correct-course` when ready to act.

---

## Ideas



### Open CSV from CLI

Open (import) CSV files from the CLI. Or by double-clicking them (open with...). When saving it's a full .sheet file.
Relevant: `[server/main.go](../../server/main.go)`, `[api/csv.go](../../api/csv.go)`
**Epic: 16**

### Readonly flag

Open a file in read only mode (view).
Relevant: `[controller/app.go](../../controller/app.go)`, `[api/handlers.go](../../api/handlers.go)`
**Epic: 16**

### Row/column select esthetics

Remove borders around cells.
Relevant: `[frontend/spreadsheet.js](../../frontend/spreadsheet.js)`, `[frontend/styles.css](../../frontend/styles.css)`
**Epic: 17**

### Select range

More naturally than clicking each cell individually.
Relevant: `[frontend/spreadsheet.js](../../frontend/spreadsheet.js)`
**Epic: 17**

### copy paste range/row/column

Right now Copy only does 1 cell even when a row is selected, which is a bug.
Relevant: `[frontend/spreadsheet.js](../../frontend/spreadsheet.js)`
**Epic: 17**

### Tech Debt

See `[TECHNICAL-DEBT.md](../implementation-artifacts/TECHNICAL-DEBT.md)`
**Epic: 14**

### Agentic API

See `[technical-agent-access-layer-research.md](research/technical-agent-access-layer-research.md)`
**Epic: 19**

### Language-independent file format

See `[technical-file-format-cross-language-random-access-research-2026-02-23.md](research/technical-file-format-cross-language-random-access-research-2026-02-23.md)`
**Epic: TBD**

### Undo

Support unlimited undo for "reasoanble" operations.
**Epic: 15**

### Data safety

Minimize the risk of data loss when modifying/writing files
**Epic: 16**

### Select cells/ranges for inclusion in formula

While editing a formula, click a cell/range to include a reference in the formula.
**Epic: 18**

### Bug: Select All in menu is useless

Say no more.
**Epic: 17**

