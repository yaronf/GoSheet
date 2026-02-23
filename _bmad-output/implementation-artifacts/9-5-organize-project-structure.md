# Story 9.5: Organize Project Structure

**Epic:** 9 - Documentation & Project Cleanup  
**Story:** 9.5  
**Estimated Effort:** 1 hour  
**Status:** ready-for-dev  
**Created:** 2026-02-16

---

## Story

As a developer,  
I want a clean, well-organized project structure,  
So that new contributors can easily navigate the codebase.

---

## Context

**Prerequisites:**
- Story 9.3 complete: Wails files removed
- Story 9.4 complete: Debug artifacts cleaned up

**Current State:**
- `specs/` directory contains planning documents that should be in `_bmad-output/`
- `api/` directory only contains `.gitkeep` files (no actual code)
- `docs/` directory exists but may be empty or unclear purpose
- Project structure diagram in README doesn't match actual structure
- No CONTRIBUTING.md for new developers

**Why This Story:**
After removing obsolete files, the project structure needs final organization. Moving planning docs to `_bmad-output/`, removing empty directories, and creating contributor documentation makes the project more professional and easier to navigate.

---

## Acceptance Criteria

**Given** obsolete files have been removed  
**When** I review the project structure  
**Then** the `specs/` directory is moved to `_bmad-output/planning-artifacts/specs/` or archived  
**And** the `api/` directory is removed (only contains `.gitkeep` files)  
**And** the `docs/` directory purpose is clarified or removed if empty  
**And** the README project structure diagram matches the actual structure  
**And** all directories have clear purposes  
**And** the root directory contains only essential files:
- Configuration files (package.json, go.mod, Makefile, etc.)
- Documentation (README.md, USER_GUIDE.md, BMAD.md, etc.)
- Source directories (electron/, frontend/, server/, model/, etc.)
- Build/test directories (dist/, build/, playwright_tests/, tests/)

**And** a CONTRIBUTING.md file is created with development setup instructions

---

## Technical Requirements

### Directory Reorganization

```bash
# Move specs to BMAD output
mv specs/ _bmad-output/planning-artifacts/specs/

# Remove empty api directory
rm -rf api/

# Check docs directory
ls -la docs/
# If empty or unclear, remove it
rm -rf docs/

# Update any references to specs/ in documentation
rg "specs/" --type md
```

### Updated Project Structure

```
spreadsheet/
├── .github/                # GitHub Actions workflows
│   └── workflows/
│       └── test.yml
├── _bmad/                  # BMAD methodology framework
│   └── ...
├── _bmad-output/           # BMAD generated artifacts
│   ├── planning-artifacts/ # PRD, architecture, epics, specs
│   └── implementation-artifacts/ # Stories, retros, tech debt
├── assets/                 # App icons and resources
│   └── icon.icns
├── build/                  # Build artifacts (gitignored)
├── controller/             # Application logic layer
│   └── app.go
├── dist/                   # Packaged apps (gitignored)
├── electron/               # Electron main process
│   ├── main.js
│   └── preload.js
├── frontend/               # Web frontend (HTML/CSS/JS)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── spreadsheet.css
├── model/                  # Core data model (Go)
│   ├── spreadsheet.go
│   ├── formula.go
│   ├── cell.go
│   └── ...
├── node_modules/           # Node dependencies (gitignored)
├── playwright_tests/       # Playwright Electron tests
│   ├── fixtures.js
│   ├── test_*.spec.js
│   └── ...
├── server/                 # Go HTTP server
│   ├── main.go
│   └── gosheet-server (binary)
├── tests/                  # Go unit tests
│   ├── model_test.go
│   ├── formula_test.go
│   └── ...
├── .gitignore
├── BMAD.md                 # BMAD methodology documentation
├── CONTRIBUTING.md         # Contributor guide (NEW)
├── ELECTRON_SETUP.md       # Electron setup notes
├── Makefile                # Build automation
├── README.md               # Main documentation
├── USER_GUIDE.md           # User documentation (NEW)
├── go.mod                  # Go dependencies
├── go.sum
├── package.json            # Node dependencies
├── package-lock.json
└── playwright.config.js    # Playwright configuration
```

### CONTRIBUTING.md Template

```markdown
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
   npm install
   go mod download
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
# Terminal 1: Start the Go server
cd server
go run main.go

# Terminal 2: Start Electron
npm start
```

The app will launch with hot-reload enabled.

### Running Tests

```bash
# All tests (Go + Playwright)
npm run test:all

# Go unit tests only
npm run test:unit

# Playwright tests only
npm test

# Specific test file
npx playwright test test_spreadsheet.spec.js
```

