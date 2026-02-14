# Story 2.5: Verify All Tests Pass

**Epic:** 2 - Web Mode Preservation  
**Story ID:** 2.5  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** all tests to pass after Epic 2 implementation  
**So that** web mode preservation is verified and regression-free

---

## Business Context

This story validates that Stories 2.1–2.4 did not introduce regressions. Both the Go unit/integration tests and Playwright UI tests must pass. Any test updates needed (e.g., test.sh using cmd/web) are documented and applied.

**Why this matters:** Epic 2 delivers web mode preservation with unified API. Verification ensures the migration is complete and the application remains functional.

**Previous Context:**
- Story 2.1: cmd/web entry point
- Story 2.2: HttpAPI wrapper
- Story 2.3: FileService
- Story 2.4: Frontend api-client

---

## Acceptance Criteria

**Given** all Epic 2 stories are implemented  
**When** I run `go test ./tests/... -v`  
**Then** all tests pass  
**And** when I run `./test.sh`  
**Then** all Playwright tests pass (32 passed, 1 skipped is acceptable)  
**And** test.sh uses cmd/web (not server) for web mode  
**And** any test updates are documented  
**And** epic-2 is marked "done" in sprint-status.yaml

---

## Test Verification

### Go Tests

```bash
go test ./tests/... -v
```

**Result:** All tests pass. Test suite includes model, controller, formula evaluation, dependencies, and API tests.

### Playwright Tests

```bash
./test.sh
```

**Result:** 32 passed, 1 skipped. The skipped test (`test_edit_formula_shows_formula_not_result`) was pre-existing (keyboard event not triggering in Playwright).

### Test Updates Applied

1. **test.sh**: Updated to use `go run ./cmd/web` instead of `cd server && go run main.go` so Playwright runs against web mode with unified API.
2. **test.sh**: Updated pkill pattern to `go run ./cmd/web` for cleanup.

---

## Definition of Done

- [x] `go test ./tests/... -v` passes
- [x] `./test.sh` passes (32 Playwright tests)
- [x] test.sh uses cmd/web
- [x] Test updates documented
- [x] epic-2 marked "done" in sprint-status.yaml

---

## Related Stories

**Previous Story:** 2.4 - Update Frontend for Unified API  
**Epic Goal:** Preserve web mode with unified API layer

---

## Story Completion Notes

**Implementation Date:** 2026-02-15  
**Developer Notes:** All Go tests and Playwright tests pass. test.sh updated to use cmd/web. No test code changes required—api-client and unified API work correctly with existing Playwright expectations.  
**Challenges Encountered:** None.  
**Learnings:** Epic 2 complete; web mode fully preserved with unified API layer.
