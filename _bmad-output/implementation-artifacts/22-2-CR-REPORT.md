# Code Review: Story 22.2 — Replace gob with MessagePack Persistence

**Story:** 22-2-replace-gob-with-msgpack-persistence.md  
**Git vs Story Discrepancies:** 2  
**Issues Found:** 0 High, 2 Medium, 3 Low

---

## Git vs Story Discrepancies

**Files in git commit but not in story File List:**
- `docs/FILE_FORMAT.md` — New format spec
- `README.md` — gob → MessagePack
- `_bmad-output/planning-artifacts/specs/TECH_SPEC.md`
- `docs/USER_GUIDE.md`
- `_bmad-output/implementation-artifacts/1-4-define-fileservice-interface.md`
- `go.mod`, `go.sum` — MessagePack dependency
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-15.md`
- `_bmad-output/planning-artifacts/backlog.md`, `epics.md`

---

## MEDIUM ISSUES

### M1: Story File List incomplete
**Location:** 22-2-replace-gob-with-msgpack-persistence.md → Dev Agent Record → File List

**Finding:** The File List omits 8+ files that were changed in the commit. Documentation and planning artifacts should be listed for traceability.

**Fix:** Add to File List: docs/FILE_FORMAT.md, README.md, TECH_SPEC.md, USER_GUIDE.md, 1-4, go.mod, go.sum, sprint-change-proposal, backlog, epics.

---

### M2: FILE_FORMAT.md stale reference to `computed`
**Location:** docs/FILE_FORMAT.md:99

**Finding:** Line 99 says "snake_case for cell fields: `value`, `computed`, `is_formula`, etc." but `computed` was removed from persistence. The doc correctly states elsewhere that computed is derived, but this line is misleading for implementers.

**Fix:** Remove `computed` from the MessagePack Details field list.

---

## LOW ISSUES

### L1: FileHeader is dead code
**Location:** model/file.go:17-21

**Finding:** `FileHeader` struct is defined but never used. `fileContentV2` has its own `Version` and `CellCount`. Either remove `FileHeader` or document that it's reserved for future use.

---

### L2: StyleRegistry comment still references gob
**Location:** model/style.go:71-72

**Finding:** Comments say "Exported for gob encoding". Should say "for serialization" or "for MessagePack encoding".

---

### L3: Story subtask checkboxes inconsistent
**Location:** 22-2-replace-gob-with-msgpack-persistence.md → Tasks

**Finding:** Tasks are marked [x] but subtasks remain [ ]. Minor documentation hygiene.

---

## Validation Summary

| AC | Status | Evidence |
|----|--------|----------|
| 1. Save → MessagePack v2.0 | ✅ | file.go:139-144, FileFormatVersion |
| 2. Load → cells, merges, styles | ✅ | decodeSpreadsheet, cellsFromPersist |
| 3. SaveToBytes/LoadFromBytes | ✅ | file.go:221-234 |
| 4. gob removed | ✅ | No encoding/gob in model |
| 5. atomicWriteFile unchanged | ✅ | file.go:36-75, 188-191 |
| 6. Invalid data → error | ✅ | file_test.go, decode error handling |

**All Acceptance Criteria implemented.** Tests pass.

---

## Recommendation

Fix M1 and M2 (quick doc/File List updates). L1–L3 are optional. Story can be marked **done** after M1/M2 fixes.

---

## Fixes Applied (post-CR)

- **M1:** Story File List updated with docs, go.mod/go.sum, planning artifacts.
- **M2:** FILE_FORMAT.md line 99 — removed `computed` from field list; clarified derived on load.
- **L1:** Removed dead `FileHeader` struct from model/file.go.
- **L2:** model/style.go — "gob encoding" → "serialization (MessagePack)".
- **L3:** Story subtask checkboxes marked [x].
