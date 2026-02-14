# Story 1.1: Create API Package Structure

**Epic:** 1 - Consistent Spreadsheet Actions & Error Handling  
**Story ID:** 1.1  
**Status:** done  
**Created:** 2026-02-14

---

## User Story

**As a** developer  
**I want** a well-organized package structure for dual-mode architecture  
**So that** I can implement native and web modes independently while sharing core logic

---

## Business Context

This story establishes the foundational package structure that enables the entire Wails v3 migration. It creates the architectural separation needed to support both:
- **Native mode** (Wails v3 IPC) for end users
- **Web mode** (HTTP server) for Playwright testing

This is the first step in Epic 1, which creates a unified API layer that both modes will implement. Without this structure, subsequent stories cannot proceed.

**Why this matters:** The PRD identified that users need "accurate file status with real file paths" - something the current web-only implementation cannot provide. This package structure is the foundation that makes native file operations possible while preserving the existing test suite.

---

## Acceptance Criteria

**Given** the existing spreadsheet codebase  
**When** I set up the new package structure  
**Then** the following directories exist:
- `api/` (for shared interfaces and types)
- `cmd/native/` (for Wails v3 entry point)
- `cmd/web/` (for HTTP server entry point)

**And** existing `model/`, `controller/`, `frontend/`, `tests/`, `playwright_tests/` directories are preserved  
**And** `go.mod` is updated with placeholder for Wails v3 dependency (will be added in Epic 3)  
**And** `.gitignore` is updated to ignore `build/bin/` and temp files  
**And** all existing 42 Go unit tests still pass

---

## Technical Requirements

### Package Structure to Create

```
gosheet/
├── api/                    # NEW - Shared interfaces and types
│   └── .gitkeep           # Placeholder for now
├── cmd/                    # NEW - Entry points
│   ├── native/            # NEW - Wails v3 entry point (Epic 3)
│   │   └── .gitkeep
│   └── web/               # NEW - HTTP server entry point (Epic 2)
│       └── .gitkeep
├── model/                  # EXISTING - Preserve
├── controller/             # EXISTING - Preserve
├── frontend/               # EXISTING - Preserve
├── tests/                  # EXISTING - Preserve
├── playwright_tests/       # EXISTING - Preserve
├── server/                 # EXISTING - Will be migrated to cmd/web/ in Epic 2
├── go.mod                  # UPDATE - Add Wails v3 placeholder
├── .gitignore              # UPDATE - Add build artifacts
└── README.md               # EXISTING - Preserve
```

### go.mod Updates

Add a comment placeholder for Wails v3 dependency (actual dependency added in Epic 3):

```go
module gosheet

go 1.25.6

require (
	github.com/alecthomas/participle/v2 v2.1.4
	github.com/stretchr/testify v1.11.1
	// Wails v3 dependency will be added in Epic 3 (Story 3.2)
	// github.com/wailsapp/wails/v3 v3.0.0-alpha.67
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
```

### .gitignore Updates

Add these entries to the existing `.gitignore`:

```
# Wails build artifacts
build/bin/
build/darwin/
wails.json

# Temporary files
*.tmp
.wails-build/
```

---

## Architecture Compliance

### From Architecture Document (architecture.md)

**Package-Based Separation (Section: Technical Stack):**
- `api/` package contains shared interfaces (SpreadsheetAPI, FileService)
- `cmd/native/` contains Wails v3 entry point and native implementations
- `cmd/web/` contains HTTP server entry point and web implementations
- Core business logic (`model/`, `controller/`) remains shared

**Dual-Mode Build Strategy (Section: Implementation Approach):**
- Build tags will be used: `//go:build wails` vs `//go:build web`
- Mode-specific code limited to: file I/O, IPC vs HTTP, entry points
- Shared code: model, controller, formula engine, frontend

**Test Preservation (Section: Testing Strategy):**
- All 42 Go unit tests must continue to pass
- Playwright tests will continue to use web mode
- No test modifications required in this story

---

## Implementation Guide

### Step 1: Create Directory Structure

Create the new directories:

```bash
mkdir -p api
mkdir -p cmd/native
mkdir -p cmd/web
```

Add `.gitkeep` files to preserve empty directories in git:

```bash
touch api/.gitkeep
touch cmd/native/.gitkeep
touch cmd/web/.gitkeep
```

### Step 2: Update go.mod

Add the comment placeholder for Wails v3 dependency. The actual dependency will be added in Story 3.2 when we create the Wails configuration.

**Important:** Do NOT add the actual Wails v3 dependency yet. This story only creates the structure. The dependency will be added in Epic 3 after we've generated the Wails reference template and understand the exact configuration needed.

### Step 3: Update .gitignore

Append the Wails-specific build artifacts to `.gitignore`. This ensures that:
- Build outputs don't clutter the repository
- Wails configuration files can be added later without conflicts
- Temporary build files are ignored

### Step 4: Verify Existing Tests Pass

Run the existing test suite to ensure no regressions:

```bash
go test ./tests/... -v
```