### Building for Production

```bash
# Build Go server
make build

# Package Electron app
npm run build

# Output: dist/mac-arm64/GoSheet.app
```

## Project Structure

See README.md for detailed project structure.

**Key Directories:**
- `server/` - Go HTTP backend
- `frontend/` - HTML/CSS/JS frontend
- `electron/` - Electron main process
- `model/` - Core spreadsheet logic
- `playwright_tests/` - UI tests
- `tests/` - Go unit tests

## Code Style

### Go Code

- Follow standard Go formatting: `gofmt`
- Run `go vet` before committing
- Write tests for new features

### JavaScript Code

- Use ES6 modules
- Follow existing code style
- Avoid external dependencies (keep frontend vanilla)

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
# Simulate GitHub Actions
npm run test:all
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm run test:all`
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

## Development Methodology

This project follows **BMAD (Breakthrough Method for Agile AI Driven Development)**. See [BMAD.md](BMAD.md) for details.

## Questions?

Open an issue or discussion on GitHub.

## License

MIT License - see LICENSE file for details.
```

---

## Implementation Tasks

1. ✅ Review specs/ directory contents
2. ✅ Move specs/ to _bmad-output/planning-artifacts/specs/
3. ✅ Remove api/ directory
4. ✅ Check docs/ directory and remove if empty
5. ✅ Update README project structure diagram
6. ✅ Create CONTRIBUTING.md
7. ✅ Search for broken references to moved files
8. ✅ Update any hardcoded paths in code
9. ✅ Verify project builds
10. ✅ Commit changes

---

## Dev Notes

### Checking for Broken References

After moving files, search for references:

```bash
# Find references to specs/
rg "specs/" --type md --type go --type js

# Find references to api/
rg "api/" --type md --type go --type js

# Find references to docs/
rg "docs/" --type md --type go --type js
```

Update any broken references.

### README Project Structure Update

Update the "Project Structure" section in README.md to match the structure above. Remove obsolete directories, add new ones (CONTRIBUTING.md, USER_GUIDE.md).

### Empty Directory Check

```bash
# Check if docs/ is empty
ls -la docs/

# If empty or only .gitkeep
rm -rf docs/
```

---

## Testing Strategy

### Manual Testing

1. **Directory Organization:**
   - Verify specs/ moved to _bmad-output/planning-artifacts/specs/
   - Verify api/ removed
   - Verify docs/ removed or clarified
   - Check root directory is clean

2. **Reference Verification:**
   - Search for broken references to moved files
   - Update any hardcoded paths
   - Verify all links in documentation work

3. **Build Verification:**
   - Run `make build` - should succeed
   - Run `npm run build` - should succeed
   - No errors about missing files

4. **Documentation Verification:**
   - Read CONTRIBUTING.md
   - Follow setup instructions
   - Verify all commands work

### Automated Testing

No new tests needed, but verify existing tests pass:

```bash
npm run test:all
```

---

## References

- [README.md](../../README.md) - Main documentation
- [BMAD.md](../../BMAD.md) - Methodology documentation
- Current project structure

---

## Dev Agent Record

### File List
- Moved: `specs/` → `_bmad-output/planning-artifacts/specs/`
- Moved: `USER_GUIDE.md` → `docs/USER_GUIDE.md`
- Moved: `BMAD.md` → `_bmad/BMAD.md`
- Consolidated: `_bmad-output/csv-export-test-debug-analysis.md`, `icon-preview.html`, `test-fixes-summary-2026-02-18.md`, `bmb-creations/` → `_bmad-output/misc/`
- Deleted: `ELECTRON_SETUP.md`
- Modified: `README.md` (project structure, links to docs/, _bmad/)
- Modified: `electron/main.js` (docs/USER_GUIDE.md path)
- Modified: `package.json` (extraResources docs/USER_GUIDE.md)
- Modified: `_bmad/BMAD.md`, `_bmad-output/planning-artifacts/architecture.md`, `_bmad-output/planning-artifacts/specs/TECH_SPEC.md`, `_bmad-output/planning-artifacts/prd.md`, `_bmad-output/implementation-artifacts/9-2-create-user-documentation.md` (specs path references)

### Change Log
- 2026-02-24: specs moved; USER_GUIDE to docs/; BMAD to _bmad/; _bmad-output misc consolidated; ELECTRON_SETUP removed; references updated

---

## Change Log

- 2026-02-16: Story created to organize project structure

---

## Status

**Current Status:** ready-for-dev  
**Last Updated:** 2026-02-16

Final project structure organization for release.
