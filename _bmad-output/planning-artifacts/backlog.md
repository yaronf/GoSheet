# GoSheet Backlog

Future ideas and feature notes. Promote to sprint via `/bmad-bmm-correct-course` when ready to act.

---

## Ideas



### Open CSV from CLI

Open (import) CSV files from the CLI. Or by double-clicking them (open with...). When saving it's a full .sheet file.
Relevant: `[server/main.go](../../server/main.go)`, `[api/csv.go](../../api/csv.go)`

### Readonly flag

Open a file in read only mode (view).
Relevant: `[controller/app.go](../../controller/app.go)`, `[api/handlers.go](../../api/handlers.go)`

### Row/column select esthetics

Remove borders around cells.
Relevant: `[frontend/spreadsheet.js](../../frontend/spreadsheet.js)`, `[frontend/styles.css](../../frontend/styles.css)`

### Select range

More naturally than clicking each cell individually.
Relevant: `[frontend/spreadsheet.js](../../frontend/spreadsheet.js)`

### copy paste range/row/column

Right now Copy only does 1 cell even when a row is selected, which is a bug.
Relevant: `[frontend/spreadsheet.js](../../frontend/spreadsheet.js)`

### Tech Debt

See `[TECHNICAL-DEBT.md](../implementation-artifacts/TECHNICAL-DEBT.md)`

### Agentic API

See `[technical-agent-access-layer-research.md](research/technical-agent-access-layer-research.md)`

### Language-independent file format

See `[technical-file-format-cross-language-random-access-research-2026-02-23.md](research/technical-file-format-cross-language-random-access-research-2026-02-23.md)`

### Undo

Support unlimited undo for "reasoanble" operations.

### Data safety

Minimize the risk of data loss when modifying/writing files