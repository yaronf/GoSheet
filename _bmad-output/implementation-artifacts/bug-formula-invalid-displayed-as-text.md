# Bug: Invalid formula ("=" + text) displayed as-is instead of error

**Status:** open  
**Related:** Story 13.6 (Bug Fixes)  
**Created:** 2026-03-03

## Description

When a user enters `=` followed by non-formula text (e.g., `=hello`, `=foo`, `=abc123`) in a cell, the value is displayed as-is instead of showing a formula error.

## Expected behavior

- The cell should display a formula error (e.g., `#ERROR` or similar), since the content is not a valid formula.
- If the user wants literal text that starts with `=`, they should quote it (e.g., `'=hello` or `"=hello"`).

## Actual behavior

- The cell displays the raw text (e.g., `=hello`) as if it were valid content.

## Steps to reproduce

1. Select a cell.
2. Enter `=hello` (or any `=` followed by non-formula text).
3. Press Enter.
4. Observe: cell shows `=hello` instead of an error.

## Notes

- Related to Story 13.6 acceptance criteria: "=" alone should be rejected. This bug extends that: `=` + invalid formula text should also result in an error, not be displayed as literal text.
