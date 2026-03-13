# Story 22.1: JavaScript Frontend Coverage

Status: in-progress

## Story

As a developer working on GoSheet,
I want Istanbul-based branch/line/function coverage for the frontend JS,
so that I can identify untested code paths and enforce a coverage gate in CI.

## Background

See research: `_bmad-output/planning-artifacts/research/technical-js-coverage-research-2026-03-13.md`

Approach: Istanbul source instrumentation (Option C from research). Pre-instrument `frontend/*.js` with `istanbul-lib-instrument`, serve instrumented files when `COVERAGE=1`, extract `window.__coverage__` in Playwright `globalTeardown`, report with `nyc`.

## Acceptance Criteria

1. **Given** `COVERAGE=1 npm test` is run
   **When** tests complete
   **Then** `.nyc_output/coverage.json` exists and contains coverage data for all `frontend/*.js` files

2. **Given** coverage data has been collected
   **When** `npm run coverage:report` is run
   **Then** an HTML report is generated in `coverage/` and a text summary is printed to stdout showing line/branch/function percentages

3. **Given** the CI workflow
   **When** coverage is collected
   **Then** CI prints the text summary and uploads the HTML report as an artifact; CI does NOT fail on coverage thresholds (report-only for now)

4. **Given** `npm test` is run without `COVERAGE=1`
   **When** tests complete
   **Then** behavior is identical to today — no instrumentation, no coverage output, no performance impact

5. **Given** the instrumented frontend files
   **When** served to the renderer
   **Then** all 344 existing Playwright tests still pass (instrumentation must not alter runtime behavior)

6. **Given** the coverage report
   **Then** it covers all JS files under `frontend/` (excluding generated or vendor files if any)

## Coverage Targets (informational, not CI gates yet)

| Metric   | Gate (CI fail) | Goal |
|----------|---------------|------|
| Line     | 80%           | 85%  |
| Branch   | 65%           | 75%  |
| Function | 80%           | 90%  |

## Tasks

1. Add npm dev dependencies: `istanbul-lib-instrument`, `nyc`
2. Write `scripts/instrument-frontend.js` — instruments `frontend/*.js` → `frontend-instrumented/`
3. Modify Go server to serve from `frontend-instrumented/` when `COVERAGE=1` is set in the environment
4. Add Playwright `globalTeardown` that extracts `window.__coverage__` and writes `.nyc_output/coverage.json`
5. Wire `globalTeardown` into `playwright.config.js`
6. Add `.nycrc.json` (or `nyc` config in `package.json`) pointing at source files
7. Add npm scripts: `coverage:instrument`, `coverage:report`, update `test` script to support `COVERAGE=1`
8. Add `.gitignore` entries for `frontend-instrumented/`, `.nyc_output/`, `coverage/`
9. Add CI step: run with `COVERAGE=1`, run `coverage:report`, upload HTML artifact
10. Verify all 344 tests pass under instrumentation

## Notes

- `istanbul-lib-instrument` rewrites JS in-place — instrumented files are functionally identical but heavier. Only used when `COVERAGE=1`.
- `nyc report` (without `nyc run`) accepts pre-existing JSON in `.nyc_output/` — it is purely a report generator.
- `page.evaluate(() => window.__coverage__)` confirmed to work for Electron renderer globals.
- Instrumented files should NOT be committed to git.
