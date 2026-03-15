# Sprint Change Proposal — 2026-03-15 (Epic 23)

## Section 1: Issue Summary

**Trigger:** Backlog items promoted via Correct Course. User selected five items that form a cohesive UX epic.

**Problem statement:** Several spreadsheet UX improvements and polish items have been in the backlog. Promoting them as a single epic enables systematic implementation and keeps the product evolving.

**Items promoted:**
1. **Generic font fallback** — When a font in a .sheet file is not installed, use a fallback stack (e.g. `"CustomFont", sans-serif`) instead of the browser's generic
2. **Text wrapping within cell** — Add at least a toggle; may require row/column width control
3. **Copy/paste full rows/cols** — Today blocked by "selection too large" guard (10000 rows × 1000 cols); implement efficiently
4. **Recent Files on Welcome Page** — When file cannot be opened, add indication (dialog?) and/or remove from list
5. **Select cells/ranges for formula (enhancement)** — Epic 18 done; gaps: drag doesn't work in formula bar; inline editing may hide inserted ref (cell needs expansion or formula shift)

## Section 2: Impact Analysis

**Epic Impact:** Epics 1–22 unaffected. This is a new Epic 23.

**Story Impact:** No existing stories need modification. New stories only.

**Artifact Conflicts:**
- `epics.md` — add Epic 23
- `sprint-status.yaml` — add Epic 23 entries
- `backlog.md` — mark promoted items or remove from Ideas
- `docs/FILE_FORMAT.md` — update unknown fonts section if font fallback changes semantics
- `docs/ARCHITECTURE.md` — no changes (UX layer)
- `docs/USER_GUIDE.md` — update when features ship

**Technical Impact:**
- **23-1 (font fallback):** `frontend/app-modals.js` `formatToCssPreview`, style preview in Manage Styles; possibly `app-cell-editor.js` cell rendering
- **23-2 (text wrap):** `model/cell.go` or format (alignment already has vertical); `frontend` cell CSS; FILE_FORMAT if persisted
- **23-3 (copy/paste rows/cols):** `frontend/app-file-ops.js` `copySelectionToClipboard`, `pasteFromClipboard`; remove or raise limits; batch API for large ranges
- **23-4 (recent files):** `frontend/app-ui.js` `loadFileByPath`, `populateWelcomeRecentFiles`; Electron main for file existence check; possibly `file:getRecent` + validation
- **23-5 (formula ref UX):** `frontend/app.js` formula bar drag handling; `app-cell-editor.js` inline editor visibility/expansion

## Section 3: Recommended Approach

**Option 1: Direct Adjustment (Recommended)**

Create Epic 23 with five stories. Implement in sequence. No rollback or MVP scope change.

**Rationale:** All items are incremental UX improvements. Effort is moderate; risk is low. No architectural changes required.

**Effort:** Low–Moderate (5 stories, mix of frontend-only and minor model/format changes)  
**Risk:** Low

## Section 4: Detailed Change Proposals

### Epic 23: Spreadsheet UX Enhancements

**Goal:** Improve font handling, cell formatting, copy/paste, recent files, and formula reference UX.

**Stories:**

| ID | Title | Scope |
|----|-------|-------|
| 23-1 | Generic font fallback | In `formatToCssPreview` and style preview, use fallback stack (e.g. `"Helvetica", sans-serif`) when rendering. Update `docs/FILE_FORMAT.md` unknown fonts section if needed. |
| 23-2 | Text wrapping within cell | Add wrap toggle to cell format; persist if needed; render with `white-space` / `word-wrap`. Consider row height auto-adjust. |
| 23-3 | Copy/paste full rows/cols | Support open-ended row/column selections. Remove or raise the 10000×1000 guard; implement efficient batch fetch/set for large ranges. |
| 23-4 | Recent files error handling | When `loadFileByPath` fails (file gone, permission, etc.): show error dialog; optionally remove from recent list. Fix: dialog shown only when spreadsheet opens. |
| 23-5 | Formula reference UX polish | Fix drag-to-insert-range in formula bar (currently works inline only). Improve visibility when ref inserted inline (expand cell or shift formula to show). |

**Backlog items to update after approval:**
- Generic font fallback — mark promoted
- Text wrapping within cell — mark promoted
- Copy/paste full rows/cols — mark promoted
- Recent Files on Welcome Page — mark promoted
- Select cells/ranges for formula — mark promoted (enhancement)

## Section 5: Implementation Handoff

**Scope:** Moderate — five frontend-heavy stories, some model/format touches.

**Handoff:** Dev agent implements stories sequentially via `/bmad-bmm-dev-story`. SM creates story files via `/bmad-bmm-create-story`.

**Success criteria:**
- Font fallback applied in style preview and cell rendering
- Text wrap toggle functional
- Full row/column copy/paste works
- Recent files show error and/or remove invalid entries
- Formula bar drag and inline visibility improved

## Checklist Status

- [x] 1.1 Trigger identified
- [x] 1.2 Problem defined
- [x] 1.3 Evidence documented
- [x] 2.1–2.5 Epic impact assessed
- [x] 3.1–3.4 Artifact conflicts analyzed
- [x] 4.1–4.4 Path forward selected
- [x] 5.1–5.5 Proposal components complete
- [x] 6.1–6.2 Proposal reviewed (awaiting user approval)
- [x] 6.3 User approval
- [x] 6.4 Update sprint-status.yaml
- [x] 6.5 Confirm handoff
