# Story 5.5: Integrate Native Tests into Development Workflow

**Epic:** 5 - Native Testing Infrastructure  
**Story ID:** 5.5  
**Status:** done  
**Created:** 2026-02-15

---

## User Story

**As a** developer  
**I want** clear documentation and commands for running native tests  
**So that** all developers can easily run tests before committing

---

## Business Context

Stories 5.1-5.4 established the native testing infrastructure (pyax, pytest, page objects, file dialog tests, keyboard shortcut tests). This story integrates that infrastructure into the development workflow by documenting how to run tests and providing convenient Makefile targets. Developers need to know when to run which tests and how to debug failures.

---

## Acceptance Criteria

**Given** all native tests are working  
**When** I add a "Native Testing" section to README.md  
**Then** the section documents:
- Prerequisites (Python 3.10+, pyax, pytest, accessibility permissions)
- Installation: `pip install pyax[highlight] pytest`
- Enable accessibility: System Preferences → Security & Privacy → Accessibility
- Running tests: `pytest tests/native/ -v`
- Running specific test: `pytest tests/native/test_file_dialogs.py::test_load_button -v`
- Debugging: `pyax tree --app GoSheet` to inspect UI

**When** I create a `Makefile` with test targets  
**Then** `make test-native` runs native tests  
**And** `make test-web` runs Playwright tests  
**And** `make test-all` runs both native and web tests  
**And** `make test` runs unit tests + web tests (fast feedback)

**When** I document "When to Run Which Tests"  
**Then** the docs explain:
- Unit tests (Go): Always run before commit
- Web tests (Playwright): Run for business logic changes
- Native tests (pyax): Run for native feature changes (dialogs, menus, shortcuts)
- All tests: Run before creating PR

**And** (Optional) I evaluate self-hosted macOS runner for CI/CD  
**And** I document findings in README (accessibility permissions challenge)

---

## Technical Approach

- Add "Native Testing" subsection under Testing in README.md
- Create Makefile with PHONY targets for each test type
- Add "When to Run Which Tests" table/section
- Optional: Research GitHub Actions macOS runner + accessibility permissions

---

## Implementation Checklist

- [x] Add Native Testing section to README.md
- [x] Create Makefile with test-native, test-web, test-all, test
- [x] Document When to Run Which Tests
- [x] Optional: CI/CD evaluation note
- [x] Verify documentation is clear and complete

---

## Story Completion Notes

**Implemented:** 2026-02-15

- Added "Native Testing (macOS)" section to README.md with prerequisites, installation, running tests, debugging (pyax tree)
- Created Makefile with: test, test-unit, test-web, test-native, test-all, build, dev
- Added "When to Run Which Tests" table (unit/web/native/all)
- Documented CI/CD note: accessibility permissions challenge, self-hosted runner option

---

## Dev Notes

### Project Structure
- README.md: Add Native Testing section
- Makefile: New file at project root
- tests/native/: Must exist for make test-native (created in Story 5.1)

### References
- [Source: epics.md#Story-5.5]
- [Source: _bmad-output/planning-artifacts/research/technical-macos-native-testing-wails-research-2026-02-15.md]
