# Story 10.11: Add Unit Tests for Coverage Gaps

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.11  
**Estimated Effort:** 4-6 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-24

---

## Story

As a developer,  
I want unit tests added for large coverage gaps,  
So that critical paths (model, controller, api) approach the 80% target and regressions are caught early.

---

## Context

**Prerequisites:**
- Story 10.4 complete: Coverage measured, baseline documented

**Current State:**
- **model/**: 13.7% (target 80%) — tests/ imports model only
- **controller/**: 0% — no unit tests
- **api/**: 0% — no unit tests
- coverage-baseline.md lists specific gaps

**Why This Story:**
Epic 9 target: >80% for critical paths. Current baseline shows large gaps. Unit tests for controller and api are missing entirely; model has many untested functions.

**Reference:** [coverage-baseline.md](coverage-baseline.md), [10-4-measure-test-coverage.md](10-4-measure-test-coverage.md)

---

## Acceptance Criteria

1. **Model coverage improved**
   - [ ] Add tests for 0% functions: LoadFromBytes, SaveToBytes, RecalculateAll, String, extractCellReferencesRegex
   - [ ] Add tests for low-coverage formula helpers (toNumber, value variants)
   - [ ] model/ coverage increases toward 80% (or document blockers)

2. **Controller coverage added**
   - [ ] tests/controller_test.go (or equivalent) added
   - [ ] AppController.SetCellValue, GetCellValue, GetCellRawValue, GetCellRef covered
   - [ ] Circular reference handling tested
   - [ ] controller/ coverage >0% (target: approach 80%)

3. **API coverage added**
   - [ ] tests/api_test.go (or equivalent) added
   - [ ] Response struct, error codes, CSV types covered
   - [ ] api/ coverage >0% (target: approach 80%)

4. **Verification**
   - [ ] `make coverage` shows improved numbers
   - [ ] All tests pass (`go test ./tests/...`)
   - [ ] coverage-baseline.md updated with new baseline

---

## Tasks / Subtasks

- [ ] Task 1: Model gaps (AC: #1)
  - [ ] tests/file_test.go: Add LoadFromBytes, SaveToBytes tests (use temp files or bytes)
  - [ ] tests/model_test.go or new: RecalculateAll, String
  - [ ] tests/dependencies_test.go: extractCellReferencesRegex (if exported) or via ExtractCellReferences
  - [ ] tests/formula_test.go: toNumber, value edge cases
- [ ] Task 2: Controller (AC: #2)
  - [ ] Create tests/controller_test.go
  - [ ] Test SetCellValue (plain, formula, circular ref)
  - [ ] Test GetCellValue, GetCellRawValue, GetCellRef
  - [ ] Test NewFile, HasUnsavedChanges
- [ ] Task 3: API (AC: #3)
  - [ ] Create tests/api_test.go
  - [ ] Test Response struct, error codes
  - [ ] Test CSV request/response types if testable in isolation
- [ ] Task 4: Verify and document (AC: #4)
  - [ ] Run make coverage, record new baseline
  - [ ] Update coverage-baseline.md

---

## Dev Notes

### Architecture Compliance

- **tests/** package: Add controller_test.go, api_test.go alongside existing model tests
- **Import pattern**: `import "gosheet/controller"`, `import "gosheet/api"`
- **Test framework**: testify/assert (already used in tests/)
- **Coverage**: Run `make coverage` after changes; use `-coverpkg=./model,...,./controller,...,./api,...`

### Priority Order (from coverage-baseline.md)

**Model (0% → covered):**
1. model/file.go: LoadFromBytes, SaveToBytes
2. model/spreadsheet.go: RecalculateAll, String
3. model/dependencies.go: extractCellReferencesRegex (unexported — test via ExtractCellReferences)
4. model/formula.go: toNumber, value

**Controller (0% → covered):**
- AppController methods — use NewAppController(), exercise Sheet

**API (0% → covered):**
- Response, error codes — simple struct/const tests
- CSV types — if they have validation logic

### Previous Story Intelligence (10.4)

- tests/ only imports model — controller and api have 0% because no tests import them
- Adding `import "gosheet/controller"` and tests will increase controller coverage
- coverage.out is created by `go test -coverprofile=coverage.out -coverpkg=... ./tests/...`
- Don't break existing tests — run `go test ./tests/... -v` frequently

### File Structure

- **New**: tests/controller_test.go, tests/api_test.go
- **Modify**: tests/file_test.go, tests/model_test.go, tests/formula_test.go, tests/dependencies_test.go
- **Update**: coverage-baseline.md

### References

- [coverage-baseline.md](coverage-baseline.md) — gaps and targets
- [10-4-measure-test-coverage.md](10-4-measure-test-coverage.md) — coverage setup
- [epic-9-code-quality.md](../planning-artifacts/epic-9-code-quality.md) — 80% target

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled by dev agent)
