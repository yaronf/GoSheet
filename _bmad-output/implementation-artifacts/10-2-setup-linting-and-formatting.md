# Story 10.2: Setup Linting and Formatting

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.2  
**Estimated Effort:** 2-3 hours  
**Status:** ready-for-dev  
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
   - [ ] ESLint installed as devDependency
   - [ ] `.eslintrc.js` or `eslint.config.js` configured for frontend (frontend/*.js)
   - [ ] `npm run lint` (or similar) runs ESLint
   - [ ] Existing code passes ESLint (fix auto-fixable issues)

2. **golangci-lint configured and passing**
   - [ ] golangci-lint configured (`.golangci.yml` or inline config)
   - [ ] `make lint` or `go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run` works
   - [ ] Existing Go code passes (fix critical issues; defer stylistic if needed)

3. **Prettier for consistent formatting**
   - [ ] Prettier installed as devDependency
     - [ ] `.prettierrc` or config in package.json
   - [ ] Prettier formats JS/CSS (frontend/)
   - [ ] `npm run format` runs Prettier
   - [ ] Prettier and ESLint work together (eslint-config-prettier to avoid conflicts)

4. **Pre-commit hooks**
   - [ ] husky + lint-staged (or simple pre-commit script) runs linters on staged files
   - [ ] Bad commits are blocked when lint fails

5. **CI integration**
   - [ ] `.github/workflows/test.yml` (or equivalent) runs lint step
   - [ ] CI fails on linting violations

---

## Tasks / Subtasks

- [ ] Task 1: Add ESLint (AC: #1)
  - [ ] `npm install -D eslint`
  - [ ] Create ESLint config for frontend JS
  - [ ] Add `lint` script to package.json
  - [ ] Run `npm run lint` and fix violations (or add `--max-warnings` temporarily)
- [ ] Task 2: Add golangci-lint (AC: #2)
  - [ ] Add `.golangci.yml` with sensible defaults
  - [ ] Add `make lint` or npm script to run golangci-lint
  - [ ] Fix critical issues; document deferred items
- [ ] Task 3: Add Prettier (AC: #3)
  - [ ] `npm install -D prettier eslint-config-prettier`
  - [ ] Configure Prettier (e.g., 2-space indent, single quotes)
  - [ ] Add `format` script
  - [ ] Run format on frontend files
- [ ] Task 4: Pre-commit hooks (AC: #4)
  - [ ] `npm install -D husky lint-staged`
  - [ ] Configure lint-staged to run ESLint + Prettier on staged .js/.css
  - [ ] husky pre-commit runs lint-staged
- [ ] Task 5: CI integration (AC: #5)
  - [ ] Add lint step to GitHub Actions workflow
  - [ ] Run `npm run lint` and Go lint in CI

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

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled by dev agent)
