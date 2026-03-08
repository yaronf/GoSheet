# Code Complexity Baseline

**Story:** 10.3 - Add Code Complexity Analysis
**Date:** 2026-02-24
**Status:** Updated 2026-03-08 (Story 16.6: refactored all Go/JS functions >20; split formula.go, handlers.go, app.js)

---

## Thresholds

| Level | Cyclomatic Complexity | Action |
|-------|----------------------|--------|
| Warn | >15 | Refactor in Story 10.5 |
| Fail | >20 | Must refactor before merge |

**Epic 9 target:** No functions >20, <5 functions >15 (after Story 10.5 refactoring).

---

## Go (gocyclo)

**Command:** `make complexity` or `gocyclo -over 10 .`

### Functions >15 (2 — as of Story 16.6)

All previously >20 functions have been refactored. Remaining >15 are below the hard limit.

| Complexity | Package | Function | Location | Notes |
|------------|---------|----------|----------|-------|
| 17 | model | (*Spreadsheet).InsertColumn | model/spreadsheet.go:505 | Acceptable; structural op |
| 16 | model | (*Spreadsheet).InsertRow | model/spreadsheet.go:457 | Acceptable; structural op |

### Functions >10 (as of 2026-03-08, Story 16.6)

| Complexity | Package | Function | Location |
|------------|---------|----------|----------|
| 15 | model | evaluateComparison | model/formula_eval.go:104 |
| 14 | model | (*Spreadsheet).DeleteColumn | model/spreadsheet.go:624 |
| 14 | model | (*Spreadsheet).ApplyStyleToRange | model/spreadsheet.go:692 |
| 13 | model | shiftCellRef | model/formula_shift.go:83 |
| 13 | model | evaluateMultiplication | model/formula_eval.go:208 |
| 13 | model | (*Spreadsheet).DeleteRow | model/spreadsheet.go:556 |
| 13 | model | (*DependencyGraph).GetCalculationOrder | model/dependencies.go:353 |
| 13 | api | (*Server).computeCSVExportBounds | api/handlers.go:427 |
| 12 | model | atomicWriteFile | model/file.go:23 |
| 12 | model | ExpandRange | model/dependencies.go:197 |
| 12 | model | serializePrimaryDisplay | model/formula.go:248 |
| 12 | model | (*StyleRegistry).UpdateStyle | model/style.go:170 |
| 12 | controller | (*SetMergeCommand).Do | controller/command.go:623 |
| 12 | controller | (*AppController).propagateCycleError | controller/app.go:220 |
| 11 | model | (*Spreadsheet).CleanupFormat | model/spreadsheet.go:426 |
| 11 | model | (*Spreadsheet).SetRangeAlignment | model/spreadsheet.go:376 |
| 11 | model | RefToCoords | model/coords.go:36 |
| 11 | controller | (*AppController).setCellValueInternal | controller/app.go:103 |

---

## JavaScript (ESLint complexity rule)

**Command:** `npm run lint` (complexity rule: warn at 15)

### Functions >20 (0)

*None.* All functions with complexity >20 have been refactored (Story 16.6).

### Functions >15 (4 warnings — all at exactly 20 or below threshold)

| Complexity | File | Function |
|------------|------|----------|
| 20 | electron/menu.js | buildMenu |
| 20 | frontend/app-cell-editor.js | handleKeydownFileOps |
| 20 | frontend/app-modals.js | formatToCssPreview |
| 20 | frontend/app-modals.js | populateFormBorderProps |

---

## Refactoring Plan (Story 10.5)

**Priority order (worst offenders first):**

1. ~~**frontend/app.js:879** (29) — Split keydown handler into smaller functions by category (file ops, edit ops, navigation)~~ ✓ Done
2. ~~**model/dependencies.go:47** (22) — ExtractCellReferences: extract walk logic into refCollector~~ ✓ Done
3. **model/formula.go:261** (15) — evaluateComparison: consider extracting operator handlers
4. **server/main.go:459** (14) — handleCSVExport: extract CSV formatting logic
5. **model/formula.go:363** (13) — evaluateMultiplication: extract term evaluation
6. **model/dependencies.go:359** (13) — GetCalculationOrder: extract BFS/queue logic
7. **controller/app.go:22** (13) — SetCellValue: extract formula dependency extraction

---

## How to Run

```bash
# Go complexity
make complexity

# JavaScript (includes complexity warnings)
npm run lint
```
