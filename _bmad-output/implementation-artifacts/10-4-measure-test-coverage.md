# Story 10.4: Measure Test Coverage

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.4  
**Estimated Effort:** 2-3 hours  
**Status:** done  
**Created:** 2026-02-24

---

## Story

As a developer,  
I want test coverage measured and reported,  
So that I know which code paths are tested and can prioritize adding tests.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron implementation
- Epic 5 complete: Playwright testing
- All tests passing (`npm run test:all`)

**Current State:**
- Go: `go test -cover` works but not integrated into workflow
- Playwright: No coverage reporting
- No coverage targets or baseline documented
- Unknown coverage for model/, controller/, api/

**Why This Story:**
Understanding coverage helps prioritize test additions and ensures critical paths (model, controller, API) are well-tested. Epic 9 target: >80% for critical paths.

**Reference:** [epic-9-code-quality.md](../planning-artifacts/epic-9-code-quality.md) - Story 9.4

---

## Acceptance Criteria

1. **Go coverage reporting**
   - [x] `go test -coverprofile=coverage.out -coverpkg=./model,...,./controller,...,./api,... ./tests/...` produces coverage
   - [x] `make coverage` runs coverage and prints summary
   - [x] Coverage documented: model 13.7% (tests/ imports model only; controller/api not covered by unit tests)
   - [x] HTML: `go tool cover -html=coverage.out`

2. **Playwright/JavaScript coverage (optional)**
   - [x] Documented: Playwright tests are integration tests (coverage less critical for this story)

3. **Documentation**
   - [x] coverage-baseline.md with targets (80% model, controller, api), current baseline, gaps

4. **CI integration (optional)**
   - [x] Coverage step in CI (make coverage)
   - [x] coverage.out uploaded as artifact

---

## Tasks / Subtasks

- [x] Task 1: Go coverage (AC: #1)
- [x] Task 2: Playwright coverage (AC: #2, optional) — documented as integration
- [x] Task 3: Document and targets (AC: #3)
- [x] Task 4: CI (optional, AC: #4)

---

## Dev Notes

### Go Coverage
```bash
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out   # summary
go tool cover -html=coverage.out  # HTML report
```

### Critical Paths
- **model/**: Formula engine, cell logic, dependency graph
- **controller/**: App logic
- **api/**: Response handling, interfaces

### Success Metrics (from Epic 9)
- >80% coverage for critical paths (model, controller, API)

### Architecture Compliance
- **Makefile**: Add `make coverage` following `make lint` pattern (Story 10.2)
- **Go packages**: `model/`, `controller/`, `api/`, `server/`, `tests/` — run `go test -cover ./...` from repo root
- **.gitignore**: Add `coverage.out`, `coverage.html`

### Previous Story Intelligence (10.2, 10.3)
- Makefile uses `go run ...@latest` pattern; coverage uses `go test` (built-in)
- CI: `.github/workflows/test.yml` has lint step; add coverage step after tests
- Playwright: Tests run with `NODE_ENV=test`; coverage for JS is optional (integration tests)

### File Structure
- **Modify**: Makefile, .gitignore, .github/workflows/test.yml
- **New**: `_bmad-output/implementation-artifacts/coverage-baseline.md` (optional)

---

## References

- [epic-9-code-quality.md](../planning-artifacts/epic-9-code-quality.md)
- [Go cover](https://go.dev/blog/cover)
- [Playwright coverage](https://playwright.dev/docs/test-coverage)

---

## Dev Agent Record

### Agent Model Used

Cursor Composer

### Completion Notes List

- tests/ package only imports model — controller, api have 0% unit coverage (exercised via server/Playwright)
- Used -coverpkg to include model, controller, api in coverage profile
- model baseline: 13.7%; targets 80% for critical paths

### File List

- Makefile (coverage target)
- .gitignore (coverage.out, coverage.html)
- _bmad-output/implementation-artifacts/coverage-baseline.md
- .github/workflows/test.yml (coverage step, upload artifact)

---

## Change Log

- 2026-02-24: Story created

---

## Status

**Current Status:** done  
**Last Updated:** 2026-02-24

Add test coverage reporting for Go and optionally Playwright.
