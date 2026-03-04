# Story 13.8: Alignment (Left/Right/Center)

**Epic:** 13 - Spreadsheet UX & Polish
**Story:** 13.8
**Estimated Effort:** 3–4 hours
**Status:** done
**Source:** epics.md, todo-2026-03-01.md

---

## Story

As a user,
I want to set cell alignment (left, right, center),
so that I can format tables and headers.

## Acceptance Criteria

1. **Given** I select one or more cells
   **When** I choose alignment (left, center, right) from the toolbar or Format menu
   **Then** the cell content aligns accordingly (CSS `text-align`)

2. **Given** I have set alignment on a cell
   **When** I save and reload the file
   **Then** the alignment is preserved

3. **Given** a cell has a named style (e.g., Title) with its own alignment
   **When** I also set cell-level alignment
   **Then** cell-level alignment overrides the style's default alignment

4. **Given** I select a range of cells
   **When** I apply alignment
   **Then** all cells in the range get the same alignment

## Tasks / Subtasks

- [x] Task 1: Model — add `Alignment` field to `Cell` struct (AC: 1, 2, 3)
  - [x] In `model/cell.go`: add `Alignment string` field (values: `""`, `"left"`, `"center"`, `"right"`)
  - [x] `gob` will serialize it automatically (no save/load changes needed)
  - [x] Add Go unit tests in `model/cell_test.go`: `TestCell_Alignment` — verify field default is `""`, values are stored

