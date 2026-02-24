# Code Complexity Baseline

**Story:** 10.3 - Add Code Complexity Analysis  
**Date:** 2026-02-24  
**Status:** Baseline established

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

### Functions >15 (0)

*None.* (ExtractCellReferences refactored 2026-02-23: extracted refCollector with walk methods.)

### Functions >10 (5 total)

| Complexity | Package | Function | Location |
|------------|---------|----------|----------|
| 15 | model | evaluateComparison | model/formula.go:261:1 |
| 14 | main | handleCSVExport | server/main.go:459:1 |
| 13 | model | evaluateMultiplication | model/formula.go:363:1 |
| 13 | model | (*DependencyGraph).GetCalculationOrder | model/dependencies.go:359:1 |
| 13 | controller | (*AppController).SetCellValue | controller/app.go:22:1 |

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