Expected: All 42 tests pass (same as before this change).

**Why this matters:** This story should be a pure structural change with zero functional impact. If tests fail, something went wrong with the directory creation or file moves.

### Step 5: Verify Project Compiles

Ensure the existing server still compiles:

```bash
go build ./server
```

Expected: Successful compilation with no errors.

---

## Current Codebase Context

### Existing Project Structure

The codebase currently has this structure:

```
gosheet/
├── model/          # Core data structures (Cell, Spreadsheet, DependencyGraph)
├── controller/     # Application controller (AppController)
├── frontend/       # Web UI (HTML/CSS/JS)
├── server/         # HTTP server entry point (will move to cmd/web/ in Epic 2)
├── tests/          # Go unit tests (42 tests)
├── playwright_tests/  # UI tests (32 tests)
├── go.mod          # Go dependencies
└── .gitignore      # Git ignore rules
```

### Key Files to Preserve

**Do NOT modify these files:**
- `model/*.go` - Core business logic
- `controller/app.go` - Application controller
- `frontend/*` - Web UI files
- `tests/*.go` - Unit tests
- `playwright_tests/*.py` - UI tests
- `server/main.go` - Current HTTP server (will be migrated in Epic 2)

### Existing Dependencies

Current `go.mod` dependencies:
- `github.com/alecthomas/participle/v2 v2.1.4` - Formula parser
- `github.com/stretchr/testify v1.11.1` - Testing framework

These dependencies are used by the existing formula engine and tests. They must be preserved.

---

## Testing Requirements

### Unit Tests

Run the existing test suite:

```bash
go test ./tests/... -v
```

**Expected Results:**
- All 42 tests pass
- No new tests required for this story (pure structural change)
- Test output should be identical to before this change

### Manual Verification

1. **Directory Structure:** Verify all new directories exist with `.gitkeep` files
2. **go.mod:** Verify comment placeholder is added (no actual dependency yet)
3. **.gitignore:** Verify new entries are appended
4. **Compilation:** Verify `go build ./server` succeeds
5. **Tests:** Verify `go test ./tests/... -v` passes

---

## Definition of Done

- [ ] `api/` directory created with `.gitkeep`
- [ ] `cmd/native/` directory created with `.gitkeep`
- [ ] `cmd/web/` directory created with `.gitkeep`
- [ ] `go.mod` updated with Wails v3 comment placeholder
- [ ] `.gitignore` updated with build artifact entries
- [ ] All existing directories (`model/`, `controller/`, `frontend/`, `tests/`, `playwright_tests/`) are preserved and unchanged
- [ ] `go test ./tests/... -v` passes (all 42 tests)
- [ ] `go build ./server` succeeds
- [ ] No functional changes to existing code
- [ ] Story marked as "done" in sprint-status.yaml

---

## Notes for Developer

### Why .gitkeep Files?

Git doesn't track empty directories. The `.gitkeep` files ensure that `api/`, `cmd/native/`, and `cmd/web/` are committed to the repository even though they're currently empty. These directories will be populated in subsequent stories.

### Why Not Add Wails v3 Dependency Now?

The Wails v3 dependency will be added in Story 3.2 after we:
1. Generate a Wails reference template (Story 3.1)
2. Understand the exact configuration needed (Story 3.2)
3. Create the `wails.json` configuration file (Story 3.2)

Adding the dependency now would be premature and could cause conflicts with the configuration setup.

### Why Preserve server/ Directory?

The existing `server/main.go` is the current HTTP server entry point. It will be migrated to `cmd/web/main.go` in Story 2.1. For now, we preserve it to ensure the existing web mode continues to work.

### Build Tags Strategy (Future Reference)

In future stories, we'll use Go build tags to separate native and web mode code:
- `//go:build wails` - Native mode files (in `cmd/native/`)
- `//go:build web` - Web mode files (in `cmd/web/`)
- No build tag - Shared code (`model/`, `controller/`, `api/`)

This allows us to build either mode independently:
- `go build -tags wails ./cmd/native` - Native app
- `go build -tags web ./cmd/web` - Web server

---

## Related Stories

**Next Story:** 1.2 - Define Response Struct with Error Codes  
**Epic Goal:** Establish consistent API contract for both native and web modes  
**Architecture Reference:** Section "Package-Based Separation" in architecture.md

---

## Story Completion Notes

_This section will be filled in by the developer after implementation._

**Implementation Date:** 2026-02-15  
**Developer Notes:** All acceptance criteria met. Directory structure created with .gitkeep files. go.mod updated with Wails v3 comment placeholder. .gitignore updated with build/bin/, build/darwin/, wails.json, *.tmp, and .wails-build/. All 42 Go unit tests pass. Project compiles successfully (use `go build -o server/server ./server` when building from repo root, since default output name conflicts with server/ directory).  
**Challenges Encountered:** `go build ./server` fails with "build output 'server' already exists and is a directory" when run from repo root—resolved by using `go build -o server/server ./server`.  
**Learnings for Next Story:** None—pure structural change with zero functional impact.
