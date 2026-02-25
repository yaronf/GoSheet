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
**Updated:** 2026-02-25 (Story 10.11 CR fixes; commit 68ffc71)

### Summary

| Package | Coverage | Status |
|---------|----------|--------|
| model/ + controller/ + api/ | **90.5%** | ✓ Target met (80%) |

### Notes

- **Makefile fix:** The previous `-coverpkg=./model,...,./controller,...,./api,...` pattern incorrectly included transitive deps (bufio, encoding, etc.), inflating the denominator and showing ~15%. Fixed to `-coverpkg=./model,./controller,./api` — now `make coverage` correctly reports per-file coverage with deduplication for merged profiles.
- **Story 10.11:** All three packages reach 80% target.
- **JS/Playwright coverage deferred:** Playwright tests are integration/E2E; coverage would need V8 or Istanbul instrumentation. Skipped for Story 10.4.

---

## How to Run

```bash
# Go coverage (model via tests package)
make coverage

# HTML report (optional)
go tool cover -html=coverage.out
```
