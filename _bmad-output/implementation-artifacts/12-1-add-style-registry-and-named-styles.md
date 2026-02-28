# Story 12.1: Add Style Registry and Named Styles

**Epic:** 12 - Named Styles (Title, Header, Total)  
**Story:** 12.1  
**Estimated Effort:** 6–8 hours  
**Status:** done  
**Created:** 2026-02-27  
**Last Updated:** 2026-02-27 (CS from technical-named-styles-research-2026-02-23)

---

## Story

As a developer,
I want a style registry with Title, Header, and Total named styles,
So that cells and ranges can reference styles by ID and the foundation for style picker UI is in place.

---

## Context

**Prerequisites:**

- Technical research: `_bmad-output/planning-artifacts/research/technical-named-styles-research-2026-02-23.md`

**Current State:**

- Spreadsheet model has `Cells`, `Merges`; no cell formatting
- `Cell` struct has `Value`, `Computed`, `IsFormula` only
- File format v1.1: header + cells + merges
- No style-related API endpoints

**Desired State:**

- Style registry with index-based storage (OOXML-style)
- Built-in named styles: Title, Header, Total
- Cells reference styles by `StyleId` (0 = no style)
- Apply styles to cells/ranges via backend API
- File format v1.2: persist style registry and cell style IDs

---

## Acceptance Criteria

1. **Style registry**
  - Shared style registry holds font, fill, border, alignment definitions
  - Styles referenced by index (styleId); 0 reserved for "no style"
  - Built-in named styles: Title, Header, Total (predefined indices)
2. **Cell model**
  - `Cell` has optional `StyleId int` (0 = no style)
  - Cells reference styles by ID; no inline format properties
3. **Named styles (built-in)**
  - **Title**: larger font (e.g. 18–24pt), bold, centered
  - **Header**: bold, light fill, centered
  - **Total**: bold, top border
4. **API**
  - Endpoint or handler to apply style to cell (row, col, styleId)
  - Endpoint or handler to apply style to range (startRow, startCol, endRow, endCol, styleId)
  - GetAllCells / cell responses include StyleId when present
5. **File format**
  - Version bump to 1.2 for style support
  - Save encodes style registry and cell StyleIds
  - Load decodes styles; backward compat: v1.1 files load without styles (StyleId 0 for all cells)
6. **Tests**
  - Go unit tests for style registry, apply-to-cell, apply-to-range
  - Save/load round-trip with styles
  - All existing tests pass

---

## Tasks / Subtasks

- Task 1: Define style data structures (AC: 1)
  - `Font` struct: Name, Size, Bold, Italic, Color (hex)
  - `Fill` struct: Pattern, FgColor, BgColor
  - `Border` struct: Left, Right, Top, Bottom (each: Style, Color)
  - `CellFormat` struct: Font, Fill, Border, Alignment (horizontal, vertical)
  - `StyleRegistry` struct: Formats, Names (exported for gob)
  - Built-in indices: 1=Title, 2=Header, 3=Total (0=no style)
- Task 2: Add StyleId to Cell and Spreadsheet.Styles (AC: 2, 3)
  - `Cell.StyleId int` (0 = no style)
  - `Spreadsheet.Styles *StyleRegistry`
  - `NewSpreadsheet()` initializes registry with built-in styles
- Task 3: Apply-style logic (AC: 4)
  - `ApplyStyleToCell(row, col, styleId)` on Spreadsheet
  - `ApplyStyleToRange(startRow, startCol, endRow, endCol, styleId)`
  - Validate styleId exists in registry; no-op if 0
- Task 4: API endpoints (AC: 4)
  - POST /api/cell/style, POST /api/range/style
  - Ensure GetAllCells includes styleId when present (cells with value or style)
- Task 5: File format v1.2 (AC: 5)
  - Save: encode Styles registry after cells and merges
  - Load: decode styles for v1.2; v1.1 files use default registry
  - Version check: accept "1.1" and "1.2"
- Task 6: Unit tests (AC: 6)
  - Test style registry, built-in styles
  - Test ApplyStyleToCell, ApplyStyleToRange
  - Test save/load with styles, v1.1 backward compat
  - Run `go test ./...` — all pass

---

## Dev Notes

### Architecture Compliance

