# GoSheet Test Coverage

## Overview

GoSheet has two independent coverage pipelines — one for Go backend code, one for frontend JavaScript.

---

## Go Coverage

**Tool:** `go test -coverprofile` + `go tool cover`

**Run:**
```sh
make coverage
```

Runs all Go unit tests (`model/`, `controller/`, `api/`) and prints a per-file summary and total.

**Current baselines (as of 2026-03-13):**

| File | Coverage |
|------|----------|
| `api/handlers_format.go` | 94.6% |
| `api/handlers_structural.go` | 100% |
| `api/handlers.go` | 86.4% |
| `controller/app.go` | 89.4% |
| `controller/command.go` | 88.0% |
| `model/spreadsheet.go` | 93.3% |
| `model/style.go` | 94.0% |
| `model/file.go` | 78.2% |
| **Total** | **89.8%** |

**Targets:** ≥80% per file, ≥85% total. `model/file.go` at 78.2% is an accepted exception — the remaining uncovered lines are OS-level I/O fault paths (sync/close/rename failures) that require OS-level injection to exercise.

**CI:** Go coverage runs on every push. Output (`coverage.out`) is uploaded as a CI artifact.

---

## JavaScript Frontend Coverage

**Tool:** Istanbul (`istanbul-lib-instrument`) + `nyc` + Playwright E2E

**Approach:** Istanbul source instrumentation (see `_bmad-output/planning-artifacts/research/technical-js-coverage-research-2026-03-13.md` for rationale and alternatives considered).

### How it works

1. `scripts/instrument-frontend.js` rewrites `frontend/*.js` → `frontend-instrumented/`, injecting Istanbul counters. Uses `globalThis` scope so counters are accessible in ES module context.
2. The Go server serves `frontend-instrumented/` instead of `frontend/` when `COVERAGE=1` is set.
3. Playwright's `fixtures.js` extracts `window.__coverage__` from the renderer after each test file and writes it to `.nyc_output/`.
4. `nyc report` merges all JSON files and generates reports.

### Running

```sh
# Full pipeline (instrument + run all 344 tests + report):
make coverage-js

# Or step by step:
npm run coverage:instrument   # instrument only
COVERAGE=1 npm test           # run tests (writes .nyc_output/)
npm run coverage:report       # generate HTML + text summary

# Both Go and JS together:
make coverage-all
```

Reports are written to `coverage/` (HTML) and printed to stdout as a text summary.

### Current baselines (as of 2026-03-13, 344 tests)

| Metric | Result | Target |
|--------|--------|--------|
| Lines | 81.6% | 80% |
| Branches | 62.2% | 65% |
| Functions | 81.0% | 80% |

Branch coverage at 62.2% is below the 65% target. This is expected for E2E-only coverage — many error-handling branches and edge-case paths are never exercised by happy-path tests. The HTML report in `coverage/` shows exactly which branches are uncovered and is the primary tool for finding coverage gaps.

### Interpreting the results

Coverage from E2E tests is a **gap-finder**, not a quality gate. High line coverage (~80%) is normal even with mediocre tests. Branch coverage is the more meaningful metric — uncovered branches point to error states, input validation paths, and edge cases that no test exercises.

The `coverage/` HTML report lets you browse each file and see which specific branches (if/else arms, ternary expressions, `&&`/`||` short-circuits) were never hit.

### What's excluded

- `frontend-instrumented/` — generated, not committed
- `.nyc_output/` — raw JSON, not committed
- `coverage/` — HTML report, not committed

### CI

A "JS Coverage" CI step runs after the regular Playwright suite: it instruments, runs the full suite with `COVERAGE=1`, generates the report, and uploads `coverage/` as a CI artifact. The step uses `continue-on-error: true` — CI does not fail on coverage thresholds.
