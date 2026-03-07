# Code Complexity Baseline

**Story:** 10.3 - Add Code Complexity Analysis
**Date:** 2026-02-24
**Status:** Updated 2026-03-08 (Story 16.2: RecalculateAll implemented; Story 16.1: atomicWriteFile added)

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

### Functions >15 (8 — to be addressed in Story 16.6)

| Complexity | Package | Function | Location | Notes |
|------------|---------|----------|----------|-------|
| 37 | model | (*Spreadsheet).RecalculateAll | model/spreadsheet.go:170 | Story 16.2: moved from controller |
| 26 | model | shiftRange | model/formula_shift.go:122 | Story 15.5 |
| 25 | api | (*Server).HandleCSVExport | api/handlers.go:366 | Grew from 14 |
| 21 | model | (*Spreadsheet).DeleteColumn | model/spreadsheet.go:605 | Story 13/15 |
| 21 | api | (*Server).HandleGetAllCells | api/handlers.go:153 | Story 13/15 |
| 20 | model | (*Spreadsheet).DeleteRow | model/spreadsheet.go:537 | Story 13/15 |
| 17 | model | (*Spreadsheet).InsertColumn | model/spreadsheet.go:486 | Story 13 |
| 16 | model | (*Spreadsheet).InsertRow | model/spreadsheet.go:438 | Story 13 |

### Functions >10 (as of 2026-03-08)

| Complexity | Package | Function | Location |
|------------|---------|----------|----------|
| 15 | model | evaluateComparison | model/formula.go:407 |
| 14 | model | (*Spreadsheet).ApplyStyleToRange | model/spreadsheet.go:671 |
| 13 | model | shiftCellRef | model/formula_shift.go:83 |
| 13 | model | evaluateMultiplication | model/formula.go:511 |
| 13 | model | (*DependencyGraph).GetCalculationOrder | model/dependencies.go:353 |
| 12 | model | atomicWriteFile | model/file.go:23 |
| 12 | model | ExpandRange | model/dependencies.go:197 |
| 12 | controller | (*SetMergeCommand).Do | controller/command.go:623 |
| 12 | controller | (*AppController).propagateCycleError | controller/app.go:220 |
| 11 | model | (*Spreadsheet).CleanupFormat | model/spreadsheet.go:407 |
| 11 | model | (*Spreadsheet).SetRangeAlignment | model/spreadsheet.go:357 |
| 11 | model | RefToCoords | model/coords.go:36 |
| 11 | controller | (*AppController).setCellValueInternal | controller/app.go:103 |

---

## JavaScript (ESLint complexity rule)

**Command:** `npm run lint` (complexity rule: warn at 15)

### Functions >15 (0)

*None.* (app.js keydown handler refactored 2026-02-23: split into `handleKeydownFileOps` and `handleKeydownCellNavigation`.)

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
