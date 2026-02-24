# Story 10.3: Add Code Complexity Analysis

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.3  
**Estimated Effort:** 2-3 hours  
**Status:** done  
**Created:** 2026-02-24

---

## Story

As a developer,  
I want code complexity measured and tracked,  
So that I can identify refactoring targets and prevent overly complex code.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron implementation
- Epic 5 complete: Playwright testing
- Story 10.2 (Linting) complete — ESLint, golangci-lint, Makefile patterns established

**Current State:**
- No cyclomatic complexity analysis for Go
- No complexity analysis for JavaScript
- No documented complexity thresholds
- Unknown which functions are overly complex

**Why This Story:**
High cyclomatic complexity correlates with bugs and maintenance cost. Measuring complexity establishes a baseline and identifies refactoring targets for Story 10.5.

---

## Acceptance Criteria

1. **Go complexity analysis**
   - [x] gocyclo integrated via `make complexity`
   - [x] `make complexity` runs Go complexity report
   - [x] Baseline metrics documented in complexity-baseline.md

2. **JavaScript complexity analysis**
   - [x] ESLint `complexity` rule (warn at 15) in eslint.config.js
   - [x] `npm run lint` surfaces complexity violations
   - [x] Baseline documented (1 function: app.js keydown handler, 29)

3. **Thresholds and documentation**
   - [x] Thresholds in complexity-baseline.md (warn >15, fail >20)
   - [x] High-complexity functions listed with file:line
   - [x] Refactoring plan for top 7 offenders (Story 10.5)

4. **CI integration (optional)**
   - [x] `make complexity` runs in CI (report only, does not fail)

---

## Tasks / Subtasks

- [x] Task 1: Go complexity (AC: #1)
- [x] Task 2: JavaScript complexity (AC: #2)
- [x] Task 3: Document and plan (AC: #3)
- [x] Task 4: CI (optional, AC: #4)

---

## Dev Notes

### Architecture Compliance

- **Makefile**: Follow existing pattern from Story 10.2 — `make lint` uses `go run ...@latest`. Use same for `make complexity`.
- **ESLint**: Flat config in `eslint.config.js`. Add rule to existing config block. ESLint has built-in `complexity` rule — no extra package.
- **Scope**: Go: `./...` (server/, api/, controller/, model/, tests/). JS: frontend/, electron/, playwright_tests/ (same as lint).

### Technical Requirements

**Go (gocyclo):**
- `gocyclo -over N ./...` reports functions with complexity > N
- Output format: `complexity package function file:line:col`
- Exclude `_test.go` if needed (gocyclo analyzes tests too — include for baseline)
- Alternative: Enable `gocyclo` linter in `.golangci.yml` — but that would fail CI. Prefer standalone report for now.

**JavaScript (ESLint complexity):**
- Rule: `"complexity": ["warn", 15]` — warn when cyclomatic complexity > 15
- ESLint counts: if, for, while, switch, &&, ||, ?:, catch, etc.
- Industry: 1-10 simple, 11-20 moderate, 21-50 complex, 51+ very complex
- Epic 9 target: no >20, <5 functions >15 (after 10.5 refactor)

### File Structure

- **New**: `_bmad-output/implementation-artifacts/complexity-baseline.md` (optional, for baseline doc)
- **Modify**: `Makefile` (add complexity target), `eslint.config.js` (add complexity rule), `package.json` (optional complexity script)

### Previous Story Intelligence (10.2)

- **golangci-lint**: `.golangci.yml` exists. Has `gocognit` and `cyclop` available but not enabled. gocyclo is separate tool.
- **ESLint**: Flat config, rules in single block. Add `complexity` alongside `no-unused-vars`.
- **Makefile**: `make lint` uses `go run ...@latest` — no global install. Same for gocyclo.
- **CI**: `.github/workflows/test.yml` has lint step. Add `make complexity` before or after lint if desired.
- **Don't**: Enable gocyclo in golangci-lint with fail threshold — would break CI until we fix. Use report-only for baseline.

### References

- [epic-9-code-quality.md](../planning-artifacts/epic-9-code-quality.md) — Story 9.3, success metrics
- [gocyclo](https://github.com/fzipp/gocyclo) — `gocyclo -over 10 .`
- [ESLint complexity rule](https://eslint.org/docs/latest/rules/complexity) — built-in, no plugin
- [Story 10.5](10-5-refactor-high-complexity-code.md) — consumes refactoring plan

---

## Dev Agent Record

### Agent Model Used

Cursor Composer

### Completion Notes List

- gocyclo uses `.` not `./...` (no recursive path support)
- Go: 1 function >15 (ExtractCellReferences 22), 6 functions >10
- JS: 1 function >15 (keydown handler 29) — ESLint complexity rule warns
- CI: make complexity runs as report-only (|| true) to avoid failing baseline

### File List

- Makefile (complexity target)
- eslint.config.js (complexity rule)
- _bmad-output/implementation-artifacts/complexity-baseline.md
- .github/workflows/test.yml (complexity step)
