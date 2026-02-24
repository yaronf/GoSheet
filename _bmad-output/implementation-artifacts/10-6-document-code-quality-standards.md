# Story 10.6: Document Code Quality Standards

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.6  
**Estimated Effort:** 2-3 hours  
**Status:** done  
**Created:** 2026-02-24

---

## Story

As a developer,  
I want code quality standards documented,  
So that contributors know the expectations and tools to use.

---

## Context

**Prerequisites:**
- Story 10.2 complete: Linting and formatting configured
- Story 10.3 complete: Complexity thresholds established
- Story 10.4 complete: Coverage targets set (or in progress — document placeholders)
- CONTRIBUTING.md exists with dev setup

**Current State:**
- CONTRIBUTING.md has dev setup, testing, PR process
- No dedicated section on code quality (complexity, coverage, lint rules)
- No quality badges in README
- Linting rules and rationale not documented

**Why This Story:**
Consolidating quality standards in one place helps contributors and maintains consistency. CONTRIBUTING.md can be expanded; this story ensures quality-specific guidance is complete.

**Reference:** [epic-9-code-quality.md](../planning-artifacts/epic-9-code-quality.md) - Story 9.6

---

## Acceptance Criteria

1. **CONTRIBUTING.md expanded**
   - [x] Code Quality section added
   - [x] Linting rules and rationale documented
   - [x] Complexity thresholds documented (from 10.3)
   - [x] Test coverage requirements documented (from 10.4)
   - [x] Examples of good practices (formatting, naming, structure)

2. **Standards are actionable**
   - [x] Clear "do" and "don't" examples
   - [x] Links to tool configs (eslint.config.js, .golangci.yml, .prettierrc)
   - [x] How to run quality checks before PR

3. **README quality badges (optional)**
   - [x] Build status badge (GitHub Actions)
   - [ ] Coverage badge (CI does not publish coverage yet)
   - [x] Link to CONTRIBUTING.md for quality info

4. **Consistency**
   - [x] Standards align with actual tool config (10.2, 10.3, 10.4)
   - [x] No contradictions with existing CONTRIBUTING.md

---

## Tasks / Subtasks

- [x] Task 1: Expand CONTRIBUTING.md (AC: #1)
  - [x] Add "Code Quality" section
  - [x] Document lint rules (ESLint, golangci-lint)
  - [x] Document complexity thresholds
  - [x] Document coverage targets
  - [x] Add 2-3 examples of good patterns
- [x] Task 2: Ensure actionable (AC: #2)
  - [x] Add "Before submitting a PR" checklist
  - [x] Link to `make lint`, `npm run lint`, `make coverage`
- [x] Task 3: README badges (AC: #3, optional)
  - [x] Add build status badge
  - [ ] Coverage badge (CI does not publish coverage)
- [x] Task 4: Review consistency (AC: #4)
  - [x] Cross-check with 10.2, 10.3, 10.4 outputs

---

## Dev Notes

### CONTRIBUTING.md Structure
- Keep existing sections (Setup, Testing, PR process)
- Add new "Code Quality" section with subsections:
  - Linting
  - Complexity
  - Coverage
  - Examples

### Badges
- Build: `![Build](https://github.com/yaronf/GoSheet/actions/workflows/test.yml/badge.svg)`
- Coverage: Requires coverage reporting service (Codecov, Coveralls) or GitHub Actions artifact

### Architecture Compliance
- **CONTRIBUTING.md**: Exists at repo root; expand, don't replace
- **Tool configs**: eslint.config.js, .prettierrc, .golangci.yml, .golangci.yml (Story 10.2)
- **Sources**: complexity-baseline.md (10.3), coverage-baseline or 10.4 output (10.4)

### Previous Story Intelligence (10.2, 10.3)
- Lint: `npm run lint`, `make lint`, `npm run format:check`
- Complexity: `make complexity`, thresholds in complexity-baseline.md
- Coverage: `make coverage` (after 10.4)

### File Structure
- **Modify**: CONTRIBUTING.md, README.md (optional badges)
- **No new files** — expand existing docs

---

## References

- [epic-9-code-quality.md](../planning-artifacts/epic-9-code-quality.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Existing file to expand
- [Story 10.2](10-2-setup-linting-and-formatting.md) - Linting config
- [Story 10.3](10-3-add-code-complexity-analysis.md) - Complexity thresholds
- [Story 10.4](10-4-measure-test-coverage.md) - Coverage targets

---

## Dev Agent Record

### File List
- CONTRIBUTING.md — Code Quality section, PR checklist
- README.md — Build badge, Contributing link

### Change Log
- 2026-02-23: Added Code Quality section (lint, format, complexity, coverage, examples); PR checklist; README build badge

---

## Change Log

- 2026-02-24: Story created

---

## Status

**Current Status:** done  
**Last Updated:** 2026-02-23

Code quality standards documented in CONTRIBUTING.md. Build badge added to README.
