# Story 19.5: Fix — Address Box Cannot Select Full Row/Column

Status: done

## Story

As a user,
I want to type `B:B` or `3:3` in the address box and press Enter to select the full column or row,
So that keyboard-driven range navigation works consistently with how the address box already displays row/column selections.

## Acceptance Criteria

1. **Given** the address box is focused, **when** the user types `B:B` and presses Enter, **then** column B is selected (entire column, `selectionMode = 'column'`), exactly as if the user had clicked the column B header.

2. **Given** the address box is focused, **when** the user types `3:3` and presses Enter, **then** row 3 is selected (entire row, `selectionMode = 'row'`), exactly as if the user had clicked the row 3 header.

3. **Given** the address box is focused, **when** the user types a multi-column range like `B:D` and presses Enter, **then** columns B through D are selected (`selectionMode = 'column'`).

4. **Given** the address box is focused, **when** the user types a multi-row range like `2:5` and presses Enter, **then** rows 2 through 5 are selected (`selectionMode = 'row'`).

5. **Given** the user has selected a full column via the address box, **when** the address box updates, **then** it displays the correct notation (e.g., `B:B`) — this is already handled by `updateFormulaBar`.

6. **Given** the user types an invalid full-row/col address (e.g., `0:0`, `0:3`), **when** Enter is pressed, **then** the address box shows the invalid state (red border) and no selection change occurs.

## Tasks / Subtasks

- [x] Task 1: Extend `parseRangeAddress` in `frontend/app-utils.js` to handle full-column and full-row patterns (AC: 1–4, 6)
  - [x] Add regex for full-column range: `/^([A-Z]+):([A-Z]+)$/` → returns `{ startRow: 0, startCol, endRow: OPEN_END, endCol, mode: 'column' }`
  - [x] Add regex for full-row range: `/^(\d+):(\d+)$/` → returns `{ startRow, startCol: 0, endRow, endCol: OPEN_END, mode: 'row' }`
  - [x] For existing single-cell and cell-range patterns, add `mode: 'cell'` to return value
  - [x] Validate column letters (col < 0 or col > 999 → null) and row numbers (row < 1 → null)
  - [x] Import `OPEN_END` from `app-state.js` in `app-utils.js` (currently not imported there)

- [x] Task 2: Update the address box Enter handler in `frontend/app.js` to use `range.mode` (AC: 1–5)
  - [x] Replace hard-coded `appState.selectionMode = 'cell'` with `appState.selectionMode = range.mode ?? 'cell'`
  - [x] No other changes needed — `applySelectionRange` already handles `OPEN_END` correctly

- [x] Task 3: Write Playwright tests in `playwright_tests/test_range_address_box.spec.js` (or add to existing) (AC: 1–6)
  - [x] Test: type `B:B` → column B selected, address box shows `B:B`
  - [x] Test: type `3:3` → row 3 selected, address box shows `3:3`
  - [x] Test: type `B:D` → columns B–D selected
  - [x] Test: type `2:5` → rows 2–5 selected
  - [x] Test: type `0:0` → invalid state, no selection change

- [x] Task 4: Run targeted tests
  - [x] `npm test -- --grep "address.box|range.address"` — all pass

## Dev Notes

### Key Change: `parseRangeAddress` in `frontend/app-utils.js`

Current function (lines 159–194) handles only `A1` and `A1:B2` patterns. Need to add:

```js
// Full column range: B:B or B:D
const colRangeMatch = upper.match(/^([A-Z]+):([A-Z]+)$/);
if (colRangeMatch) {
  const startCol = letterToCol(colRangeMatch[1]);
  const endCol = letterToCol(colRangeMatch[2]);
  if (startCol < 0 || endCol < 0 || startCol > 999 || endCol > 999) return null;
  return {
    startRow: 0,
    startCol: Math.min(startCol, endCol),
    endRow: OPEN_END,
    endCol: Math.max(startCol, endCol),
    mode: 'column',
  };
}

// Full row range: 3:3 or 2:5
const rowRangeMatch = upper.match(/^(\d+):(\d+)$/);
if (rowRangeMatch) {
  const startRow = parseInt(rowRangeMatch[1], 10) - 1;
  const endRow = parseInt(rowRangeMatch[2], 10) - 1;
  if (startRow < 0 || endRow < 0 || startRow > 9999 || endRow > 9999) return null;
  return {
    startRow: Math.min(startRow, endRow),
    startCol: 0,
    endRow: Math.max(startRow, endRow),
    endCol: OPEN_END,
    mode: 'row',
  };
}
```

**OPEN_END import:** `app-utils.js` currently does NOT import from `app-state.js`. Need to add:
```js
import { OPEN_END } from './app-state.js';
```

**Existing return values:** Add `mode: 'cell'` to the singleMatch and rangeMatch return objects for consistency.

### Key Change: Address Box Handler in `frontend/app.js`

Line 783, change:
```js
appState.selectionMode = 'cell';
```
to:
```js
appState.selectionMode = range.mode ?? 'cell';
```

No other changes needed. `applySelectionRange` and the row/column highlight logic already handle `OPEN_END` correctly (from Story 17.5).

### Existing Test File

Check for `playwright_tests/test_range_address_box.spec.js` — if it exists, add tests there. Otherwise create it. Pattern from Story 17.4 tests.

### Project Structure Notes

- Only `frontend/app-utils.js` and `frontend/app.js` need source changes
- No backend changes
- No preload changes

### References

- [Source: frontend/app-utils.js#159–194] — `parseRangeAddress` function
- [Source: frontend/app.js#766–804] — address box event handler
- [Source: frontend/app-grid.js#590–619] — `updateFormulaBar` (already handles OPEN_END display)
- [Source: frontend/app-state.js#34–36] — `OPEN_END` constant
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 19] — story rationale

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `frontend/app-utils.js` — extended `parseRangeAddress` to handle `B:B`, `B:D` (column ranges) and `3:3`, `2:5` (row ranges); added `OPEN_END` import; added `mode` field to all return values
- `frontend/app.js` — address box Enter handler now uses `range.mode ?? 'cell'` for `selectionMode`
- `playwright_tests/test_address_box.spec.js` — added 5 new tests for full row/column address entry