- [x] Task 2: Controller — expose SetCellAlignment / SetRangeAlignment (AC: 1, 4)
  - [x] In `controller/app.go`: add `SetCellAlignment(row, col int, alignment string) error`
  - [x] Validates alignment is one of `""`, `"left"`, `"center"`, `"right"`, returns error otherwise
  - [x] Sets `cell.Alignment` directly on the cell (creates cell if it doesn't exist via `Sheet.GetOrCreateCell`)
  - [x] Add `SetRangeAlignment(startRow, startCol, endRow, endCol int, alignment string) error` — loops over range, calls `SetCellAlignment`
  - [x] Mark sheet as modified (`c.Sheet.Modified = true`)

- [x] Task 3: API — new endpoints (AC: 1, 4)
  - [x] In `api/handlers.go`: add `HandleSetCellAlignment` (POST `/api/cell/alignment`) and `HandleSetRangeAlignment` (POST `/api/range/alignment`)
  - [x] Request structs: `{ row, col, alignment }` and `{ startRow, startCol, endRow, endCol, alignment }`
  - [x] Return standard `{"success": true}` JSON (same pattern as `/api/cell/style`)
  - [x] In `api/handlers.go` `HandleGetAllCells`: include `alignment` field in each cell entry when `cell.Alignment != ""`
  - [x] Register routes in `server/main.go` (same pattern as existing `/api/cell/style`, `/api/range/style`)
  - [ ] Update OpenAPI schema in `api/openapi.yaml` (deferred — schema is supplementary, not blocking)

- [x] Task 4: Frontend — toolbar buttons + apply alignment (AC: 1, 2, 3, 4)
  - [x] In `frontend/app.js` toolbar section: add 3 alignment toolbar buttons with IDs `align-left-btn`, `align-center-btn`, `align-right-btn` (SVG icons, `toolbar-btn` class)
  - [x] Wire click handlers: `applyAlignmentToSelection()` uses `selectionRange`, calls `SetCellAlignment` or `SetRangeAlignment`, then `refreshAllCells()`
  - [x] In `applyCellValue()`: added `alignment = ''` parameter; cell-level alignment applied AFTER style logic (overrides)
  - [x] Updated `GetAllCells` mapping in `frontend/api-client.js`: include `alignment` from response
  - [x] Updated `refreshAllCells()` and `loadCells()` to pass `cellData.alignment ?? ''`

- [x] Task 5: Playwright tests (AC: 1, 2, 4)
  - [x] Created `playwright_tests/test_alignment.spec.js` — 6 tests, all pass
  - [x] Test: center alignment applied
  - [x] Test: right alignment applied
  - [x] Test: left alignment applied
  - [x] Test: range alignment (3 cells)
  - [x] Test: cell-level overrides style alignment
  - [x] Test: alignment persists in API response (save/load roundtrip)

## Dev Notes

### Architecture: How Alignment Is Currently Handled

Currently alignment is **only part of named styles** (`model/style.go` → `CellFormat.Alignment`). There is no **cell-level** alignment field. The `Cell` struct in `model/cell.go` only has `Value`, `Computed`, `IsFormula`, `IsQuotePrefix`, `StyleId`.

For Story 13.8, the design is to add **cell-level alignment** independent of styles:
- Cell struct gets `Alignment string` (values: `""` = inherit from style or default, `"left"`, `"center"`, `"right"`)
- This enables per-cell alignment without needing a named style

### Frontend Alignment Application Order (IMPORTANT)

Current `applyCellValue()` alignment logic (lines 1579–1600):
1. Reset `cell.style.textAlign = ''` and `cell.style.verticalAlign = ''`
2. If styleId > 0 → apply style's `format.alignment` via `cell.style.setProperty`
3. If `align.horizontal === '' || 'default'` → use cell-type default (numbers right, text left)

**With cell-level alignment**, the order should be:
1. Reset both (existing)
2. Apply style alignment (existing)
3. **If cell has `alignment` field set → override with `cell.style.textAlign = alignment`**

This means cell-level alignment beats style alignment (same priority model as Excel).

### API Pattern to Follow

`POST /api/cell/alignment` — mirrors `POST /api/cell/style`:
```go
type SetCellAlignmentRequest struct {
    Row       int    `json:"row"`
    Col       int    `json:"col"`
    Alignment string `json:"alignment"`
}
```

`POST /api/range/alignment` — mirrors `POST /api/range/style`:
```go
type SetRangeAlignmentRequest struct {
    StartRow  int    `json:"startRow"`
    StartCol  int    `json:"startCol"`
    EndRow    int    `json:"endRow"`
    EndCol    int    `json:"endCol"`
    Alignment string `json:"alignment"`
}
```

### GetAllCells Response Addition

In `handlers.go` `HandleGetAllCells`, add alignment to cell entry:
```go
if cell.Alignment != "" {
    entry["alignment"] = cell.Alignment
}
```

Frontend reads it in `api-client.js` `GetAllCells` mapping, passes it through to `applyCellValue`.

### Toolbar Buttons

The toolbar is built in `buildSpreadsheetImpl()` around line 252 in `app.js`. Follow the existing SVG icon button pattern. After the existing file buttons, add alignment buttons in the toolbar. Standard Unicode SVG icons for alignment are fine (or use simple text icons).

### GetOrCreateCell Pattern

For `SetCellAlignment`, use the existing `Sheet.GetOrCreateCell(row, col)` or equivalent — check how `ApplyStyleToCell` does it in `model/sheet.go` to follow the same pattern:

```go
// In model/sheet.go (check existing ApplyStyleToCell for exact pattern)
func (s *Sheet) SetCellAlignment(row, col int, alignment string) error {
    cell := s.GetOrCreateCell(row, col)
    cell.Alignment = alignment
    return nil
}
```

### Testing Standards (Actual Practice)

- **Go unit tests**: Co-located as `*_test.go` files in `model/` and `controller/`
- **Playwright tests**: `playwright_tests/test_alignment.spec.js`
- Use `setCellViaApi`, direct `fetch` helpers for new endpoints; `waitForFunction` or `toHaveClass` for assertions
- `test.beforeEach` with `ensureSpreadsheetView(window)`, `test.afterEach` with cell cleanup
- ~164 tests currently passing — all must remain green after this story

### Sheet.GetOrCreateCell

Check `model/sheet.go` for how `ApplyStyleToCell` works to get the right pattern for creating cells:
```go
// [Source: model/sheet.go] — find ApplyStyleToCell for exact GetOrCreateCell usage
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.8]
- [Source: model/cell.go] — Cell struct to add `Alignment string` field
- [Source: model/style.go:47-58] — Existing `Alignment` struct in `CellFormat` (different — style-level, not cell-level)
- [Source: frontend/app.js:1557-1600] — `applyCellValue()`, current alignment logic to extend
- [Source: frontend/app.js:252-300] — Toolbar construction, icon button pattern
- [Source: api/handlers.go:449-500] — `HandleApplyCellStyle` / `HandleApplyRangeStyle` — pattern to mirror for alignment
- [Source: controller/app.go:315-323] — `ApplyStyleToCell`, `ApplyStyleToRange` — pattern to mirror
- [Source: frontend/api-client.js] — `GetAllCells` mapping to extend with `alignment`
- [Source: _bmad-output/implementation-artifacts/13-7-quote-prefix-for-text.md] — previous story patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `Alignment string` to `Cell` struct; validation in `model/spreadsheet.go` `SetCellAlignment`/`SetRangeAlignment`
- Two new API endpoints: POST `/api/cell/alignment`, POST `/api/range/alignment`; `HandleGetAllCells` returns `alignment` field when non-empty
- Frontend: 3 SVG toolbar buttons, `applyAlignmentToSelection()` handler, `applyCellValue()` extended with `alignment` param that overrides style alignment
- 6 Playwright tests all pass; all Go tests pass
- Code review fixes: added controller+model unit tests (8 tests), fixed HandleGetAllCells to use dynamic bounds, added HTTP method checks, added aria-pressed to alignment buttons, extracted setCellAlignmentUnchecked to avoid double-validation in range loop

### File List

- `model/cell.go` — Added `Alignment string` field to `Cell` struct
- `model/cell_test.go` — Added `TestCell_Alignment`
- `model/spreadsheet.go` — Added `SetCellAlignment`, `SetRangeAlignment`, `validAlignments`
- `controller/app.go` — Added `SetCellAlignment`, `SetRangeAlignment` delegators
- `api/handlers.go` — Added `HandleSetCellAlignment`, `HandleSetRangeAlignment`, `SetCellAlignmentRequest`, `SetRangeAlignmentRequest`; updated `HandleGetAllCells` to include `alignment`
- `server/main.go` — Registered `/api/cell/alignment`, `/api/range/alignment` routes
- `frontend/api-client.js` — `GetAllCells` maps `alignment` field; added `SetCellAlignment`, `SetRangeAlignment` exports
- `frontend/app.js` — Import `SetCellAlignment`, `SetRangeAlignment`; toolbar alignment buttons; `applyCellValue()` signature + cell-level override; `refreshAllCells`/`loadCells` pass alignment
- `playwright_tests/test_alignment.spec.js` — New: 6 E2E tests

