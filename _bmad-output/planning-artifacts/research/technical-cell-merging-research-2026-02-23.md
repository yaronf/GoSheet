# Technical Research: Cell Merging in Spreadsheet UI

**Date:** 2026-02-23  
**Topic:** Frontend and backend requirements for horizontal/vertical cell merging  
**Status:** Draft

---

## Executive Summary

Adding cell merging to GoSheet is a **non-trivial feature** that requires changes across the frontend, backend, file format, and API. It is not a simple frontend-only change. This research outlines the scope and recommends a phased approach.

**Rough effort estimate:** 3–5 days (frontend + backend + file format + UX).

---

## Current Architecture

### Frontend (`frontend/app.js`)

- **buildSpreadsheet()** — Creates a fixed grid: one `<td>` per (row, col). No colspan/rowspan.
- **refreshAllCells()** / **loadCells()** — Look up cells by `#cell-${row}-${col}` and set textContent.
- **selectCell(row, col)** — Assumes every (row, col) has a DOM element.
- **Cell IDs** — `cell-0-0`, `cell-0-1`, etc. — one-to-one with grid coordinates.

### Backend (`model/`)

- **Spreadsheet.Cells** — `map[int]map[int]*Cell` (row → col → Cell).
- **File format** — Gob-encoded cells map. No merge metadata.
- **API** — `GetAllCells`, `SetCellValue`, `GetCellRawValue` — all assume a flat (row, col) grid.

---

## What Merging Requires

### 1. Data Model (Backend)

**Merge regions** must be stored separately from cell values:

```go
// Option A: Separate merge list
type MergeRegion struct {
    StartRow, StartCol int  // Anchor (top-left)
    RowSpan, ColSpan   int    // 1 = no merge
}

type Spreadsheet struct {
    Cells       map[int]map[int]*Cell
    Merges      []MergeRegion  // NEW
    // ...
}
```

**Semantics:**

- Only the **anchor cell** (top-left) holds the value; covered cells are hidden.
- Formulas reference the anchor (e.g. `A1` for merged A1:C1).
- Covered cells: no DOM element, not selectable, not editable.

### 2. File Format

- Add `Merges` to the serialized structure.
- Bump file version (e.g. `1.1`) for backward compatibility.
- Existing `.sheet` files without merges load as before (empty Merges).

### 3. API

- **GetMergeRegions** — Return merge regions for the frontend.
- **SetMerge** / **Unmerge** — Create/remove merge regions.
- **GetAllCells** — Only return anchor cells for merged regions (or document that covered cells are omitted).
- **SetCellValue** — When setting a covered cell, either reject or map to anchor.

### 4. Frontend Changes

| Component | Change |
|-----------|--------|
| **buildSpreadsheet()** | Render cells with colspan/rowspan for anchor cells; skip covered cells. Requires a merge-aware rendering pass instead of a simple loop. |
| **loadCells()** | Only update anchor cells; covered cells don't exist in DOM. |
| **refreshAllCells()** | Same; need a mapping from (row,col) → anchor for merged regions. |
| **selectCell()** | Map (row,col) to anchor if covered; only anchors are selectable. |
| **Cell lookup** | `getElementById('cell-0-0')` fails for covered cells; need `getCellElement(row, col)` that returns the anchor's td when (row,col) is covered. |
| **Grid expansion** | ROWS/COLS expand logic must account for merged regions. |
| **Keyboard navigation** | Arrow keys should skip covered cells; land on anchor or next unmerged cell. |

### 5. Rendering Logic (Pseudocode)

```javascript
// Instead of: for each (row,col) create td
// We need:
for (let row = 0; row < ROWS; row++) {
  const tr = document.createElement('tr');
  let col = 0;
  while (col < COLS) {
    const merge = getMergeAt(row, col);
    const td = document.createElement('td');
    if (merge && merge.anchorRow === row && merge.anchorCol === col) {
      td.colSpan = merge.colSpan;
      td.rowSpan = merge.rowSpan;
      td.id = `cell-${row}-${col}`;
      // ... attach td
      col += merge.colSpan;
    } else if (merge) {
      // (row,col) is covered — no td in this row
      col++;
    } else {
      td.id = `cell-${row}-${col}`;
      // ... attach td
      col++;
    }
    tr.appendChild(td);
  }
}
```

**Row rendering:** With rowspan, a row may have fewer `<td>` elements because some cells are "consumed" by a rowspan from above. Row rendering becomes more complex.

### 6. UX: Merge / Unmerge

- **Merge:** User selects a range → Format menu or context menu → "Merge cells". Backend creates merge region; frontend rebuilds grid.
- **Unmerge:** User selects merged cell → "Unmerge". Backend removes merge; value stays in anchor.

---

## Complexity Summary

| Layer | Effort | Risk |
|-------|--------|------|
| Backend model + Merges | Medium | Low |
| File format + migration | Medium | Medium (backward compat) |
| API (GetMergeRegions, SetMerge, Unmerge) | Low | Low |
| Frontend buildSpreadsheet (colspan/rowspan) | High | Medium |
| Frontend loadCells/refreshAllCells | Medium | Low |
| Frontend selectCell + navigation | Medium | Medium |
| Merge/Unmerge UI | Low | Low |
| CSV import/export | Low | Low (anchor only) |

---

## Implementation Order

1. **Backend:** Add `Merges` to model, file format, API.
2. **Frontend:** Implement merge-aware `buildSpreadsheet()` and `getCellElement(row, col)`.
3. **Frontend:** Update loadCells, refreshAllCells, selectCell to use merge-aware logic.
4. **UX:** Add Merge/Unmerge to Format menu or context menu.
5. **Edge cases:** Keyboard nav, formula refs, CSV.

---

## Alternatives Considered

- **CSS-only:** Use `display` or `visibility` to hide covered cells. Keeps one td per cell but breaks table semantics (colspan/rowspan). Not recommended for proper merging.
- **Canvas/SVG grid:** Rewrite entire grid. Too large for this feature.
- **Defer:** If merging is not critical, document as future enhancement.

---

## Recommendation

**If merging is a priority:** Proceed with the phased approach above. Start with backend + file format, then frontend rendering.

**If merging is nice-to-have:** Add to backlog; document in PRD/epics as a future story. The effort is substantial.

---

## References

- Current grid: `frontend/app.js` (buildSpreadsheet, refreshAllCells, loadCells)
- Backend model: `model/spreadsheet.go`, `model/cell.go`, `model/file.go`
- File format: Gob serialization in `model/file.go`
