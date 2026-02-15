# Epic 9: Code Quality & Technical Debt

**Status:** Backlog  
**Created:** 2026-02-15  
**Epic Type:** Quality & Maintenance

---

## Overview

This epic focuses on improving code quality, establishing quality standards, and addressing accumulated technical debt. It includes setting up linting, measuring complexity and coverage, and refactoring problematic areas.

---

## Goals

1. **Establish Quality Standards**: Set up linting, formatting, and complexity thresholds
2. **Measure Current State**: Assess test coverage and code complexity
3. **Address Technical Debt**: Rename Wails references, refactor complex code
4. **Document Standards**: Create guidelines for future development

---

## Stories

### Story 9.1: Rename Wails References

**Goal**: Remove obsolete Wails naming from codebase

**Tasks**:
- Rename `api_wails.go` → `api_electron.go` (or remove if obsolete)
- Rename `WailsAPI` → `ElectronAPI` or `NativeAPI`
- Update function names with "Wails" in them
- Update comments and documentation
- Update file paths in imports

**Acceptance Criteria**:
- No "Wails" references in active code
- All tests pass after renaming
- Documentation updated
- Git history preserved (use `git mv`)

**Reference**: See `TECHNICAL-DEBT.md` item #2

---

### Story 9.2: Setup Linting and Formatting

**Goal**: Establish automated code quality checks

**Tasks**:
- Add ESLint for JavaScript/frontend code
- Add golangci-lint for Go/backend code
- Configure Prettier for consistent formatting
- Add pre-commit hooks
- Update CI/CD to run linters
- Fix existing linting violations

**Acceptance Criteria**:
- ESLint configured and passing
- golangci-lint configured and passing
- Prettier formats all JS/CSS files
- Pre-commit hooks prevent bad commits
- CI fails on linting violations

---

### Story 9.3: Add Code Complexity Analysis

**Goal**: Identify and track code complexity

**Tasks**:
- Add cyclomatic complexity analysis for Go (gocyclo)
- Add complexity analysis for JavaScript (complexity-report)
- Set complexity thresholds
- Document high-complexity functions
- Create refactoring plan for worst offenders

**Acceptance Criteria**:
- Complexity tools integrated
- Baseline metrics documented
- Functions >15 complexity identified
- Refactoring plan created

---

### Story 9.4: Measure Test Coverage

**Goal**: Understand and improve test coverage

**Tasks**:
- Add Go test coverage reporting
- Add JavaScript/Playwright coverage reporting
- Set coverage targets (80% for critical paths)
- Identify untested code paths
- Add tests for critical gaps

**Acceptance Criteria**:
- Coverage reports generated
- Current coverage documented
- Critical paths have >80% coverage
- Coverage tracked in CI

---

### Story 9.5: Refactor High-Complexity Code

**Goal**: Reduce complexity in identified hotspots

**Tasks**:
- Refactor functions with complexity >15
- Extract helper functions
- Simplify conditional logic
- Add unit tests for refactored code
- Document design decisions

**Acceptance Criteria**:
- No functions >20 complexity
- Functions >15 complexity have justification
- All refactored code has tests
- Code is more readable

---

### Story 9.6: Document Code Quality Standards

**Goal**: Establish guidelines for future development

**Tasks**:
- Create `CONTRIBUTING.md` with coding standards
- Document linting rules and rationale
- Document complexity thresholds
- Document test coverage requirements
- Add examples of good practices
- Update README with quality badges

**Acceptance Criteria**:
- `CONTRIBUTING.md` exists and is comprehensive
- Standards are clear and actionable
- Examples provided for common patterns
- README shows quality badges (coverage, build status)

---

## Dependencies

**Prerequisites**:
- Epic 6 complete (CSV functionality stable)
- All tests passing
- CI/CD working

**Blocks**:
- None (quality improvements can proceed in parallel with feature work)

---

## Success Metrics

1. **Linting**: 0 linting violations in CI
2. **Complexity**: No functions >20 complexity, <5 functions >15
3. **Coverage**: >80% coverage for critical paths (model, controller, API)
4. **Technical Debt**: All items in `TECHNICAL-DEBT.md` addressed or documented
5. **Documentation**: `CONTRIBUTING.md` exists with clear standards

---

## Risks

1. **Time Investment**: Quality work takes time, may delay features
   - *Mitigation*: Prioritize highest-impact items first
2. **Breaking Changes**: Refactoring may introduce bugs
   - *Mitigation*: Comprehensive test suite catches regressions
3. **Scope Creep**: Quality improvements can be endless
   - *Mitigation*: Set clear thresholds and stop criteria

---

## Notes

- This epic can be done incrementally alongside feature work
- Some stories (9.1, 9.3) provide immediate value
- Others (9.4, 9.5) are cleanup and can be lower priority
- Quality improvements compound over time

---

## Related Documents

- `TECHNICAL-DEBT.md` - Current technical debt items
- `README.md` - Project overview and setup
- `.github/workflows/test.yml` - CI/CD configuration
