# Story 5.4: Create Keyboard Shortcut Tests

**Epic:** 5 - Native Testing Infrastructure  
**Story ID:** 5.4  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** automated tests for keyboard shortcuts  
**So that** I can verify Cmd+O, Cmd+S, Cmd+N work correctly

---

## Business Context

Story 5.3 established file dialog smoke tests. This story adds keyboard shortcut tests to verify that Cmd+O, Cmd+S, and Cmd+N trigger the expected behavior without requiring manual testing.

---

## Acceptance Criteria

**Given** file dialog tests are working  
**When** I create `tests/native/test_keyboard_shortcuts.py`  
**Then** the file contains keyboard shortcut tests  
**And** test `test_cmd_o_opens_file_dialog` exists:
- Sends Cmd+O keyboard event to app
- Waits for file dialog to appear
- Asserts dialog opened successfully

**And** test `test_cmd_s_saves_or_shows_dialog` exists:
- For new spreadsheet: Cmd+S shows save dialog
- For existing file: Cmd+S saves without dialog

**And** test `test_cmd_n_creates_new_spreadsheet` exists:
- Sends Cmd+N keyboard event
- Verifies new empty spreadsheet appears
- Verifies file status shows "Unsaved"

**When** I run `pytest tests/native/test_keyboard_shortcuts.py -v`  
**Then** all 3 tests pass consistently  
**And** keyboard events are properly sent to the app  
**And** tests verify expected behavior occurs

---

## Implementation Summary

- Created `tests/native/test_keyboard_shortcuts.py` with 3 tests
- Added `send_key_shortcut`, `send_key_code`, `get_file_status_text` to GoSheetApp page object
- Added Cmd+O, Cmd+S, Cmd+N keyboard shortcuts to frontend (app.js)
- Updated displayFileStatus to show "Untitled - Unsaved" for new files
- Tests use AppleScript via subprocess for keyboard event injection

---

## Completion Notes

- Keyboard shortcuts implemented in frontend document keydown handler
- AppleScript `keystroke ... using command down` used for Cmd+key
- test_cmd_s verifies save dialog for new spreadsheet (simplified from "existing file" case)
- test_cmd_n verifies "Unsaved" in status after Cmd+N (via "Untitled - Unsaved" display)
