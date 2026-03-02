# Sprint Change Proposal: Edit Style Dialog UX Enhancement

**Date:** 2026-02-27  
**Workflow:** Correct Course  
**Project:** spreadsheet  
**Author:** BMAD Correct Course

---

## Section 1: Issue Summary

### Problem Statement

The Edit Style dialog in Format → Manage Styles is **super rudimentary** in two ways:

**1. Controls:** Users must use plain text inputs for font name and hex colors, and a bare number input for font size—no color picker, font picker, or slider/stepper.

**2. Layout:** The form is a long vertical list of details that feels cluttered and takes too much space. It should be more compact and visually organized (e.g., grouped sections, inline controls, grid layout).

Together this creates poor UX: users must type hex codes and font names manually, and the form is hard to scan.

### Context

- **Trigger story:** 13.3 Edit/Add/Delete Styles (status: done)
- **Discovery:** User feedback during/after implementation
- **Evidence:** "The edit style dialog is super rudimentary: no color or font picker, no slider (or other element) for font size, etc." + "Also format the layout to be more compact and better looking instead of a long list of details."

### Issue Type

**Technical limitation discovered during implementation.** Story 13.3 delivered functional edit/add/delete behavior but the form controls were minimal (text inputs, number input, checkboxes). The acceptance criteria did not specify rich controls; the implementation met the letter of the story but not user expectations for a style editor.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact | Notes |
|------|--------|-------|
| Epic 13: Spreadsheet UX & Polish | **Moderate** | Add new story or extend 13.3 with UX polish tasks |

**Epic 13 can still be completed as planned.** This is an enhancement within scope, not a scope change.

### Story Impact

| Story | Impact | Action |
|-------|--------|--------|
| 13.3 Edit/Add/Delete Styles | **Enhancement** | Add follow-up story or extend with polish tasks |
| 13.4–13.10 | None | No impact |

### Artifact Conflicts

| Artifact | Conflict | Action |
|----------|----------|--------|
| PRD | None | No PRD changes |
| Architecture | None | No architecture changes |
| UX Design Spec | **Update** | Add style editor control patterns (color picker, font picker, font size slider) |
| Story 13.3 | **Clarify** | Document that AC2 "edit a style" implies usable controls; add explicit polish story |

### Technical Impact

- **Frontend:** Add HTML5 `<input type="color">` for font and fill colors; add font-family `<select>` or datalist; add `<input type="range">` for font size (or keep number + stepper)
- **Dependencies:** None (native HTML5 controls, no new libraries)
- **Testing:** Playwright tests should verify new controls work; no backend changes

---

## Section 3: Recommended Approach

### Selected Path: **Direct Adjustment (Option 1)**

Add a **new story** within Epic 13 to enhance the Edit Style form with proper controls.

**Rationale:**

- Story 13.3 is marked done; reopening it would complicate status tracking
- A focused follow-up story keeps scope clear and testable
- Effort is **Low** (1–3 hours): native HTML5 controls require minimal code
- Risk is **Low**: no backend changes, no new dependencies
- Maintains momentum; does not require rollback or MVP scope change

### Effort Estimate

| Task | Effort |
|------|--------|
| Color pickers (font + fill) | 0.5 h |
| Font size slider or stepper | 0.5 h |
| Font picker (select/datalist) | 1 h |
| Compact layout redesign | 1 h |
| Playwright tests | 0.5 h |
| **Total** | **~3.5 h** |

---

## Section 4: Detailed Change Proposals

### Proposal 1: New Story 13.3b – Style Editor UX Polish

**Artifact:** `_bmad-output/implementation-artifacts/13-3b-style-editor-ux-polish.md` (new)

**Content:**

```markdown
# Story 13.3b: Style Editor UX Polish

**Epic:** 13 - Spreadsheet UX & Polish
**Story:** 13.3b
**Estimated Effort:** 3–4 hours
**Status:** backlog
**Depends on:** 13.3 (done)

## Story

As a user editing or adding a style in Manage Styles,
I want a compact, well-organized form with color pickers, a font picker, and a font size slider,
So that I can choose formatting visually and scan the form quickly instead of scrolling a long list.

## Acceptance Criteria

1. **Color pickers** – Font color and fill color use `<input type="color">` with optional hex fallback; user picks visually.
2. **Font size** – Range slider (8–72 pt) or number + stepper with numeric display.
3. **Font picker** – Font name uses `<select>` or datalist with common fonts (Arial, Helvetica, Times New Roman, Courier, Georgia).
4. **Compact layout** – Form is visually compact: grouped sections (Font, Fill, Alignment), inline or grid layout where sensible, reduced vertical sprawl. No long vertical list of details.
5. **No regression** – Edit/add/delete behavior unchanged; controls labeled clearly.

## Tasks

- Replace font/fill color inputs with color pickers (+ optional hex input)
- Add font size range slider or stepper
- Add font family select/datalist with common fonts
- Redesign form layout: compact groups, grid/inline where appropriate
- Update Playwright tests to verify controls work
```

---

### Proposal 2: Update sprint-status.yaml

**Artifact:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Change:** Add story 13.3b under Epic 13:

```yaml
  13-3-edit-add-delete-styles: done
  13-3b-style-editor-ux-polish: backlog
  13-4-ui-layout-compact: backlog
```

---

### Proposal 3: UX Design Specification (Optional)

**Artifact:** `_bmad-output/planning-artifacts/ux-design-specification.md`

**Change:** Add a short subsection under Format/Manage Styles describing:

- Style editor form controls: color picker, font picker, font size slider/stepper
- Style editor layout: compact, grouped sections (Font, Fill, Alignment), grid/inline layout
- Reference: HTML5 native controls for MVP; no custom widget library

---

## Section 5: Implementation Handoff

### Change Scope: **Minor**

Can be implemented directly by the development team. No backlog reorganization or PM/Architect involvement required.

### Handoff Recipients

| Role | Responsibility |
|------|----------------|
| Development team | Implement Story 13.3b; add color pickers, font picker, font size control; update tests |
| (Optional) PO/SM | Create story file `13-3b-style-editor-ux-polish.md` if not auto-generated |

### Success Criteria

- [ ] Font color and fill color use visual color pickers
- [ ] Font size has slider or stepper
- [ ] Font name has select/datalist with common fonts
- [ ] Form layout is compact and well-organized (grouped, grid/inline, reduced vertical sprawl)
- [ ] Edit and Add flows work with new controls
- [ ] Playwright tests pass
- [ ] No regression in existing Manage Styles behavior

---

## Approval

- [x] User approval obtained (2026-02-27)
- [ ] sprint-status.yaml updated
- [ ] Story file created (if new story approach chosen)

---

*Generated by Correct Course workflow*
