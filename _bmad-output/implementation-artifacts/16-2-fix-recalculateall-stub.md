# Story 16.2: Fix RecalculateAll() Stub

Status: done

## Story

As a user,
I want all formulas to recalculate correctly when a file is loaded or a full recalc is triggered,
So that I see accurate computed values rather than `#PENDING` placeholders.

## Acceptance Criteria

1. **Given** a spreadsheet file with formulas is opened
   **When** `RecalculateAll()` is called during load
   **Then** all formula cells display their correct computed values
   **And** no cell shows `#PENDING`

2. **Given** a spreadsheet with chained formula dependencies (e.g. B1=A1+1, C1=B1+1)
   **When** `RecalculateAll()` is called
   **Then** all dependent cells are evaluated in correct topological order
   **And** results match the values produced by incremental recalculation

3. **Given** a circular reference exists in the spreadsheet
   **When** `RecalculateAll()` is called
   **Then** the circular reference cells display `#ERROR` (not `#PENDING`)
   **And** non-circular cells still compute correctly

4. **Given** the existing Go unit tests
   **When** `RecalculateAll()` is invoked in tests
   **Then** all tests pass with no regressions

## Background / Current State

`model.Spreadsheet.RecalculateAll()` (`model/spreadsheet.go:167`) is a documented stub that returns `nil` and does nothing. A comment explains the real recalculation lives in `AppController.recalculateAllFormulas()` (`controller/app.go:266`), which has access to the dependency graph and formula engine.

**The full recalc pipeline already works correctly for file load** via `loadSheet()`:
```
LoadFile/LoadFromBytes → loadSheet → rebuildDependencyGraph → recalculateAllFormulas
```

`recalculateAllFormulas` handles: AST rebuild, topological order via `GetCalculationOrder`, cycle detection + propagation, and formula evaluation via `EvaluateFormula`.

**What this story actually needs to do:**
The model-layer `RecalculateAll()` stub needs to be wired to the real recalc logic so it becomes callable from model-layer tests and standalone contexts. The correct approach is to make `Spreadsheet.RecalculateAll()` perform the same operations that `AppController.recalculateAllFormulas()` currently does — but self-contained at the model layer, without requiring a controller instance.

**Why this is non-trivial:**
`recalculateAllFormulas` uses `model.EvaluateFormula`, `model.ExtractCellReferences`, `model.ParseFormula`, `model.ResolveAllCoords`, `model.ApplyInvalidRefs`, and `model.RefToCoords` — all of which are in the `model` package. The dependency graph (`s.Dependencies`) is also on `Spreadsheet`. So the full logic can be moved to the model layer without any circular imports.

## Tasks / Subtasks

- [x] Task 1: Implement `RecalculateAll()` at the model layer (AC: 1, 2, 3, 4)
  - [x] Move the recalculation logic from `AppController.recalculateAllFormulas()` into `Spreadsheet.RecalculateAll()` in `model/spreadsheet.go`
  - [x] Logic to include: rebuild ParsedFormula ASTs → collect all formula refs → `GetCalculationOrder` → handle cycle (mark cycle members, propagate errors) → evaluate non-cycle cells in topsort order
  - [x] Cycle error format: `"circular reference: A1 → B1 → A1"` (same as current)
  - [x] `RecalculateAll()` rebuilds `s.Dependencies` from scratch before recalculating (Option B)

- [x] Task 2: Update `AppController.recalculateAllFormulas()` to delegate to `RecalculateAll()` (AC: 4)
  - [x] Replace the body of `recalculateAllFormulas` with a call to `c.Sheet.RecalculateAll()`
  - [x] Removed `rebuildDependencyGraph()` call from `loadSheet` (now inside RecalculateAll)
  - [x] All existing controller tests still pass

- [x] Task 3: Add model-layer unit tests for `RecalculateAll()` (AC: 1, 2, 3)
  - [x] `TestRecalculateAll_BasicChain`: B1=A1+1, C1=B1+1; set A1=5; call RecalculateAll; verify C1=7
  - [x] `TestRecalculateAll_CircularRef`: A1=B1, B1=A1; call RecalculateAll; verify both show `#ERROR circular reference`
  - [x] `TestRecalculateAll_CircularAndNonCircular`: cycle A1↔B1 plus independent D1=C1+1; verify D1 correct and A1/B1 show errors
  - [x] `TestRecalculateAll_EmptySpreadsheet`: no cells; returns nil, no panic
  - [x] `TestRecalculateAll_StaleComputedOverwritten`: stale Computed="999" gets overwritten with correct value

- [x] Task 4: Strengthen controller-layer load tests (AC: 1, 2, 3)
  - [x] `TestControllerLoadFromBytes_ChainedFormulas`: B1=A1+1, C1=B1+1; verify C1="7" after load
  - [x] `TestControllerLoadFromBytes_CycleShowsError`: A1=B1, B1=A1; verify both IsError and Computed contains "circular"
  - [x] `TestControllerLoadFile_FormulasRecalculated`: SaveToFile/LoadFile round-trip with formula

- [x] Task 5: Update `_bmad-output/implementation-artifacts/complexity-baseline.md` (AC: 4)
  - [x] `recalculateAllFormulas` dropped from 30 to <10 (thin wrapper); `RecalculateAll` at model layer is 37 — tracked in Story 16.6

## Dev Notes

### Known Inefficiency: Double Graph Build on Structural Ops

