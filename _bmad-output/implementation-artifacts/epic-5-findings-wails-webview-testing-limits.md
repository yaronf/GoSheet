# Epic 5 Findings: Wails WebView Testing Limitations

**Date:** 2026-02-15  
**Status:** Critical Discovery  
**Impact:** Epic 5 approach requires revision

## Executive Summary

During implementation of Epic 5 (Native Testing Infrastructure), we discovered a **fundamental architectural limitation** that prevents pyax (macOS Accessibility API) from testing Wails v3 applications effectively.

**Key Finding:** Wails WebView content (HTML/JavaScript UI) is **NOT accessible** via macOS Accessibility API.

## Technical Details

### What Works ✅

1. **App Launch Detection**
   - `pyax.get_application_by_name("GoSheet")` successfully finds the running app
   - Basic app accessibility verified

2. **Native macOS Dialogs** (if we can trigger them)
   - NSOpenPanel / NSSavePanel are accessible as `AXSheet` elements
   - Native dialog buttons are accessible and clickable

### What Doesn't Work ❌

1. **WebView UI Elements**
   - HTML buttons ("Load", "Save", "New") are **invisible** to pyax
   - `app.search_for(lambda e: e["AXRole"] == "AXButton")` returns nothing
   - WebView reports `app["AXWindows"] == []` (no accessible windows)

2. **JavaScript Event Listeners**
   - Keyboard shortcuts defined in `frontend/app.js` don't receive CGEvents
   - `CGEventPost()` sends system-level events that bypass WebView's JavaScript
   - WebView's `addEventListener('keydown')` never fires from CGEvents

3. **AppleScript Control**
   - Requires additional permissions ("System Events" control)
   - Even with permissions, cannot target WebView content
   - Only works for native macOS UI elements

## Root Cause

**Wails Architecture:**
```
┌─────────────────────────────────────┐
│ Native macOS Window                 │  ← Accessible via pyax ✅
│  ┌───────────────────────────────┐  │
│  │ WebKit WebView                │  │  ← NOT accessible via pyax ❌
│  │  - HTML/CSS/JavaScript        │  │
│  │  - Event listeners            │  │
│  │  - DOM elements               │  │
│  └───────────────────────────────┘  │
│                                     │
│ Native Dialogs (NSOpenPanel, etc.)  │  ← Accessible via pyax ✅
└─────────────────────────────────────┘
```

The WebView is a **black box** to the Accessibility API. It's rendered content, not native UI elements.

## What We Tested

### Test Results

| Test | Result | Reason |
|------|--------|--------|
| `test_app_launches` | ✅ PASS | App process is accessible |
| `test_cmd_o_opens_file_dialog` | ❌ FAIL | CGEvent doesn't reach WebView JS |
| `test_cmd_s_opens_save_dialog` | ❌ FAIL | CGEvent doesn't reach WebView JS |
| `test_cmd_n_creates_new_spreadsheet` | ❌ FAIL | CGEvent doesn't reach WebView JS |
| Button finding | ❌ FAIL | HTML buttons not in accessibility tree |

### Isolated Test Runner

✅ **Successfully implemented**: `run_native_tests.sh`
- Creates isolated Python venv
- Installs pyax + pytest
- Runs tests without IDE permissions
- **Security goal achieved**: Cursor doesn't need accessibility permissions

## Implications

### For Epic 5

**Current Status:** 5 stories implemented, but tests cannot verify native functionality

**The Problem:**
- Story 5.3 (File Dialog Tests): Cannot trigger dialogs from tests
- Story 5.4 (Keyboard Shortcut Tests): Cannot send shortcuts to WebView
- Story 5.5 (Workflow Integration): Tests run but don't test anything meaningful

### For Testing Strategy

**What We Already Have (and it works!):**
1. **Playwright tests** (`test.sh`) - Test WebView UI perfectly ✅
   - Can click HTML buttons
   - Can verify JavaScript behavior
   - Can test keyboard shortcuts (they work in Playwright's browser context)

2. **Go unit tests** - Test backend logic ✅

**What We Don't Need:**
- pyax tests for WebView UI (impossible)
- Native automation for HTML buttons (impossible)

## Recommended Path Forward

### Option 1: Minimal Native Tests (Recommended)

**Keep only what pyax CAN test:**
- App launch smoke test ✅
- Native menu testing (if we add native menus in future)
- Native dialog testing (if we can trigger via Go backend calls, not UI)

**Rely on existing Playwright tests for:**
- All WebView UI interactions
- Keyboard shortcuts
- File operations (via mocked native APIs)

### Option 2: Hybrid Approach with Manual Triggers

**Use pyax to verify dialogs appear AFTER manual trigger:**
- Developer manually clicks "Load" in app
- Test verifies NSOpenPanel appeared
- Test interacts with dialog

**Problem:** Not automated, defeats purpose

### Option 3: Add Native Menus

**Implement macOS native menus:**
- File → Open (Cmd+O)
- File → Save (Cmd+S)
- File → New (Cmd+N)

**Then:**
- pyax can find and click menu items
- Menu shortcuts work at OS level (bypass WebView)
- File dialogs become testable

**Trade-off:** Adds complexity to app architecture

## Conclusion

**Epic 5's original goal** (automated native testing with pyax) is **not achievable** for Wails WebView applications without significant architectural changes (like adding native menus).

**Current test coverage is actually excellent:**
- ✅ Playwright tests cover all UI interactions
- ✅ Go unit tests cover backend logic
- ✅ Manual testing verified native file dialogs work

**Recommendation:** 
1. Mark Epic 5 as "Completed with Findings"
2. Keep the isolated test runner infrastructure (it's valuable)
3. Keep one smoke test (`test_app_launches`)
4. Remove tests that try to interact with WebView
5. Update research document with these findings
6. Consider Epic 7 (macOS Integration) for native menus if needed

## Files Created

- ✅ `run_native_tests.sh` - Isolated test runner (KEEP)
- ✅ `tests/native/conftest.py` - pytest fixtures (KEEP, simplify)
- ✅ `tests/native/page_objects/gosheet_app.py` - Page object (KEEP, document limitations)
- ⚠️ `tests/native/test_file_dialogs.py` - File dialog tests (REVISE)
- ⚠️ `tests/native/test_keyboard_shortcuts.py` - Keyboard tests (REVISE)
- ✅ `tests/native/test_smoke.py` - Smoke test (KEEP)
- ✅ `requirements-native-tests.txt` - Dependencies (KEEP)
- ✅ `Makefile` updates - Test targets (KEEP)
- ✅ `README.md` updates - Documentation (UPDATE)

## Lessons Learned

1. **Research limitations matter**: The research noted "WebView testing challenges" but didn't explicitly state WebView content is inaccessible to pyax

2. **Test early**: We should have written one test first to verify the approach before implementing all 5 stories

3. **Wails ≠ Electron**: Electron apps expose more to accessibility APIs; Wails WebView is more isolated

4. **Layered testing works**: Our existing Playwright + Go unit test strategy is actually the right approach

## Next Steps

1. Simplify native tests to only what works (app launch)
2. Update Epic 5 status to "done" with findings documented
3. Update research document with WebView accessibility limitations
4. Consider native menus in future epic if native testing becomes critical
