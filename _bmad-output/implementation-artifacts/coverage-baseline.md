# Test Coverage Baseline

**Story:** 10.4 - Measure Test Coverage  
**Date:** 2026-02-24  
**Status:** Baseline established

---

## Targets

| Package | Target | Rationale |
|---------|--------|-----------|
| model/ | 80% | Formula engine, cell logic, dependency graph — critical path |
| controller/ | 80% | App logic — critical path |
| api/ | 80% | Response handling — critical path |
| server/ | N/A | Main package, tested via integration/Playwright |

---

## Current Baseline

**Command:** `make coverage`

### Summary

| Package | Coverage | Status |
|---------|----------|--------|
| model/ | 13.7% | Below target |
| controller/ | 0% | Not covered by unit tests (tests/ imports model only) |
| api/ | 0% | Not covered by unit tests |

### Notes

- **JS/Playwright coverage deferred:** Playwright tests are integration/E2E; coverage would need V8 or Istanbul instrumentation. Skipped for Story 10.4. Frontend (app.js, api-client.js) exercised by Playwright; app.js simplification planned (Story 10.5).
- **tests/** package tests **model** only — controller and api are exercised via server HTTP handlers (integration)
- Playwright tests provide integration coverage for full stack
- To increase model coverage: add unit tests for low-coverage functions (LoadFromBytes, SaveToBytes, RecalculateAll, String, extractCellReferencesRegex, value, toNumber)
- controller/ and api/ would need dedicated unit tests or integration tests with coverage instrumentation

### Gaps (model, <80%)

- model/file.go: LoadFromBytes, SaveToBytes (0%)
- model/spreadsheet.go: RecalculateAll, String (0%)
- model/dependencies.go: extractCellReferencesRegex (0%)
- model/formula.go: value variants, toNumber (0–22%)
- Various formula helpers: 50–75%

---

## How to Run

```bash
# Go coverage (model via tests package)
make coverage

# HTML report (optional)
go tool cover -html=coverage.out
```
