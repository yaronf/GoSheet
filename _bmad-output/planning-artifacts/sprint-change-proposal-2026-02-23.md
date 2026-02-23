# Sprint Change Proposal: In-App Formula Documentation

**Date:** 2026-02-23  
**Workflow:** Correct Course  
**Author:** BMAD Correct Course Workflow  
**Status:** Draft for Review

---

## 1. Issue Summary

### Problem Statement

The user has identified that **in-app documentation** (especially formula syntax) is **essential**, while the external **USER_GUIDE.md** is nice but not essential. Currently, GoSheet has no in-app help for formulas—users must leave the app and open the user guide to learn formula syntax, functions, and operators.

### Context

- **Story 9-2** (Create User Documentation) is **done**—USER_GUIDE.md exists with comprehensive formula documentation.
- The Help menu currently only has "About GoSheet" (Story 7-3).
- Formula bar placeholder says "Enter value or formula..." but provides no guidance on syntax.
- Users need to discover SUM, AVG, MID, comparison operators, etc. without external docs.

### Evidence

- User feedback: "A user guide is nice but not essential. In-app Documentation, e.g. for the formula syntax, is essential. How do we do it?"
- Industry pattern: Excel, Google Sheets, and Numbers all provide in-app formula help (inline suggestions, help panels, function reference).
- NFR-U4: "Error messages shall be clear and actionable"—in-app formula reference supports discoverability and reduces formula errors.

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impact | Notes |
|------|--------|-------|
| **Epic 9** (Documentation & Project Cleanup) | **Modify** | Add new story 9-6 for in-app formula help; reprioritize 9-2 as nice-to-have |
| Epic 7 (macOS Integration) | Minor | Help menu already exists; add one menu item |
| Epic 3 (Electron) | None | No structural changes |
| Epics 10, 11 | None | No impact |

### Story Impact

| Story | Action |
|-------|--------|
| **9-2** (Create User Documentation) | **Keep as done**—USER_GUIDE.md remains useful for external reference; no rollback |
| **9-6** (new) | **Add**—Implement in-app formula reference |
| 9-1, 9-3, 9-4, 9-5 | No change |

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| PRD | No explicit requirement for in-app help | Add to Phase 1 or document as enhancement; NFR-U4 supports it |
| Architecture | None | Frontend-only change |
| UI/UX | Help menu and modal patterns exist | Reuse existing modal pattern |
| Epics | Epic 9 scope | Add story 9-6 |

### Technical Impact

- **Frontend:** New modal or help panel; formula reference content (HTML or JS data).
- **Electron:** Add "Formula Reference" to Help menu; IPC to renderer to show help.
- **Backend:** None.
- **Tests:** Add Playwright test for Help → Formula Reference flow (optional for MVP).

---

## 3. Recommended Approach

### Selected Path: **Direct Adjustment** (Option 1)

Add a new story **9-6: Add In-App Formula Reference** within Epic 9. No rollback, no scope reduction. Effort: **Low–Medium** (2–4 hours).

### Rationale

- **Effort:** Low—reuse existing modal pattern, Help menu, and USER_GUIDE.md content.
- **Risk:** Low—no backend changes, no breaking changes.
- **Value:** High—users get formula help without leaving the app.
- **Timeline:** Fits within current Epic 9 sprint.

### Implementation Approach

#### Option A: Modal with Formula Reference (Recommended)

1. **Help menu:** Add "Formula Reference" below "About GoSheet".
2. **IPC:** `menu-formula-help` → renderer shows formula help modal.
3. **Modal content:** Scrollable panel with:
   - Formula basics (= prefix, cell refs, ranges)
   - Arithmetic operators (+, -, *, /, %)
   - Comparison operators (=, !=, <, >, <=, >=)
   - Functions: SUM, AVG, MIN, MAX, COUNT, CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID (with syntax and one example each)
4. **Source:** Extract from USER_GUIDE.md Section 4 or maintain a `frontend/formula-reference.js` data structure; render as HTML in modal.

**Pros:** Simple, consistent with existing modals (CSV preview, confirm dialogs), no new windows.  
**Cons:** Modal covers the spreadsheet; user must close to continue (acceptable for reference lookup).

#### Option B: Dedicated Help Window

Open a small BrowserWindow with `formula-help.html` when user selects Help → Formula Reference.  
**Pros:** User can keep it open while editing.  
**Cons:** More complex (new window lifecycle, sizing), may feel heavy for MVP.

#### Option C: Formula Bar Tooltip / Inline Help Icon

Add a small "?" icon next to the formula bar that opens a popover with formula reference.  
**Pros:** Contextual, always visible.  
**Cons:** Less discoverable than Help menu; UI clutter.

**Recommendation:** **Option A** for MVP—fast to implement, follows existing patterns, satisfies "essential" requirement.

---

## 4. Detailed Change Proposals

