# Contributing to GoSheet

Thank you for your interest in contributing to GoSheet!

## Development Setup

### Prerequisites

- **Go 1.21+** - Backend development
- **Node.js 18+** - Frontend and testing
- **macOS 11+** - Required for native features

### Initial Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yaronf/GoSheet.git
   cd GoSheet
   ```

2. Install dependencies:
   ```bash
   make install
   # or: npm install && go mod download
   ```

3. Build the Go server:
   ```bash
   make build
   ```

4. Run tests to verify setup:
   ```bash
   npm run test:all
   ```

## Development Workflow

### Running the App in Development Mode

```bash
make run-electron
# or: npm start
```

Electron launches the app and spawns the Go server automatically. No separate terminals needed.

### Running Tests

```bash
# All tests (Go + Playwright)
npm run test:all
# or: make test

# Go unit tests only
npm run test:unit
# or: make test-unit

# Playwright tests only
npm test
# or: make test-electron

# Specific test file
npx playwright test test_spreadsheet.spec.js
```

### Building for Production

```bash
# Build Go server
make build

# Package Electron app
npm run build
# or: make build-electron

# Output: dist/GoSheet.app (or dist/mac-arm64/GoSheet.app depending on electron-builder)
```

## Project Structure

See [README.md](README.md) for detailed project structure.

**Key Directories:**
- `server/` - Go HTTP backend entry point
- `api/` - REST API handlers (Go)
- `frontend/` - HTML/CSS/JS frontend
- `electron/` - Electron main process
- `model/` - Core spreadsheet logic
- `controller/` - Application logic
- `playwright_tests/` - UI tests
- `tests/` - Go unit tests
- `docs/` - User documentation (USER_GUIDE.md)

## Code Style

### Go Code

- Follow standard Go formatting: `gofmt`
- Run `go vet` before committing
- Write tests for new features

### JavaScript Code

- Use ES6 modules
- Follow existing code style
- Avoid external dependencies (keep frontend vanilla)

## Code Quality

Quality checks run in CI and via pre-commit hooks. Run them before submitting a PR.

### Linting

| Tool | Command | Config |
|------|---------|--------|
| ESLint (JS) | `npm run lint` | [eslint.config.js](eslint.config.js) |
| golangci-lint (Go) | `make lint` | [.golangci.yml](.golangci.yml) |

**ESLint rules:** Recommended + Prettier compatibility. Complexity warning at 15 (extract helpers if exceeded).

**golangci-lint:** errcheck, govet, gofmt, ineffassign, staticcheck. Test files may ignore errcheck for intentional error paths.

### Formatting

| Tool | Format | Check |
|------|--------|-------|
| Prettier (JS/CSS) | `npm run format` | `npm run format:check` |
| Go | `gofmt -w .` | `make lint` (gofmt included) |

**Prettier config:** [.prettierrc](.prettierrc) — semicolons, single quotes, 2-space indent, trailing commas (ES5).

### Complexity

Cyclomatic complexity is tracked per [complexity-baseline.md](_bmad-output/implementation-artifacts/complexity-baseline.md):

- **Warn:** >15 — Refactor when possible
- **Fail:** >20 — Must refactor before merge

**Commands:** `make complexity` (Go), `npm run lint` (JS complexity rule)

### Test Coverage

Coverage targets and baseline: [coverage-baseline.md](_bmad-output/implementation-artifacts/coverage-baseline.md)

| Package | Target |
|---------|--------|
| model/ | 80% |
| controller/ | 80% |
| api/ | 80% |

**Command:** `make coverage` — Go coverage for model, controller, api via tests package.

### Good Practices

**Do:**
- Extract helper functions when complexity exceeds 15
- Use early returns and guard clauses to reduce nesting
- Add unit tests for new model/controller/api logic
- Run `npm run lint`, `npm run format:check`, `make lint` before committing

**Don't:**
- Leave functions with complexity >20
- Ignore lint errors (fix or document with `//nolint` sparingly)
- Commit without running quality checks locally

### Commit Messages

Follow conventional commits:
- `feat: Add new feature`
- `fix: Fix bug`
- `docs: Update documentation`
- `test: Add or update tests`
- `refactor: Code refactoring`
- `chore: Maintenance tasks`

## Testing Guidelines

### Writing Tests

**Playwright Tests:**
- Use fixtures from `fixtures.js`
- Test user workflows, not implementation details
- Keep tests independent and idempotent

**Go Tests:**
- Use testify for assertions
- Test edge cases and error conditions
- Aim for high coverage of business logic

### Running CI Locally

```bash
npm run test:all
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. **Before submitting**, run:
   - `npm run test:all` — All tests must pass
   - `npm run lint` — ESLint
   - `npm run format:check` — Prettier
   - `make lint` — golangci-lint
   - `make complexity` — Optional; no new functions >20
5. Commit with clear messages (pre-commit hooks will run lint/format on staged files)
6. Push to your fork
7. Open a Pull Request

## Development Methodology

This project follows **BMAD (Breakthrough Method for Agile AI Driven Development)**. See [_bmad/BMAD.md](_bmad/BMAD.md) for details.

## Questions?

Open an issue or discussion on GitHub.

## License

MIT License - see [LICENSE](LICENSE) file for details.