- **model/** package: Style structs, StyleRegistry, Cell.StyleId, Spreadsheet.Styles
- **api/** package: Apply-style handlers
- **File format**: Gob encoding. Add styles block; support v1.1 (no styles) and v1.2 (with styles)

### Technical Requirements (from research)

**OOXML-style index-based model:**

- Shared collections (fonts, fills, borders) with cells referencing by index
- Registry pattern: ~70% cell data compression vs inline (Rows n Columns)
- Built-in styles: Title, Total, Header (Excel/openpyxl compatibility)

**Built-in style definitions (suggested):**


| Style  | Font      | Fill       | Border | Alignment |
| ------ | --------- | ---------- | ------ | --------- |
| Title  | 18pt bold | none       | none   | center    |
| Header | bold      | light gray | bottom | center    |
| Total  | bold      | none       | top    | left      |


### File Structure

- **New**: `model/style.go` — Font, Fill, Border, CellFormat, StyleRegistry
- **Modify**: `model/cell.go` — add StyleId
- **Modify**: `model/spreadsheet.go` — add Styles, ApplyStyleToCell, ApplyStyleToRange
- **Modify**: `model/file.go` — v1.2 save/load with styles; v1.1 backward compat
- **Modify**: `api/handlers.go` — apply-style endpoints (StyleId included inline in GetAllCells response; response.go not needed)

### Testing Standards

- `model/style_test.go` — registry, built-in styles
- `model/spreadsheet_test.go` — ApplyStyleToCell, ApplyStyleToRange
- `model/file_test.go` — save/load v1.2 with styles, v1.1 loads without styles
- `api/handlers_test.go` — apply-style endpoint tests

### References

- [Source: _bmad-output/planning-artifacts/research/technical-named-styles-research-2026-02-23.md] — data model, OOXML, built-in styles, registry pattern
- [Source: model/spreadsheet.go] — Spreadsheet, Cell access patterns
- [Source: model/cell.go] — Cell struct
- [Source: model/file.go] — FileHeader, SaveToFile, LoadFromFile, version handling

---

## Dev Agent Record

### Agent Model Used

Cursor Composer (dev-story workflow)

### Completion Notes List

- **2026-02-28 DS:** Implemented style registry (Font, Fill, Border, Alignment, CellFormat, StyleRegistry), Cell.StyleId, Spreadsheet.Styles. Added ApplyStyleToCell, ApplyStyleToRange. API: POST /api/cell/style, POST /api/range/style. GetAllCells includes styleId when cell has style. File format v1.2 with Styles block; v1.1 backward compat. All Go tests pass.
- **2026-02-28 CR:** Fixed HIGH: input validation for row/col >= 0 in ApplyStyleToCell and ApplyStyleToRange. Fixed MEDIUM: range size limit (max 10,000 cells) to prevent DoS. Fixed MEDIUM: added OpenAPI schema for /api/cell/style and /api/range/style. Fixed LOW: GetFormat now returns a copy so callers cannot mutate the registry. Fixed LOW: Dev Notes cleanup (response.go not needed).
- **2026-02-28 CC:** Added text color to style registry: Title #1a1a2e, Header #000000, Total #333333. Font.Color was already in model; set distinct values for built-in styles. Frontend CSS updated to render text color.

### File List

- model/style.go (new: Font, Fill, Border, CellFormat, StyleRegistry, built-in Title/Header/Total)
- model/style_test.go (new: style registry tests)
- model/cell.go (add StyleId)
- model/spreadsheet.go (add Styles, ApplyStyleToCell, ApplyStyleToRange, input validation, range limit)
- model/spreadsheet_test.go (ApplyStyleToCell/Range tests, negative coords, large range)
- model/file.go (v1.2 save/load with Styles; v1.1 compat)
- model/file_test.go (TestSaveAndLoadWithStyles, TestLoadFromBytes_V1_1BackwardCompat)
- controller/app.go (ApplyStyleToCell, ApplyStyleToRange)
- api/handlers.go (HandleApplyCellStyle, HandleApplyRangeStyle, GetAllCells with styleId)
- api/handlers_test.go (TestHandleApplyCellStyle, TestHandleApplyRangeStyle, TestHandleGetAllCells_WithStyleId, validation tests)
- api/openapi.yaml (ApplyCellStyleRequest, ApplyRangeStyleRequest, ApplyStyleResponse, paths)
- server/main.go (register /api/cell/style, /api/range/style)