### Proposal 1: Add Story 9-6 to Epic 9

**Epic:** Epic 9: Documentation & Project Cleanup  
**Section:** Stories (after 9-5)

**NEW STORY:**

```markdown
### Story 9.6: Add In-App Formula Reference

As an end user,
I want to access formula syntax and function reference from within the app,
So that I can write formulas without leaving the spreadsheet or opening external documentation.

**Acceptance Criteria:**

**Given** I am using GoSheet
**When** I choose Help → Formula Reference (or equivalent)
**Then** a modal or panel opens showing:
- Formula basics (= prefix, cell references, range references)
- Arithmetic operators (+, -, *, /, %) with examples
- Comparison operators (=, !=, <, >, <=, >=) with examples
- All supported functions with syntax and one example each:
  - Numeric: SUM, AVG, MIN, MAX, COUNT
  - String: CONCAT, UPPER, LOWER, LEN, LEFT, RIGHT, MID
**And** the content is scrollable and readable
**And** I can close the help and return to the spreadsheet
**And** the Help menu item is clearly labeled (e.g., "Formula Reference" or "Formula Help")
```

**Rationale:** Captures the essential in-app documentation requirement with clear, testable criteria.

---

### Proposal 2: Update Help Menu (electron/menu.js)

**File:** `electron/menu.js`  
**Section:** Help menu submenu (around line 262)

**OLD:**
```javascript
submenu: [
  {
    id: 'about',
    label: 'About GoSheet',
    click: () => { ... }
  }
]
```

**NEW:**
```javascript
submenu: [
  {
    id: 'formula-reference',
    label: 'Formula Reference',
    click: () => {
      if (mainWindow) {
        mainWindow.webContents.send('menu-formula-reference');
      }
    }
  },
  { type: 'separator' },
  {
    id: 'about',
    label: 'About GoSheet',
    click: () => { ... }
  }
]
```

**Rationale:** Standard macOS Help menu pattern; "Formula Reference" is discoverable and descriptive.

---

### Proposal 3: Add Formula Help Modal (frontend)

**Files:** `frontend/app.js`, `frontend/spreadsheet.css`, optionally `frontend/formula-reference.html` or inline in app.js

**Actions:**
1. Add IPC listener for `menu-formula-reference` in preload/renderer.
2. Add formula help modal HTML (similar to csv-preview-modal) with scrollable content.
3. Populate with formula reference content (from USER_GUIDE.md Section 4).
4. Add show/hide logic and close button.
5. Style consistently with existing modals.

**Content to include (concise):**
- Operators table (arithmetic + comparison)
- Functions table: Name | Syntax | Example
- Note on MID 1-based indexing if relevant
- Cell/range reference syntax

**Rationale:** Reuses existing modal infrastructure; content derived from USER_GUIDE.md ensures consistency.

---

### Proposal 4: Update Epic 9 Goal (Optional Clarification)

**File:** `_bmad-output/planning-artifacts/epics.md`  
**Section:** Epic 9 header

**Optional addition to Goal:**
> "and provide in-app formula reference so users can discover formula syntax without external documentation."

**Rationale:** Makes in-app documentation an explicit epic goal; not strictly required if story is sufficient.

---

## 5. Implementation Handoff

### Change Scope: **Minor**

Can be implemented directly by the development team. No backlog reorganization or PM/Architect involvement required.

### Handoff Recipients

- **Development team:** Implement Story 9-6 per proposals above.

### Responsibilities

| Role | Responsibility |
|------|----------------|
| Developer | Implement 9-6: Help menu item, IPC, formula help modal, content |
| (Optional) QA | Verify Help → Formula Reference opens and displays correctly |

### Success Criteria

- [ ] Help menu shows "Formula Reference" item
- [ ] Clicking it opens a modal with formula syntax, operators, and functions
- [ ] Content is accurate and matches model/formula.go capabilities
- [ ] Modal can be closed; user returns to spreadsheet
- [ ] No regressions to existing functionality

### Suggested Implementation Order

1. Add Help menu item and IPC (`menu-formula-reference`)
2. Add modal HTML structure and show/hide logic
3. Add formula reference content (copy from USER_GUIDE.md, adapt to HTML)
4. Style and test
5. Update sprint-status.yaml: add 9-6 as ready-for-dev, then in-progress, then done

---

## 6. Summary

| Item | Value |
|------|-------|
| **Issue** | In-app formula documentation is essential; USER_GUIDE.md alone is insufficient |
| **Recommended approach** | Direct Adjustment—add Story 9-6 |
| **Scope** | Minor |
| **Effort** | 2–4 hours |
| **Risk** | Low |
| **Artifacts to modify** | epics.md (add story), electron/menu.js, frontend/app.js, frontend/spreadsheet.css, sprint-status.yaml |

---

*This proposal was generated by the Correct Course workflow. Review and approve to proceed with implementation.*