`command.go` has 8 call sites that call `rebuildDependencyGraph()` before `recalculateAllFormulas()`. Since `RecalculateAll()` now rebuilds the graph itself, this is a redundant double build on every structural operation (insert/delete row/column, merge, etc.). The cost is minor (O(cells)), but it's waste. Story 16.6 should either remove `rebuildDependencyGraph` from those call sites or remove the method entirely once it's confirmed the graph-inside-RecalculateAll is always sufficient.

### Key Design Decision: Who owns `rebuildDependencyGraph`?

**Option A (recommended):** `RecalculateAll()` assumes the dependency graph is already populated. `rebuildDependencyGraph` stays as a separate controller method called before `RecalculateAll`. This is correct for the file load path (`loadSheet` → `rebuildDependencyGraph` → `sheet.RecalculateAll()`). For standalone model tests, tests must populate the graph manually or call a model-layer `RebuildDependencies()` helper.

**Option B:** `RecalculateAll()` rebuilds the graph itself. Simpler for tests, but slightly wasteful when called after a structural operation that already rebuilt the graph. Given the complexity of `recalculateAllFormulas` (currently 30 — highest in the codebase), keeping it simple and self-contained is preferable.

**Resolution:** Use Option B — `RecalculateAll()` rebuilds the dependency graph itself. This makes it truly standalone. `rebuildDependencyGraph` in the controller becomes redundant and can be removed or kept as a no-op. This also directly addresses the complexity-30 violation (Story 16.6).

### Dependency Graph Population (for model tests)

`rebuildDependencyGraph` logic (from `controller/app.go:444`):
```go
c.Sheet.Dependencies = model.NewDependencyGraph()
for row, rowMap := range c.Sheet.Cells {
    for col, cell := range rowMap {
        if cell != nil && cell.IsFormula && cell.Value != "" {
            cellRef := model.CoordsToRef(row, col)
            refs := model.ExtractCellReferences("=" + cell.Value)
            for _, ref := range refs {
                if ref != cellRef { // skip self-deps
                    c.Sheet.Dependencies.AddDependency(cellRef, ref)
                }
            }
        }
    }
}
```
All of this uses only `model` package symbols — it belongs in `RecalculateAll` or a dedicated `RebuildDependencies` method on `Spreadsheet`.

### Cycle Propagation Pattern (from `propagateCycleError` and `recalculateAllFormulas`)

The cycle-handling logic in `recalculateAllFormulas` (lines 298–317) uses `DetectCircularReference` to identify cycle members, then marks them with `SetError`, then evaluates non-cycle cells. This must be preserved exactly — it's well-tested by `test_formula_errors.spec.js`.

### `strings` Import

`model/spreadsheet.go` does not currently import `"strings"`. Adding `strings.Join` for the cycle path string will require adding the import.

### `logutil` Import

`controller/app.go` uses `logutil.Debugln` in `recalculateAllFormulas`. The model package should NOT import logutil (it's a controller-layer concern). Either omit logging from the model-layer implementation, or accept a small regression in debug visibility.

### Key Files

| File | Change |
|---|---|
| `model/spreadsheet.go` | Implement `RecalculateAll()` with full logic |
| `model/spreadsheet_test.go` | Add 5 new tests |
| `controller/app.go` | Replace `recalculateAllFormulas` body with `c.Sheet.RecalculateAll()`; remove `rebuildDependencyGraph` call from `loadSheet` (now inside RecalculateAll) |
| `_bmad-output/implementation-artifacts/complexity-baseline.md` | Update measurements |

### Previous Story Intelligence

- Story 15.3 established `recalculateAllFormulas` as the reliable post-structural-op recalc path — all its callers in `command.go` (8 call sites) will automatically benefit when it delegates to `RecalculateAll()`.
- Story 15.5 established `propagateCycleError` — that helper stays on `AppController` for use by `setCellValueInternal`. `RecalculateAll` gets its own inline cycle-handling (same logic, different context).
- The `"strings"` import was added to `controller/app.go` and `controller/command.go` during Story 15 work. `model/spreadsheet.go` will need it too.

### Recent Git Context

- `c1694e2` — Story 16.1 atomic writes (only model/file.go touched)
- `8cdd6b6` — Cycle propagation fixes (app.go, command.go patterns to follow)
- `936c8ec` — CI/build fixes

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented `RecalculateAll()` at model layer: rebuilds dependency graph, restores ASTs, evaluates in topological order, handles cycles with full error propagation.
- `recalculateAllFormulas` in controller reduced to a 3-line wrapper delegating to `RecalculateAll()`.
- Removed redundant `rebuildDependencyGraph()` call from `loadSheet` (RecalculateAll now owns it).
- Added 5 model-layer tests and 3 controller-layer load tests; all pass.
- `recalculateAllFormulas` dropped from complexity 30 to <10. `RecalculateAll` at 37 — tracked in Story 16.6.
- Updated complexity-baseline.md with current measurements.
- All existing tests pass (no regressions).
- Code review fixes applied: parse errors in Phase 2 now mark cell with error and skip re-evaluation in Phase 4 (tracked via `parseErrors` set, not `IsError` flag to avoid blocking #REF! recalculation). Doc comment clarifies nil error return. Double graph build in structural ops documented as known inefficiency for Story 16.6.

### File List

- `model/spreadsheet.go` (modified)
- `model/spreadsheet_test.go` (modified)
- `controller/app.go` (modified)
- `controller/controller_test.go` (modified)
- `_bmad-output/implementation-artifacts/complexity-baseline.md` (modified)
