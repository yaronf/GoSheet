# Story 13.3b: Style Editor UX Polish

**Epic:** 13 - Spreadsheet UX & Polish  
**Story:** 13.3b  
**Estimated Effort:** 3–4 hours  
**Status:** done  
**Depends on:** 13.3 (done)  
**Created:** 2026-02-27  
**Source:** sprint-change-proposal-2026-02-27.md

---

## Story

As a user editing or adding a style in Manage Styles,
I want a compact, well-organized form with color pickers, a font picker, and a font size slider,
So that I can choose formatting visually and scan the form quickly instead of scrolling a long list.

---

## Acceptance Criteria

1. **Color pickers** – Font color and fill color use `<input type="color">` with optional hex fallback; user picks visually.
2. **Font size** – Range slider (8–72 pt) or number + stepper with numeric display.
3. **Font picker** – Font name uses `<select>` or datalist with common fonts (Arial, Helvetica, Times New Roman, Courier, Georgia).
4. **Compact layout** – Form is visually compact: grouped sections (Font, Fill, Alignment), inline or grid layout where sensible, reduced vertical sprawl. No long vertical list of details.
5. **No regression** – Edit/add/delete behavior unchanged; controls labeled clearly.

---

## Tasks

- Replace font/fill color inputs with color pickers (+ optional hex input)
- Add font size range slider or stepper
- Add font family select/datalist with common fonts
- Redesign form layout: compact groups, grid/inline where appropriate
- Update Playwright tests to verify controls work

---

## Dev Notes

### Technical Approach

- Use native HTML5 `<input type="color">` for font and fill colors
- Use `<input type="range">` for font size with a numeric display, or number input with step buttons
- Use `<select>` or `<datalist>` for font family with common system fonts
- CSS: grid or flexbox for compact inline layout; group Font, Fill, Alignment into labeled sections

### References

- [13-3-edit-add-delete-styles.md] Manage Styles modal, form structure, formatFromForm, populateFormFromFormat
- [sprint-change-proposal-2026-02-27.md] Full rationale and scope
