# GoSheet .sheet File Format Specification

**File format version:** 2.1  
**Encoding:** MessagePack (msgpack.org)  
**Extension:** `.sheet`

This document describes the binary format of GoSheet spreadsheet files so that other languages (Python, JavaScript, Rust, etc.) can read and write `.sheet` files.

**Note:** The `version` field is the **file format version** (schema), not the GoSheet app version. Format version 2.1 defines this structure; future schema changes would use 2.2, 3.0, etc.

## Overview

A `.sheet` file is a single MessagePack-encoded map (object) containing:

| Field       | Type   | Description                          |
|-------------|--------|--------------------------------------|
| `version`   | string | File format version, must be `"2.1"` |
| `cell_count`| int    | Number of cells (informational)      |
| `cells`     | map    | Row → Col → Cell data                |
| `merges`    | array  | Merge regions                        |
| `styles`    | map    | Style registry                       |

## Top-Level Structure

```
{
  "version": "2.1",
  "cell_count": 42,
  "cells": { ... },
  "merges": [ ... ],
  "styles": { ... }
}
```

## Cells

`cells` is a map of row index (int) → map of column index (int) → cell object. Only non-empty cells are stored (sparse storage).

**Cell object** (persisted fields; formula AST is not stored and must be rebuilt from `value`):

| Field           | Type   | Description |
|-----------------|--------|-------------|
| `value`         | string | Raw value: formula expression without leading `=`, or plain text. Always string (numbers stored as `"42"` etc.) |
| `is_formula`    | bool   | True if cell contains a formula |
| `is_quote_prefix` | bool | True if value starts with `'` (Excel-style text force) |
| `error_kind`    | int    | Error type: 0=None, 1=Eval, 2=Ref, 3=Circular, 4=Parse. 0 means no error. |
| `style_id`      | int    | 0 = none; 1=Title, 2=Header, 3=Total |
| `invalid_refs`  | array of string | Refs that failed to parse (e.g. `["B2"]`) |

Alignment (horizontal, wrap) is stored in the style's `CellFormat.Alignment`, not per-cell.

**Formula handling:** For formula cells, `value` holds the bare expression (e.g. `A1+B1`). The leading `=` is implied. On load, the application parses `value` to rebuild the formula AST and recalculates. The displayed value (`computed`) is derived, not persisted.

**Plain cells:** For non-formula cells, displayed value = `value` (or `value[1:]` for quote-prefix). No separate `computed` field is stored.

## Merges

`merges` is an array of merge region objects:

| Field      | Type | Description |
|------------|------|--------------|
| `StartRow` | int  | Top-left row (0-indexed) |
| `StartCol` | int  | Top-left column (0-indexed) |
| `RowSpan`  | int  | Number of rows (1 = single cell) |
| `ColSpan`  | int  | Number of columns (1 = single cell) |

Only the anchor cell (top-left) holds data; covered cells are hidden.

## Styles

`styles` is an object with:

| Field    | Type  | Description |
|----------|-------|--------------|
| `Formats`| array | `CellFormat` objects indexed by style ID (0 reserved) |
| `Names`  | map   | Style name (string) → format index (int) |

**CellFormat** (nested in Formats):

| Field       | Type  | Description |
|-------------|-------|--------------|
| `Font`      | object| `Name`, `Size`, `Bold`, `Italic`, `Color` |
| `Fill`      | object| `Pattern`, `FgColor`, `BgColor` |
| `Border`    | object| `Left`, `Right`, `Top`, `Bottom` (each: `Style`, `Color`) |
| `Alignment` | object| `Horizontal`, `Wrap` (bool) |

Built-in styles: index 1 = Title, 2 = Header, 3 = Total.

### Color format

All color fields use **hex** format: `#RRGGBB` (6-digit) or `#RGB` (3-digit shorthand). Examples: `#000000`, `#fff`, `#1a1a2e`. Used in `Font.Color`, `Fill.FgColor`, `Fill.BgColor`, and `BorderSide.Color`.

### Font names and unknown fonts

Font names (e.g. `"Helvetica"`, `"Arial"`) are stored as plain strings. If a font is not available on the system, GoSheet applies a fallback stack when rendering (e.g. `"CustomFont", sans-serif`) so a sensible default is used. The file format does not store the fallback; it is applied at render time.

## MessagePack Details

- Use standard MessagePack encoding (RFC-like; see msgpack.org).
- Map keys for the top-level and nested structures use the field names as shown (snake_case for cell fields: `value`, `is_formula`, `is_quote_prefix`, `error_kind`, etc.). No separate `computed` field is stored; it is derived on load.
- Integer map keys (row/col in `cells`) are encoded as MessagePack integers.
- The Go implementation uses `SetSortMapKeys(true)` for deterministic output; other implementations may encode maps in any order.

## Example: Minimal File

A spreadsheet with one cell at A1 containing "Hello":

```json
{
  "version": "2.1",
  "cell_count": 1,
  "cells": {
    "0": {
      "0": {
        "value": "Hello",
        "is_formula": false,
        "is_quote_prefix": false,
        "error_kind": 0,
        "style_id": 0,
        "invalid_refs": []
      }
    }
  },
  "merges": [],
  "styles": { "Formats": [...], "Names": {...} }
}
```

(Note: In actual MessagePack, keys are binary; the JSON above is for illustration.)

## Version History

| Version | Encoding | Notes |
|---------|----------|-------|
| 2.1     | MessagePack | Typed `error_kind` replaces `is_error`; no backward compat with 2.0 |
| 2.0     | MessagePack | Cross-language; deprecated (no `error_kind`) |
| 1.2     | gob      | Deprecated; no longer supported |
| 1.1     | gob      | Deprecated; no longer supported |

## References

- [MessagePack specification](https://msgpack.org/)
- Go implementation: `model/file.go`, `model/cell.go`
- Research: `_bmad-output/planning-artifacts/research/technical-file-format-cross-language-random-access-research-2026-02-23.md`
