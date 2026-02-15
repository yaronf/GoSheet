# Story 5.6: Verify Native Tests Pass

**Epic:** 5 - Native Testing Infrastructure  
**Story ID:** 5.6  
**Status:** in-progress  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** to verify all native tests actually run and pass  
**So that** I can confirm the testing infrastructure works end-to-end

---

## Business Context

Epic 5 (Stories 5.1-5.5) created all the test infrastructure and tests, but never actually ran them to verify they work. This is the same mistake as Epic 4 - marking "done" without testing. Story 5.6 ensures we actually run the tests, fix any failures, and validate the infrastructure before marking Epic 5 complete.

---

## Acceptance Criteria

**Given** all native tests are written (Stories 5.1-5.5)  
**When** I set up the testing environment:
- Install dependencies: `pip install pyax[highlight] pytest`
- Enable macOS accessibility permissions
- Build the app: `go build -o build/GoSheet .`
**Then** the environment is ready for testing

**When** I run `pytest tests/native/ -v`  
**Then** all native tests are discovered (7+ tests)  
**And** all tests pass successfully (0 failures)  
**And** tests complete in < 60 seconds total  
**And** test output shows all expected tests PASSED

**And** if any test fails, I investigate and fix the issue  
**And** I document test results in story completion notes  
**And** I verify `make test-native` command works  
**And** I verify `make test-all` runs all test suites  
**When** all tests pass  
**Then** Epic 5 is truly complete and native testing infrastructure is validated

---

## Technical Approach

1. Create Python virtual environment (if needed)
2. Install pyax[highlight] and pytest
3. Build GoSheet app (wails3 build or go build -o build/GoSheet .)
4. Run pytest tests/native/ -v
5. Fix any failures
6. Document results
7. Verify Makefile targets
8. Update sprint-status.yaml

---

## Implementation Checklist

- [ ] Set up Python environment and install dependencies
- [ ] Build app to build/GoSheet
- [ ] Run pytest and verify all tests pass
- [ ] Fix any test failures
- [ ] Document test results in completion notes
- [ ] Verify make test-native works
- [ ] Mark story done in sprint-status.yaml
- [ ] Mark Epic 5 done in sprint-status.yaml

---

## Story Completion Notes

(To be filled after tests pass)

---

## Dev Notes

### References
- [Source: epics.md#Story-5.6]
- [Source: Epic 4 Retrospective - verify before marking done]
