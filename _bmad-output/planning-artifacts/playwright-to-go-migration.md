# Playwright Test Review: UI vs Go

Generated: 2026-03-13

## Conclusion

All 46 Playwright test files should stay as Playwright tests.

The original framing (can this logic be tested in Go?) was wrong. The right question is:
does this test verify user-visible UI behavior? With that lens, every file has at least one
test that checks DOM attributes, element visibility, CSS properties, cell display, menu state,
modal appearance, toolbar button state, or keyboard interaction. None are purely API-contract
tests that belong in Go.

## Exception: 3 tests that are GO-ONLY by accident

These tests call HTTP API endpoints and check only JSON responses — no DOM/UI assertions.
They should either get UI assertions added (making them proper Playwright tests), or be
deleted and replaced with Go handler tests.

### test_undo_redo.spec.js
- `POST /api/undo returns correct state on empty stack` — checks JSON only
- `POST /api/undo returns canRedo=true after undo` — checks JSON only
- `POST /api/redo re-applies undone edit` — checks JSON only

These 3 hit the undo/redo HTTP endpoints directly. They have no assertions on
cell display or toolbar button state. Either add UI assertions, or move to Go handler tests.

### test_file_dialogs.spec.js
- `can stub open dialog`, `can stub save dialog`, `can test dialog cancellation`
- Verify that dialog stubs return the right values, but don't check UI effects.
- These are testing the test infrastructure, not the app. Consider removing or expanding.

### test_csv_export_debug.spec.js
- `DEBUG: trace cell persistence before CSV export`
- Checks `/api/cells/all` and exported file content, no UI assertion.
- Appears to be a debug/scratch test. Consider removing.

## Original (incorrect) report

The original report attempted to classify tests as "can be Go" based on whether the
underlying logic is testable without a browser. That analysis is preserved in git history
but superseded by this document.
