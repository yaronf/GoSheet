# Story 10.5: Refactor High-Complexity Code

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.5  
**Estimated Effort:** 4-6 hours  
**Status:** done  
**Created:** 2026-02-24

---

## Story

As a developer,  
I want high-complexity functions refactored,  
So that the codebase is maintainable and less error-prone.

---

## Context

**Prerequisites:**
- Story 10.3 complete: Complexity analysis run, refactoring plan created
- All tests passing

**Current State:**
- Story 10.3 will identify functions with cyclomatic complexity >15
- Refactoring plan will list worst offenders
- No refactoring done yet

**Why This Story:**
High complexity correlates with bugs. Refactoring improves readability and testability. Epic 9 target: no functions >20, <5 functions >15.

**Reference:** [epic-9-code-quality.md](../planning-artifacts/epic-9-code-quality.md) - Story 9.5

---

## Acceptance Criteria

1. **Refactor identified functions**
   - [x] All functions >20 complexity refactored
   - [x] Top 5-10 functions >15 complexity refactored (per 10.3 plan)
   - [x] Functions >15 that remain have documented justification (none remain)

2. **Refactoring techniques**
   - [x] Extract helper functions
   - [x] Simplify conditional logic (early returns, guard clauses)
   - [x] Break up long functions
   - [x] No behavior changes (refactor only)

3. **Tests**
   - [x] All refactored code has unit tests (covered by existing tests)
   - [x] Existing tests still pass
   - [x] No regressions
   - *Note:* Go refCollector covered by TestDependencyGraph_ExtractCellReferences. JS helpers covered by Playwright E2E (test_keyboard_shortcuts.spec.js, test_spreadsheet.spec.js); no JS unit test framework in project.

4. **Documentation**
   - [x] Design decisions documented (inline or in story)
   - [x] Complexity baseline updated after refactoring

---

## Tasks / Subtasks

- [x] Task 1: Refactor Go functions (AC: #1, #2)
  - [x] Start with functions >20 from 10.3 report (ExtractCellReferences)
  - [x] Extract helpers, simplify conditionals (refCollector + walk methods)
  - [x] Run `go test ./...` after each change
- [x] Task 2: Refactor JavaScript functions (AC: #1, #2)
  - [x] Address high-complexity functions in frontend/app.js (keydown handler)
  - [x] Extract helpers, reduce nesting (handleKeydownFileOps, handleKeydownCellNavigation)
  - [x] Run `npm test` after each change
- [x] Task 3: Add tests (AC: #3)
  - [x] Existing tests cover refactored code
  - [x] Coverage maintained
- [x] Task 4: Document (AC: #4)
  - [x] No functions >15 remain
  - [x] Update complexity baseline

---

## Dev Notes

### Refactoring Order
1. Functions >20 (must fix)
2. Functions 15-20 (high priority)
3. Functions 10-15 (as time allows)

### Safe Refactoring
- One function at a time
- Run tests after each change
- Use git commits to checkpoint

### Out of Scope
- Feature changes
- Performance optimization (unless part of simplification)

### Architecture Compliance
- **Refactoring plan**: [complexity-baseline.md](complexity-baseline.md) — priority order (7 items)
- **Verification**: Run `make complexity` and `npm run lint` after each refactor
- **Tests**: `go test ./...` and `npm test` must pass

### Previous Story Intelligence (10.3)
- **Go >15**: ExtractCellReferences (22) — model/dependencies.go:47
- **JS >15**: keydown handler (29) — frontend/app.js:879
- **Strategy**: Split keydown handler by category (file ops, edit ops, navigation); extract switch cases in ExtractCellReferences
- **Don't**: Change behavior — refactor only

### File Structure
- **Modify**: model/dependencies.go, model/formula.go, controller/app.go, server/main.go, frontend/app.js
- **Update**: complexity-baseline.md after refactoring

---

## References

- [epic-9-code-quality.md](../planning-artifacts/epic-9-code-quality.md)
- [Story 10.3](10-3-add-code-complexity-analysis.md) - Provides refactoring plan

---

## Dev Agent Record

### File List
- model/dependencies.go — ExtractCellReferences refactored to refCollector
- frontend/app.js — keydown handler split into handleKeydownFileOps, handleKeydownCellNavigation
- _bmad-output/implementation-artifacts/complexity-baseline.md — updated
- _bmad-output/implementation-artifacts/sprint-status.yaml — 10-5 set to done

### Change Log
- 2026-02-23: Refactored ExtractCellReferences (22→<15) via refCollector; app.js keydown (29→<15) via split handlers
- 2026-02-23: Code review fixes: File List +sprint-status; ensureSpreadsheetView hoisted, optional chaining on getElementById; refCollector godoc

---

## Change Log

- 2026-02-24: Story created

---

---

## Senior Developer Review (AI)

**Date:** 2026-02-23  
**Outcome:** Approve (fixes applied)

**Findings addressed:**
- File List: Added sprint-status.yaml
- AC #3: Documented that JS helpers are covered by Playwright E2E (no JS unit framework)
- app.js: Hoisted ensureSpreadsheetView; added optional chaining on getElementById
- dependencies.go: Added godoc to refCollector methods

---

## Status

**Current Status:** done  
**Last Updated:** 2026-02-23

Refactored ExtractCellReferences and app.js keydown handler. No functions >15 remain. Code review fixes applied.
