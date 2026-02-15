# Story 5.2: Implement Page Object Pattern

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a page object class for GoSheet UI interactions,
so that tests are maintainable and element discovery is reusable.

## Acceptance Criteria

1. **Given** pyax is installed and working
   **When** I create `tests/native/page_objects/gosheet_app.py`
   **Then** the file contains a `GoSheetApp` class

2. **And** the class has `__init__(self)` that gets app via pyax

3. **And** the class has `find_button(self, title)` method
   **And** `find_button` uses `app.search_for(lambda e: e["AXRole"] == "AXButton" and e["AXTitle"] == title)`

4. **And** the class has `wait_for_element(self, predicate, timeout=5)` method
   **And** `wait_for_element` implements retry logic with timeout

5. **And** the class has `wait_for_file_dialog(self, timeout=3)` method
   **And** `wait_for_file_dialog` searches for `AXRole == "AXSheet"` (NSOpenPanel/NSSavePanel)

6. **And** the class has `click_button(self, title)` convenience method

7. **When** I use `GoSheetApp` in a test
   **Then** element discovery is simple: `app.click_button("Load")`
   **And** tests don't contain low-level pyax calls
   **And** UI changes only require updating the page object class

## Tasks / Subtasks

- [x] Task 1 (AC: 1-2): Create GoSheetApp class with __init__
  - [ ] Create tests/native/page_objects/ directory
  - [ ] Implement __init__ that gets app via pyax.get_application_by_name
- [x] Task 2 (AC: 3, 6): Implement find_button and click_button
  - [x] find_button with search_for and retry logic
  - [x] click_button convenience method
- [x] Task 3 (AC: 4): Implement wait_for_element
  - [x] Generic predicate-based waiter with timeout
  - [x] Retry logic (poll every 0.1s)
- [x] Task 4 (AC: 5): Implement wait_for_file_dialog
  - [x] Search for AXSheet role
- [x] Task 5 (AC: 7): Create smoke test using GoSheetApp
  - [x] Verify tests use page object, not raw pyax

## Dev Notes

- **Depends on**: Story 5.1 (conftest.py with gosheet_app fixture)
- **Technical Research Reference**: `_bmad-output/planning-artifacts/research/technical-macos-native-testing-wails-research-2026-02-15.md`
- **Button titles in GoSheet**: New, Save, Load (from frontend/app.js)
- **File dialog**: NSOpenPanel/NSSavePanel use AXRole "AXSheet"

### References

- [Source: epics.md#Story-5.2]
- [Source: technical-macos-native-testing-wails-research-2026-02-15.md - Page Object Pattern]

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List

- tests/native/page_objects/gosheet_app.py (GoSheetApp class)
- tests/native/page_objects/__init__.py
- tests/native/conftest.py (gosheet_page fixture added)
- tests/native/test_smoke.py (updated with page object tests)
- requirements-native.txt (pyax, pytest)

### Completion Notes

- GoSheetApp implements __init__, find_button, wait_for_element, wait_for_file_dialog, click_button
- find_button uses wait_for_element with AXButton and AXTitle predicate
- wait_for_file_dialog searches for AXRole == "AXSheet". Returns None on timeout
- Tests use gosheet_page fixture; no raw pyax calls in test code
