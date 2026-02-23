# Story 9.3: Remove Obsolete Wails Files

**Epic:** 9 - Documentation & Project Cleanup  
**Story:** 9.3  
**Estimated Effort:** 30 minutes  
**Status:** done  
**Created:** 2026-02-16

---

## Story

As a developer,  
I want obsolete Wails files removed from the project,  
So that the codebase is clean and doesn't confuse contributors.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron implementation
- Epic 5 complete: Playwright Electron testing
- All Wails code replaced with Electron equivalents

**Current State:**
- Wails files still exist in the repository:
  - `api_wails.go` (1,712 bytes)
  - `fileservice_wails.go` (2,359 bytes)
  - `main.go` (1,712 bytes - Wails entry point)
  - `wails.json` (555 bytes)
  - `cmd/` directory (Wails CLI entry points)
  - Old executables: `gosheet` (18.7 MB), `web` (9.7 MB)
- These files are no longer used but could confuse contributors
- `.gitignore` may reference Wails-specific patterns

**Why This Story:**
After migrating to Electron, Wails files serve no purpose and add confusion. Removing them clarifies the project's architecture and reduces repository size. This cleanup is essential before release.

---

## Acceptance Criteria

**Given** the project has fully migrated to Electron  
**When** I review the project files  
**Then** the following Wails files are deleted:
- `api_wails.go`
- `fileservice_wails.go`
- `main.go` (Wails entry point)
- `wails.json`
- `cmd/` directory (Wails CLI entry points)
- Old executables: `gosheet`, `web`

**And** `.gitignore` is updated to reflect Electron structure  
**And** no Wails imports remain in Go code  
**And** the project builds successfully after cleanup

---

## Technical Requirements

### Files to Delete

```bash
# Wails Go files
rm api_wails.go
rm fileservice_wails.go
rm main.go

# Wails configuration
rm wails.json

# Wails CLI entry points
rm -rf cmd/

# Old executables
rm gosheet
rm web
```

### .gitignore Updates

Remove Wails-specific patterns, add Electron patterns:

```gitignore
# Remove these (Wails-specific)
# /build/bin/
# /frontend/dist/
# /frontend/node_modules/

# Add these (Electron-specific)
dist/
build/
*.app
```

### Verification Steps

After deletion:

1. **Build verification:**
   ```bash
   make build
   npm run build
   ```

2. **Test verification:**
   ```bash
   npm run test:all
   ```

3. **Import verification:**
   ```bash
   # Search for any remaining Wails imports
   rg "github.com/wailsapp" --type go
   ```

---

## Implementation Tasks

1. ✅ Create backup branch (optional safety measure)
2. ✅ Delete Wails Go files
3. ✅ Delete Wails configuration
4. ✅ Delete cmd/ directory
5. ✅ Delete old executables
6. ✅ Update .gitignore
7. ✅ Search for remaining Wails references
8. ✅ Verify project builds
9. ✅ Verify tests pass
10. ✅ Commit changes

---

## Dev Notes

### Safety First

Before deleting, optionally create a backup branch:

```bash
git checkout -b backup/wails-files
git checkout main
```

### Files to Keep

Do NOT delete:
- `_bmad-output/planning-artifacts/research/wails-*.md` - Historical research
- `_bmad-output/implementation-artifacts/epic-4-retro-*.md` - Retrospectives mentioning Wails
- Any documentation explaining the migration decision

### Expected Repository Size Reduction

- `gosheet` executable: ~18.7 MB
- `web` executable: ~9.7 MB
- Wails Go files: ~6 KB
- **Total reduction: ~28.4 MB**

### Post-Deletion Verification

Run these commands to ensure nothing broke:

```bash
# Build Go server
cd server
go build -o gosheet-server
cd ..

# Build Electron app
npm run build

# Run tests
npm run test:all
```

All should succeed.

---

## Testing Strategy

### Manual Testing

1. **File Deletion:**
   - Verify each file is deleted
   - Use `git status` to confirm deletions are staged
   - Use `ls -la` to verify files are gone

2. **Build Verification:**
   - Run `make build` - should succeed
   - Run `npm run build` - should succeed
   - Verify no Wails-related errors appear

3. **Test Verification:**
   - Run `npm test` - all Playwright tests should pass
   - Run `go test ./tests/...` - all Go tests should pass

4. **Import Verification:**
   - Search for Wails imports: `rg "wailsapp" --type go`
   - Should return no results (or only in archived docs)

### Automated Testing

No new tests needed, but verify existing tests pass:

```bash
npm run test:all
```

---

## References

- [Sprint Change Proposal](../planning-artifacts/sprint-change-proposal-2026-02-15.md) - Migration decision
- [Electron Migration Analysis](../planning-artifacts/electron-migration-analysis.md) - Technical rationale
- [Epic 4 Retrospective](epic-4-retro-2026-02-15.md) - Wails limitations discovered

---

## Dev Agent Record

### File List
- Deleted: `api_wails.go`, `fileservice_wails.go`, `main.go`, `wails.json`, `cmd/`, `gosheet`, `web`
- Modified: `.gitignore` (removed Wails patterns, added dist/, build/)
- Modified: `go.mod`, `go.sum` (go mod tidy to remove Wails deps)
- Modified: `frontend/index.html` (removed Wails bindings comment)

### Change Log
- 2026-02-24: Wails files removed; go mod tidy; .gitignore updated

---

## Change Log

- 2026-02-24: Story completed; Wails files removed in Epic 9 commit (c9a649b)
- 2026-02-16: Story created to remove obsolete Wails files

---

## Status

**Current Status:** done  
**Last Updated:** 2026-02-24

Cleanup task to remove obsolete Wails artifacts.
