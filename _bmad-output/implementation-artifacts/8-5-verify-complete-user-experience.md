# Story 8.5: Verify Complete User Experience

**Epic:** 8 - Welcome Screen & Lifecycle  
**Story:** 8.5  
**Estimated Effort:** 3-5 hours  
**Status:** ready-for-dev  
**Created:** 2026-02-18

---

## Story

As a developer,
I want to verify the complete user experience from launch to quit,
So that users have a polished, reliable application.

---

## Context

**Prerequisites:**
- Epics 3–8 complete (Electron app, file ops, CSV, macOS integration, welcome screen, lifecycle)
- All stories 8.1–8.4 done

**Current State:**
- All features implemented
- Need end-to-end verification before release

**Desired State:**
- Full user journey tested and documented
- All NFRs verified (performance, reliability, compatibility)
- Release-ready checklist complete

**Why This Story:**
Epic 8.4 in epics.md. Final verification that the app meets all requirements and feels native and polished.

---

## Acceptance Criteria

1. **Launch & Welcome (NFR-P1, FR48)**
   - [ ] App launches in <1 second
   - [ ] Welcome screen appears with recent files (or "No recent files")
   - [ ] All three buttons work (Create, Open, Import)

2. **Core Workflow**
   - [ ] Create new spreadsheet and edit cells
   - [ ] Save file with native dialog
   - [ ] Open file later from recent files (welcome + menu)
   - [ ] Import CSV data and export to CSV

3. **macOS Integration**
   - [ ] All menu items work (File, Edit, Help)
   - [ ] All keyboard shortcuts work (Cmd+N/O/S/W/Q, Cmd+X/C/V, etc.)
   - [ ] File associations work (double-click .sheet files)
   - [ ] App feels native and polished (NFR-U1)

4. **Quality Gates**
   - [ ] All 42 Go unit tests pass (NFR-R6)
   - [ ] All Playwright UI tests pass (NFR-R7 - note: Electron mode, not "web mode")
   - [ ] App runs on macOS 11+ (NFR-C1)
   - [ ] App is Universal binary (Intel + Apple Silicon) (NFR-C2)
   - [ ] No data corruption or loss (NFR-R1)
   - [ ] No crashes (NFR-R3, NFR-R4, NFR-S4)

---

## Tasks / Subtasks

- [ ] Task 1: Manual user journey test (AC: #1, #2, #3)
  - [ ] Document test steps and results
  - [ ] Verify launch time with stopwatch or script
  - [ ] Test full flow: launch → create → edit → save → quit → reopen from recent
  - [ ] Test CSV import/export round-trip
  - [ ] Test all menus and shortcuts
  - [ ] Test file association (double-click .sheet)
- [ ] Task 2: Run automated tests (AC: #4)
  - [ ] `go test ./...` - all pass
  - [ ] `npx playwright test` - all pass (Electron)
  - [ ] Document any flaky or skipped tests
- [ ] Task 3: Compatibility verification (AC: #4)
  - [ ] Test on macOS 11+ (or document supported versions)
  - [ ] Verify Universal binary build (Intel + ARM)
- [ ] Task 4: Create release checklist (optional)
  - [ ] Document verification results
  - [ ] List known issues or limitations
  - [ ] Sign-off for release readiness

---

## Technical Requirements

### Test Commands

```bash
go test ./...
npx playwright test
```

### NFR References

- NFR-P1: Launch <1s
- NFR-R1: No data loss
- NFR-R3, R4, S4: No crashes
- NFR-R6: Go tests pass
- NFR-R7: Playwright tests pass (Electron)
- NFR-U1: macOS HIG
- NFR-C1: macOS 11+
- NFR-C2: Universal binary

### Note on NFR-R7

Original epics say "web mode" but project uses Electron. Interpret as: all Playwright tests pass in Electron mode.

---

## Dev Notes

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8] - Story 8.4 (Verify Complete)
- [Source: _bmad-output/planning-artifacts/prd.md] - All FRs/NFRs
- [Source: playwright_tests/] - UI test suite
- [Source: *_test.go] - Go unit tests

### Testing

- This story IS the verification; no additional automated tests required unless gaps found
- Document findings; fix any critical issues before marking done

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled by dev agent)
