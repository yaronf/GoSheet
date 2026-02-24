# Story 10.2: Setup Linting and Formatting

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.2  
**Estimated Effort:** 2-3 hours  
**Status:** done  
**Created:** 2026-02-24

---

## Story

As a developer,  
I want automated linting and formatting configured for the codebase,  
So that code quality is enforced consistently and bad commits are prevented.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron implementation
- Epic 5 complete: Playwright Electron testing
- All tests passing (`npm run test:all`)

**Current State:**
- No ESLint for JavaScript/frontend
- No golangci-lint for Go
- No Prettier for formatting
- No pre-commit hooks
- CI (.github/workflows/test.yml) runs tests but not linters

**Why This Story:**
Establishing linting and formatting early prevents style drift and catches common bugs. Pre-commit hooks and CI integration ensure quality before code is merged.

---

## Acceptance Criteria

1. **ESLint configured and passing**
   - [x] ESLint installed as devDependency
   - [x] `eslint.config.js` configured for frontend, electron, playwright_tests
   - [x] `npm run lint` runs ESLint
   - [x] Existing code passes ESLint

2. **golangci-lint configured and passing**
   - [x] `.golangci.yml` with errcheck, govet, gofmt, ineffassign, staticcheck
   - [x] `make lint` runs golangci-lint
   - [x] Existing Go code passes

3. **Prettier for consistent formatting**
   - [x] Prettier installed as devDependency
   - [x] `.prettierrc` configured
   - [x] `npm run format` and `format:check` for JS/CSS
   - [x] eslint-config-prettier to avoid conflicts

4. **Pre-commit hooks**
   - [x] husky + lint-staged runs ESLint, Prettier, gofmt on staged files
   - [x] Bad commits blocked when lint fails

5. **CI integration**
   - [x] `.github/workflows/test.yml` runs lint step (npm run lint, format:check, make lint)
   - [x] CI fails on linting violations

---

## Tasks / Subtasks

- [x] Task 1: Add ESLint (AC: #1)
- [x] Task 2: Add golangci-lint (AC: #2)
- [x] Task 3: Add Prettier (AC: #3)
- [x] Task 4: Pre-commit hooks (AC: #4)
- [x] Task 5: CI integration (AC: #5)

---

## Dev Notes

### Project Structure Notes

- **frontend/**: HTML, CSS, JS (ES6 modules). ESLint + Prettier target these.
- **electron/**: Node.js main process. Include in ESLint scope.
- **server/**, **model/**, **controller/**, **api/**, **tests/**: Go code. golangci-lint targets these.

### Recommended Tools

- **ESLint**: `eslint` + `eslint-plugin-no-only-tests` if Playwright tests use `.only`
- **Prettier**: Standard config; use `eslint-config-prettier` to disable conflicting ESLint rules
- **golangci-lint**: Enable `gofmt`, `govet`, `errcheck`; add more linters as needed

### References

- [Source: _bmad-output/planning-artifacts/epic-9-code-quality.md] - Story 9.2: Setup Linting and Formatting
- [ESLint](https://eslint.org/)
- [golangci-lint](https://golangci-lint.run/)
- [Prettier](https://prettier.io/)
- [husky](https://typicode.github.io/husky/)

---

## Dev Agent Record

### Agent Model Used

Cursor Composer

### Completion Notes List

- Fixed ESLint errors: electron main.js top-level return (→ process.exit), app.js columnToIndex/indexToColumn → letterToCol/colToLetter, unused vars, fixtures.js no-empty-pattern.
- Added eslint config: argsIgnorePattern/varsIgnorePattern for `_` prefix.
- Fixed golangci-lint: gofmt, errcheck (json.Encode, SetCellValue, fmt.Sscanf), govet shadow, gosimple (loop → append).
- Pre-commit: husky + lint-staged for *.js, *.css, *.go.

### File List

- eslint.config.js, .prettierrc, .golangci.yml
- package.json (lint, format, lint-staged, husky)
- Makefile (make lint)
- .husky/pre-commit
- .github/workflows/test.yml
- frontend/app.js, electron/main.js, api/csv.go, server/main.go, model/formula_ast.go, model/dependencies.go, tests/file_test.go, tests/coords_test.go, controller/app.go
- playwright_tests/fixtures.js, test_csv_import.spec.js, test_file_operations.spec.js, test_menu.spec.js, test_quit_warning.spec.js
