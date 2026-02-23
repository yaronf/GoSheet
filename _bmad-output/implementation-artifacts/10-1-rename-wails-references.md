# Story 10.1: Rename Wails References

**Epic:** 10 - Code Quality & Technical Debt  
**Story:** 10.1  
**Estimated Effort:** 2-3 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-17

---

## Story

As a developer,  
I want all "Wails" references removed from active code and documentation,  
So that the codebase accurately reflects the Electron architecture and doesn't confuse contributors.

---

## Context

**Prerequisites:**
- Epic 3 complete: Electron implementation (Wails replaced)
- Story 9.3 (Remove Obsolete Wails Files) may run before or in parallel—obsolete files (api_wails.go, fileservice_wails.go, main.go, wails.json) are deleted there

**Current State:**
- Active code still contains "Wails" in comments and documentation
- api/fileservice.go: Comments reference "Wails dialogs", "fileservice_wails.go", "Wails OpenFileDialog", "Wails SaveFileDialog"
- api/spreadsheet.go: Comments reference "Wails IPC", "api_wails.go"
- frontend/app.js: Comments reference "Wails IPC", "Wails runtime"
- frontend/index.html: Comment references "Wails bindings"
- Obsolete frontend files may exist: runtime.js, runtime-debug.js, github.com/wailsapp/ (Wails runtime—not used by Electron)

**Why This Story:**
The project migrated from Wails to Electron. Obsolete Wails files are removed in 9.3. This story updates remaining references in active code so naming and documentation reflect the current architecture.

---

## Acceptance Criteria

1. **No "Wails" in active code**
   - [ ] All comments in api/fileservice.go updated (Wails → Electron or native)
   - [ ] All comments in api/spreadsheet.go updated
   - [ ] All comments in frontend/app.js updated
   - [ ] Comment in frontend/index.html updated

2. **Obsolete Wails frontend files removed (if present)**
   - [ ] frontend/runtime.js deleted (Wails runtime—Electron uses api-client.js + preload)
   - [ ] frontend/runtime-debug.js deleted
   - [ ] frontend/github.com/ directory (Wails modules) deleted
   - [ ] index.html and app.js do not reference these files

3. **Verification**
   - [ ] `rg -i wails --type go` returns no matches in active Go code
   - [ ] `rg -i wails frontend/*.js frontend/*.html` returns no matches (excluding _bmad-output)
   - [ ] All tests pass: `go test ./...` and `npm test`
   - [ ] App builds: `npm run build`

---

## Tasks / Subtasks

- [ ] Task 1: Update api/ package comments (AC: #1)
  - [ ] api/fileservice.go: Replace "Wails" with "Electron" or "native" in comments (lines 5, 9, 28, 55)
  - [ ] api/spreadsheet.go: Replace "Wails IPC" with "Electron IPC" or "native mode"; update file path references
- [ ] Task 2: Update frontend comments (AC: #1)
  - [ ] frontend/app.js: "Wails IPC" → "Electron IPC"; "Wails runtime" → "Electron" or remove
  - [ ] frontend/index.html: "Wails bindings" → "Electron bindings" or "api-client"
- [ ] Task 3: Remove obsolete Wails frontend files (AC: #2)
  - [ ] Delete frontend/runtime.js, frontend/runtime-debug.js if present
  - [ ] Delete frontend/github.com/ (Wails internal modules) if present
  - [ ] Verify index.html and app.js do not load these
- [ ] Task 4: Verify and test (AC: #3)
  - [ ] Run `rg -i wails` to confirm no remaining references in active code
  - [ ] Run `go test ./...` and `npm test`
  - [ ] Run `npm run build`

---

## Dev Notes

### Project Structure Notes

- **api/** package: Shared interfaces; both web (HTTP) and native (Electron) implement them. Comments should say "Electron" or "native mode" instead of "Wails".
- **frontend/**: Electron loads index.html; api-client.js and app.js are the active entry points. No Wails runtime is used.

### References

- [Source: _bmad-output/implementation-artifacts/TECHNICAL-DEBT.md#2] - Rename Wails-Related Functions and Files
- [Source: _bmad-output/planning-artifacts/epic-9-code-quality.md] - Story 9.1: Rename Wails References
- [Source: _bmad-output/planning-artifacts/electron-migration-analysis.md] - Migration rationale

### Git Intelligence

- Use `git mv` for renames if preserving history; otherwise plain edits are fine for comments
- Do not modify _bmad-output/ implementation artifacts (historical docs)—only active source code

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled by dev agent)
