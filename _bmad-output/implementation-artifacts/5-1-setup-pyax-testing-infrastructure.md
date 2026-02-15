# Story 5.1: Set Up pyax Testing Infrastructure

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to set up pyax and pytest for native macOS testing,
so that I can write automated tests for native features.

## Acceptance Criteria

1. **Given** I have Python 3.10+ installed
   **When** I run `pip install pyax[highlight] pytest`
   **Then** pyax and pytest are installed successfully

2. **When** I enable accessibility in System Preferences → Security & Privacy → Accessibility
   **Then** Terminal.app (or my IDE) is added to allowed apps

3. **When** I run `pyax tree --app Finder`
   **Then** Finder's accessibility tree is displayed (verifies accessibility enabled)

4. **When** I create `tests/native/conftest.py` with basic pytest fixtures
   **Then** the file contains `gosheet_app` fixture that launches the app
   **And** the fixture uses `subprocess.Popen(['./build/GoSheet'])` to start app
   **And** the fixture uses `pyax.get_application_by_name('GoSheet')` to get app reference
   **And** the fixture includes cleanup to terminate app after tests

5. **When** I run `pytest tests/native/ -v`
   **Then** pytest discovers and runs tests in the native directory
   **And** a simple smoke test passes (app launches successfully)

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 2, 3): Install dependencies and verify accessibility
  - [x] Create requirements-native-tests.txt and tests/native/requirements.txt
  - [x] Document accessibility setup in conftest.py docstring
- [x] Task 2 (AC: 4): Create conftest.py with gosheet_app fixture
  - [x] Create tests/native/ directory
  - [x] Implement gosheet_app fixture with subprocess.Popen(['./build/GoSheet'])
  - [x] Add pyax.get_application_by_name('GoSheet') for app reference
  - [x] Add cleanup (proc.terminate) in fixture teardown
- [x] Task 3 (AC: 5): Create smoke test and verify pytest runs
  - [x] Create simple smoke test (test_app_launches)
  - [x] Verify pytest tests/native/ -v discovers and runs tests

## Dev Notes

- **Technical Research Reference**: `_bmad-output/planning-artifacts/research/technical-macos-native-testing-wails-research-2026-02-15.md`
- **App binary location**: `./build/GoSheet` (from project root) - build with `wails3 build` or `go build -o build/GoSheet .`
- **App name for pyax**: "GoSheet" (from wails.json productName)
- **macOS only**: pyax uses macOS Accessibility API - tests run only on macOS
- **Fixture scope**: Use session scope to launch app once per test run (faster)

### Project Structure Notes

- New directory: `tests/native/` (alongside existing `tests/` for Go unit tests)
- GoSheet binary must exist at `./build/GoSheet` before running native tests
- Tests run from project root directory

### References

- [Source: epics.md#Story-5.1]
- [Source: technical-macos-native-testing-wails-research-2026-02-15.md - pyax + pytest integration pattern]

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List

- tests/native/conftest.py - pytest fixtures (gosheet_app, require_accessibility, clean_app, gosheet_page)
- tests/native/test_smoke.py - smoke test (test_app_launches)
- requirements-native-tests.txt - pip dependencies for native tests
- tests/native/page_objects/gosheet_app.py - updated with optional pyax import (for Story 5.2)
