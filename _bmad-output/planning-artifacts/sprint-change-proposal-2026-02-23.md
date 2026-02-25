# Sprint Change Proposal: Story 10.11 Redo — Methodical Coverage Target

**Date:** 2026-02-23  
**Workflow:** correct-course  
**Scope:** Minor — Story-level edit

---

## 1. Issue Summary

**Problem:** Story 10.11 (Add Unit Tests for Coverage Gaps) was implemented but the resulting coverage (~15.5%) is far from the 80% target. The story’s acceptance criteria were vague (“approach 80%”, “toward 80%”) and did not define a clear, repeatable process for reaching the target.

**Trigger:** Implementation revealed that the story did not prescribe a methodical approach. Tests were added for specific gaps, but there was no systematic way to drive coverage up to 80%.

**Evidence:**
- Current total coverage: ~15.5% (model + controller + api)
- Target: 80% per package (from coverage-baseline.md and Epic 9)
- Story AC used soft language (“approach”, “toward”) instead of a concrete target and workflow

---

## 2. Impact Analysis

**Epic Impact:** Epic 10 (Code Quality & Technical Debt) — Story 10.11 only.

**Story Impact:** Story 10.11 needs to be rewritten so that:
1. The 80% coverage target is explicit and required.
2. A methodical process is defined: go through Go source, identify uncovered code, add tests until the target is met.

**Artifact Conflicts:** None. PRD, Architecture, UI/UX unchanged.

**Technical Impact:** Story 10.11 will be reverted to `ready-for-dev` or `in-progress` and re-executed with the new criteria.

---

## 3. Recommended Approach

**Selected approach:** Direct Adjustment — modify Story 10.11 only.

**Rationale:**
- Scope is limited to one story.
- No epic or PRD changes.
- Implementation can proceed immediately with the updated story.

**Effort:** Low (story edit) + existing implementation effort (tests already added; more tests needed to reach 80%).

---

## 4. Detailed Change Proposals

### Story 10.11 — Add Unit Tests for Coverage Gaps

**Section: Story (user story)**

**OLD:**
```
As a developer,
I want unit tests added for large coverage gaps,
So that critical paths (model, controller, api) approach the 80% target and regressions are caught early.
```

**NEW:**
```
As a developer,
I want unit tests added methodically by going through Go source and covering each package,
So that model, controller, and api each reach the 80% coverage target and regressions are caught early.
```

**Rationale:** Makes the 80% target explicit and ties it to a methodical, source-driven process.

---

**Section: Acceptance Criteria**

**OLD:**
```
1. **Model coverage improved**
   - [ ] Add tests for 0% functions: LoadFromBytes, SaveToBytes, RecalculateAll, String, extractCellReferencesRegex
   - [ ] Add tests for low-coverage formula helpers (toNumber, value variants)
   - [ ] model/ coverage increases toward 80% (or document blockers)

2. **Controller coverage added**
   ...
   - [ ] controller/ coverage >0% (target: approach 80%)

3. **API coverage added**
   ...
   - [ ] api/ coverage >0% (target: approach 80%)
```

**NEW:**
```
1. **Model coverage reaches 80%**
   - [ ] Methodically add unit tests for model/ until `make coverage` shows model/ ≥ 80%
   - [ ] Run `go tool cover -func=coverage.out | grep model/` to identify uncovered functions
   - [ ] Add tests for each uncovered or low-coverage function until target is met

2. **Controller coverage reaches 80%**
   - [ ] Methodically add unit tests for controller/ until `make coverage` shows controller/ ≥ 80%
   - [ ] Identify uncovered functions via coverage report and add tests

3. **API coverage reaches 80%**
   - [ ] Methodically add unit tests for api/ until `make coverage` shows api/ ≥ 80%
   - [ ] Identify uncovered functions via coverage report and add tests

4. **Verification**
   - [ ] `make coverage` shows model/ ≥ 80%, controller/ ≥ 80%, api/ ≥ 80%
   - [ ] All tests pass (`go test ./tests/...`)
   - [ ] coverage-baseline.md updated with final numbers
```

**Rationale:** Replaces vague “approach/toward” with a clear 80% target and a repeatable workflow.

---

**Section: Tasks / Subtasks**

**OLD:** Task list focused on specific gaps (LoadFromBytes, SaveToBytes, etc.).

**NEW:**
```
- [ ] Task 1: Model — reach 80%
  - Run `make coverage`, inspect `go tool cover -func=coverage.out | grep model/`
  - For each function below 80%, add or extend tests in tests/
  - Iterate until model/ package coverage ≥ 80%

- [ ] Task 2: Controller — reach 80%
  - Run coverage, identify uncovered controller functions
  - Add tests in tests/controller_test.go (or new files as needed)
  - Iterate until controller/ package coverage ≥ 80%

- [ ] Task 3: API — reach 80%
  - Run coverage, identify uncovered api functions
  - Add tests in tests/api_test.go (or new files as needed)
  - Iterate until api/ package coverage ≥ 80%

- [ ] Task 4: Verify and document
  - Run `make coverage`, confirm all three packages ≥ 80%
  - Run `go test ./tests/...`, all pass
  - Update coverage-baseline.md with final baseline
```

**Rationale:** Describes a methodical, coverage-driven workflow instead of a fixed list of gaps.

---

**Section: Dev Notes — add "Methodical Approach"**

**ADD:**
```
### Methodical Approach (Required)

1. **Run coverage baseline:** `make coverage`
2. **Get per-package totals:** `go tool cover -func=coverage.out | grep -E "model/|controller/|api/" | awk '...'` (or inspect output)
3. **Pick lowest-coverage package** and run `go tool cover -func=coverage.out | grep gosheet/<package>/`
4. **For each function below 80%:** Add or extend a test that exercises it
5. **Re-run coverage** after each batch of tests
6. **Repeat** until model/, controller/, and api/ each show ≥ 80%
7. **Document blockers** only if a function cannot be unit-tested (e.g., requires OS-specific behavior); note in coverage-baseline.md
```

**Rationale:** Gives a concrete, repeatable process for reaching the target.

---

**Section: Status**

**OLD:** `Status: review`

**NEW:** `Status: ready-for-dev` (or `in-progress` if re-implementation starts immediately)

**Rationale:** Story is being redone; previous completion is superseded.

---

## 5. Implementation Handoff

**Scope:** Minor — Development team implements directly.

**Handoff:** Development team

**Deliverables:**
- Updated Story 10.11 file with new acceptance criteria and tasks
- Implementation follows the methodical approach until 80% is reached

**Success criteria:**
- Story 10.11 file reflects the changes above
- `make coverage` eventually shows model/, controller/, api/ each ≥ 80%
- coverage-baseline.md updated
