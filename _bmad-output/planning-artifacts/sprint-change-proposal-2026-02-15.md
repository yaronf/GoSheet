# Sprint Change Proposal - Electron Migration

**Date:** 2026-02-15  
**Project:** GoSheet Native App  
**Change Type:** Major Architectural Pivot  
**Scope:** Technology Stack Replacement  
**Status:** Approved by User

---

## Section 1: Issue Summary

### Problem Statement

During Epic 5 implementation (Native Testing Infrastructure), we discovered a **fundamental architectural limitation** that prevents the current Wails-based approach from achieving automated testing goals:

**Critical Discovery:** pyax (macOS Accessibility API) **cannot access Wails WebView content**

- ❌ HTML buttons, inputs, and UI elements are invisible to accessibility APIs
- ❌ JavaScript event listeners don't receive accessibility events
- ❌ Cannot click buttons, test keyboard shortcuts, or interact with WebView UI
- ❌ Only native macOS UI elements (dialogs, menus) are accessible

### Context

**When discovered:** 2026-02-15, during Story 5.6 (Verify Native Tests Pass)

**How discovered:** 
1. Implemented pyax test infrastructure (Stories 5.1-5.5)
2. Created isolated test runner to avoid IDE accessibility permissions
3. Attempted to run tests - all failed with "Element not found" errors
4. Investigation revealed: `app["AXWindows"] == []` (no accessible windows)
5. Root cause: Wails WebView is a black box to accessibility APIs

**Evidence:**
- Test results: 1 passed (app launches), 7 failed (cannot find UI elements)
- Research confirmed: WebView content not exposed to macOS Accessibility API
- Comprehensive analysis documented in:
  - `epic-5-findings-wails-webview-testing-limits.md`
  - `electron-migration-analysis.md`

### Impact

**Without automated testing:**
- Manual testing required for every change (not sustainable)
- Epic 4 had 4 bugs discovered only during manual testing
- "Done" means untested (repeating Epic 4 mistake)
- Cannot verify native features work correctly

**User's explicit decision:**
> "I don't want to grant Cursor accessibility permissions. I want it to be limited to this test framework."
> 
> "I'm OK using non-native dialogs. It's not ideal but would be worth it for testability."

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Status | Impact | Action Required |
|------|--------|--------|-----------------|
| Epic 1: API Abstraction | Done | ✅ No impact | None - interfaces remain valid |
| Epic 2: Web Mode | Done | ❌ Obsolete | Mark as obsolete, document migration |
| Epic 3: Native App Foundation | Done | ❌ Replace | Complete rewrite for Electron |
| Epic 4: Native File Operations | Done | ⚠️ Adapt | Backend reusable, frontend needs IPC updates |
| Epic 5: Native Testing | In-progress | ❌ Replace | Complete rewrite for Playwright Electron |
| Epic 6: CSV Import/Export | Backlog | ✅ Minimal | Backend unchanged |
| Epic 7: macOS Integration | Backlog | ⚠️ Enhance | Electron menus easier than Wails |
| Epic 8: Welcome Screen | Backlog | ✅ Minimal | UI code unchanged |

### Story Impact

**Completed Stories:**
- **Epic 1 (4 stories)**: ✅ Fully reusable - API abstraction works with any framework
- **Epic 2 (5 stories)**: ⚠️ Obsolete but reusable - HTTP server becomes embedded server
- **Epic 3 (7 stories)**: ❌ Obsolete - Wails-specific code replaced with Electron
- **Epic 4 (8 stories)**: ⚠️ Backend 100% reusable, frontend needs ~2 hours of IPC updates
- **Epic 5 (5 stories)**: ❌ Obsolete - pyax approach replaced with Playwright Electron

**Total Story Impact:**
- ✅ Fully reusable: 12 stories (Epic 1 + Epic 4 backend)
- ⚠️ Partially reusable: 5 stories (Epic 2 - HTTP server reused)
- ❌ Obsolete: 12 stories (Epic 3 + Epic 5)
- **Reusability: 59% of completed work preserved**

### Artifact Conflicts

**1. PRD (`prd.md`)**
- Lines 17-21: Key insights mention "Wails v3" and "dual-mode" → needs update
- Line 35: "using Wails v3" → change to "using Electron"
- Line 39: "dual-mode architecture" → change to "single-mode Electron"
- Testing strategy section → remove pyax, emphasize Playwright

**2. Architecture (`architecture.md`)**
- Lines 69-94: Technology stack lists Wails constraints → replace with Electron
- "Dual-Mode Architecture" section → complete replacement with "Electron Architecture"
- "Wails v3 Integration" section → replace with "Electron + Embedded Go Server"
- Build system strategy → remove build tags discussion
- IPC layer design → update from Wails IPC to Electron IPC

**3. Epics (`epics.md`)**
- Epic 2 definition → mark as obsolete with migration notes
- Epic 3 definition → complete rewrite for Electron (7 new stories)
- Epic 4 definition → add adaptation notes (backend reusable, frontend updates)
- Epic 5 definition → complete rewrite for Playwright Electron (6 new stories)
- Story counts and effort estimates → update totals

**4. Sprint Status (`sprint-status.yaml`)**
- Epic 5 status: `in-progress` → needs reset to `backlog` (wrong approach)
- Stories 5.1-5.5: `done` → mark as obsolete
- Story 5.6: `backlog` → remains backlog under new approach

### Technical Impact

**Code Changes:**

| Category | Lines | Status |
|----------|-------|--------|
| **Remove** | -1,100 | Wails code + web mode server |
| **Add** | +400 | Electron main + preload + IPC |
| **Unchanged** | 5,400+ | Go backend (100% reusable) |
| **Minor updates** | ~50 | Frontend IPC calls |
| **Net change** | **-700** | Simpler codebase |

**Effort Estimate:**
- Planning updates: 4-6 hours
- Epic 3 implementation (Electron setup): 4 days
- Epic 4 adaptation (frontend IPC): 2 hours
- Epic 5 implementation (Playwright tests): 3 days
- **Total: ~8 days implementation**

**Risk Assessment:**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Electron learning curve | Medium | Low | Excellent docs, large community |
| Dialog behavior differences | Low | Low | User accepted non-native dialogs |
| Build/packaging issues | Medium | Medium | electron-builder is battle-tested |
| Test migration complexity | Low | Low | Playwright Electron API straightforward |
| Go server integration | Low | Low | HTTP server already working |

---

## Section 3: Recommended Approach

### Strategic Replan (Approved)

**Decision:** Migrate from Wails to Electron with embedded Go HTTP server

**Rationale:**

1. **Testability is Critical**
   - Current approach (pyax + Wails) fundamentally broken
   - Cannot test WebView UI elements at all
   - Manual testing not sustainable (Epic 4 had 4 bugs)
   - Playwright + Electron solves this completely

2. **Most Work is Preserved**
   - 100% of Go backend reusable (5,400+ lines)
   - HTTP server reused as embedded server
   - 59% of completed stories preserved
   - Only Wails-specific code needs replacement

3. **Simpler Architecture**
   - Single-mode (no dual-mode complexity)
   - Net -700 lines of code
   - No build tags needed
   - Clearer architecture

4. **Better Long-term Position**
   - Cross-platform ready (Windows, Linux)
   - Larger ecosystem and community
   - Better tooling and documentation
   - More stable (Electron vs Wails alpha)

### Alternative Approaches Considered

**Option 1: Continue with Wails + Manual Testing**
- ❌ Rejected: Manual testing not sustainable
- ❌ Repeats Epic 4 mistake (no testing before "done")
- ❌ User explicitly wants automated testing

**Option 2: Add Native Menus to Make pyax Work**
- ⚠️ Possible but complex: Native menus are accessible to pyax
- ⚠️ Still can't test HTML UI elements
- ⚠️ Adds architectural complexity
- ⚠️ Deferred to Epic 7 if needed

**Option 3: Rollback Everything and Start Over**
- ❌ Rejected: Wasteful - 59% of work is reusable
- ❌ Go backend is excellent and unchanged
- ❌ Forward progress better than starting over

### Implementation Path

**Phase 1: Update Planning Artifacts** (4-6 hours)
1. Update PRD technology stack
2. Rewrite Architecture document (Electron section)
3. Revise Epics 2, 3, 4, 5
4. Update sprint status

**Phase 2: Implement Electron Foundation** (4 days - Epic 3)
1. Create Electron main process
2. Create preload script (IPC bridge)
3. Integrate Go HTTP server as child
4. Implement Electron file dialogs
5. Update frontend IPC calls
6. Configure electron-builder
7. Verify app launches

**Phase 3: Adapt File Operations** (2 hours - Epic 4)
1. Update frontend dialog triggers
2. Test all file operations
3. Verify backend unchanged

**Phase 4: Implement Playwright Testing** (3 days - Epic 5)
1. Set up Playwright Electron environment
2. Port existing 30+ tests to Electron API
3. Implement dialog stubbing
4. Create file operation tests
5. Verify all tests pass
6. Update CI/CD

**Total Timeline: ~8 days**

---

## Section 4: Detailed Change Proposals

### PRD Changes

**File:** `_bmad-output/planning-artifacts/prd.md`

**Change 1: Key Insights (lines 17-21)**

OLD:
```yaml
keyInsights:
  - 'Dual-mode architecture: web for testing, native for users'
  - 'Web mode is test harness only, not deployment target'
  - 'Native app is sole user-facing product'
  - 'Wails v3 for native macOS wrapper'
  - 'Maintain Playwright test infrastructure'
```

NEW:
```yaml
keyInsights:
  - 'Electron desktop app with embedded Go HTTP server'
  - 'Single-mode architecture (no separate web mode)'
  - 'Playwright native Electron testing (no pyax)'
  - 'Cross-platform ready (macOS, Windows, Linux)'
  - 'Simplified codebase (-700 lines vs dual-mode)'
```

**Change 2: Project Context (line 35)**

OLD:
```
**Project Context:** Brownfield architectural migration of existing web-based 
spreadsheet application to native macOS desktop app using Wails v3.
```

NEW:
```
**Project Context:** Brownfield architectural migration of existing web-based 
spreadsheet application to desktop app using Electron with embedded Go backend.
```

**Change 3: Solution Statement (line 39)**

OLD:
```
**Solution:** Convert to native macOS app using Wails v3 wrapper while 
maintaining dual-mode architecture (native for users, web mode for Playwright testing).
```

NEW:
```
**Solution:** Convert to Electron desktop app with embedded Go HTTP server. 
Single-mode architecture with Playwright native Electron testing for full UI automation.
```

---

### Architecture Changes

**File:** `_bmad-output/planning-artifacts/architecture.md`

**Change 1: Technology Stack (lines 69-94)**

OLD:
```markdown
**Hard Constraints:**
- **Wails v3.0.0-alpha.67**: Specific version chosen for macOS stability
- **macOS 11+ (Big Sur)**: Minimum OS version, spans WebKit 611-619+
- **Universal binary**: Must support both Intel and Apple Silicon

**Technology Stack (Existing):**
- **Backend**: Go 1.x with participle parser, gob serialization
- **Frontend**: Vanilla HTML/CSS/JavaScript (no build tools)
- **Testing**: Go unit tests + Playwright (Python)
- **HTTP Server**: Go net/http (for web mode)

**Dependencies:**
- Wails v3.0.0-alpha.67 (alpha stability risk)
- macOS WebKit (system webview, no Chromium)
- Go build tags for mode separation
```

NEW:
```markdown
**Hard Constraints:**
- **Electron 28+**: Mature desktop framework with native Playwright support
- **macOS 11+ (Big Sur)**: Minimum OS version, Chromium-based rendering
- **Universal binary**: Must support both Intel and Apple Silicon
- **Node.js 18+**: Required for Electron main process

**Technology Stack:**
- **Desktop Framework**: Electron 28+ (main process: Node.js, renderer: Chromium)
- **Backend**: Go 1.x with participle parser, gob serialization (embedded HTTP server)
- **Frontend**: Vanilla HTML/CSS/JavaScript (no build tools)
- **Testing**: Go unit tests + Playwright Electron (native integration)
- **IPC**: Electron IPC (contextBridge + ipcRenderer/ipcMain)

**Dependencies:**
- Electron 28+ (stable, mature ecosystem)
- Chromium (embedded in Electron, consistent across platforms)
- electron-builder (packaging and distribution)
- electron-playwright-helpers (dialog stubbing for tests)
```

**Change 2: Replace "Dual-Mode Architecture" Section**

REMOVE ENTIRE SECTION:
```markdown
### Decision 1: Dual-Mode Architecture (Build Tag Strategy)
[... extensive section about build tags, mode separation, etc ...]
```

ADD NEW SECTION:
```markdown
### Decision 1: Electron Desktop Architecture (Embedded Go Server)

**Decision:** Implement Electron desktop app with embedded Go HTTP server as 
child process. Single-mode architecture with Playwright native Electron testing.

**Context:**
- Original plan: Wails v3 dual-mode (web for testing, native for users)
- Discovery: pyax cannot test Wails WebView content (HTML/JS invisible to accessibility API)
- Pivot: Electron + Playwright native integration solves testability completely

**Architecture:**

```
┌─────────────────────────────────────┐
│ Electron Main Process (Node.js)    │
│  - Launch Go HTTP server (child)   │
│  - Create BrowserWindow             │
│  - Handle native dialogs via IPC   │
│  - Package as .app/.exe bundle      │
└─────────────────────────────────────┘
         ↓ IPC (file dialogs)
         ↓ HTTP (spreadsheet API)
┌─────────────────────────────────────┐
│ Electron Renderer (Chromium)        │
│  - Load frontend/index.html         │
│  - Fetch to localhost:PORT          │
│  - Send IPC for file dialogs        │
└─────────────────────────────────────┘
         ↓ HTTP
┌─────────────────────────────────────┐
│ Go HTTP Server (embedded)           │
│  - controller.AppController         │
│  - All backend logic (unchanged)    │
│  - REST API (unchanged)             │
└─────────────────────────────────────┘
```

**Benefits:**
- ✅ **Testability:** Playwright native Electron support (official API, dialog stubbing)
- ✅ **Simplicity:** Single codebase, no build tags, -700 lines of code
- ✅ **Reusability:** 100% of Go backend unchanged, existing HTTP server reused
- ✅ **Cross-platform:** Windows/Linux ready (Wails was macOS-only in our impl)
- ✅ **Ecosystem:** Larger community, better tooling, more examples

**Trade-offs:**
- ❌ Non-native dialogs (Electron dialogs vs NSOpenPanel) - acceptable per user
- ❌ Need Node.js (adds JavaScript to build) - minimal impact
- ✅ Net positive: testability gains outweigh native dialog loss

**Implementation:**
- Electron main process: ~200 lines (launch Go server, create window, IPC handlers)
- Preload script: ~50 lines (secure IPC bridge)
- Frontend updates: ~50 lines (Electron IPC instead of fetch for dialogs)
- Remove: ~1,100 lines (Wails code + web mode server)
- **Net: -700 lines**
```

---

### Epic Changes

**File:** `_bmad-output/planning-artifacts/epics.md`

**Change 1: Epic 2 - Mark as Obsolete**

ADD TO EPIC 2:
```markdown
## Epic 2: Web Mode Preservation [OBSOLETE - Replaced by Electron]

**Status:** OBSOLETE as of 2026-02-15  
**Reason:** Electron architecture eliminates need for separate web mode. 
Playwright tests run natively against Electron app.

**Original Goal:** Maintain web mode as test harness for Playwright UI tests

**Migration:** 
- HTTP server code reused as embedded server in Electron
- Playwright tests migrated to Electron API (Epic 5)
- All 5 stories' work preserved in new architecture

**Stories (completed but obsolete):**
- 2.1-2.5: Code reused in Electron embedded server
```

**Change 2: Epic 3 - Complete Rewrite**

REPLACE EPIC 3 WITH:
```markdown
## Epic 3: Electron Desktop App [REVISED - Replaces Wails Implementation]

**Status:** REVISED as of 2026-02-15 (original Wails work obsolete)  
**Reason:** Electron provides better testability via Playwright native integration

**Goal:** Create Electron desktop app with embedded Go HTTP server

**User Outcome:** Users can launch GoSheet as desktop app with native-like dialogs

**Architecture Benefits:**
- ✅ Playwright native Electron support (no pyax hacks)
- ✅ Simpler codebase (-700 lines vs dual-mode)
- ✅ Cross-platform ready (Windows, Linux, macOS)
- ✅ 100% Go backend reused (no changes needed)

**Stories (NEW):**

### Story 3.1: Create Electron Main Process
**Effort:** 4 hours (~200 lines)
**Goal:** Set up Electron application entry point

**Tasks:**
- Create `electron/main.js` with app lifecycle
- Implement Go server spawn as child process
- Create BrowserWindow with proper configuration
- Handle app quit and cleanup
- Port management for Go server

**Acceptance Criteria:**
- Electron app launches successfully
- Go server starts as child process
- Window displays with correct dimensions
- App quits cleanly (kills Go server)

### Story 3.2: Create Electron Preload Script
**Effort:** 2 hours (~50 lines)
**Goal:** Secure IPC bridge between renderer and main

**Tasks:**
- Create `electron/preload.js` with contextBridge
- Expose file dialog APIs to renderer
- Implement secure IPC communication
- Document API surface for frontend

**Acceptance Criteria:**
- `window.electronAPI` available in renderer
- `openFileDialog()` and `saveFileDialog()` exposed
- Context isolation maintained
- No Node.js APIs leaked to renderer

### Story 3.3: Integrate Go HTTP Server
**Effort:** 2 hours (~50 lines)
**Goal:** Embed existing Go HTTP server in Electron

**Tasks:**
- Spawn Go server binary from Electron main
- Handle server startup and readiness
- Implement port management (dynamic or fixed)
- Handle server lifecycle (start, stop, restart)
- Log server output for debugging

**Acceptance Criteria:**
- Go server starts when Electron launches
- Server runs on consistent port
- Renderer can fetch from localhost
- Server stops when Electron quits

### Story 3.4: Implement Electron File Dialogs
**Effort:** 4 hours (~100 lines)
**Goal:** Native-like file dialogs via Electron

**Tasks:**
- Implement IPC handler for `dialog:openFile`
- Implement IPC handler for `dialog:saveFile`
- Configure file filters (.sheet extension)
- Handle dialog cancellation
- Return file paths to renderer

**Acceptance Criteria:**
- Open dialog shows and returns file path
- Save dialog shows with default filename
- File filters work (.sheet files)
- Cancel returns null (no error)
- Dialogs are modal to main window

### Story 3.5: Update Frontend for Electron IPC
**Effort:** 2 hours (~50 lines)
**Goal:** Replace Wails IPC with Electron IPC

**Tasks:**
- Update `frontend/api-client.js` to use `window.electronAPI`
- Remove Wails binding detection
- Keep HTTP API for spreadsheet operations
- Add fallback for browser development mode
- Update file operation flows

**Acceptance Criteria:**
- File dialogs triggered via Electron IPC
- Spreadsheet operations use HTTP API
- No Wails code remains
- Works in Electron app
- Graceful fallback in browser (for dev)

### Story 3.6: Configure electron-builder
**Effort:** 2 hours (~50 lines)
**Goal:** Package Electron app for distribution

**Tasks:**
- Create `package.json` with Electron dependencies
- Configure electron-builder for macOS
- Include Go server binary in package
- Set up .app bundle structure
- Configure code signing (if applicable)

**Acceptance Criteria:**
- `npm run build` creates .app bundle
- Go server binary included in package
- App launches from packaged .app
- Universal binary (Intel + Apple Silicon)
- Proper app metadata (name, version, icon)

### Story 3.7: Verify Electron App Launches
**Effort:** 2 hours (testing)
**Goal:** End-to-end verification of Electron app

**Tasks:**
- Launch Electron app from package
- Verify Go server starts
- Verify UI loads and displays grid
- Test file dialogs (open, save)
- Test basic spreadsheet operations
- Verify app quits cleanly

**Acceptance Criteria:**
- App launches in <1 second
- UI displays correctly
- File dialogs work
- Can enter data and formulas
- Can save and load files
- No console errors
- App quits without hanging

**Total Effort:** ~18 hours (2-3 days)
```

**Change 3: Epic 4 - Add Adaptation Notes**

ADD TO EPIC 4 (before stories):
```markdown
## Epic 4: Native File Operations [ADAPTED - Backend Reused, Frontend Updated]

**Status:** ADAPTED as of 2026-02-15  
**Backend Status:** ✅ 100% reusable (no changes needed)  
**Frontend Status:** ⚠️ Needs Electron IPC updates

**What's Reusable:**
- ✅ All Go backend code (controller methods, file I/O logic)
- ✅ File status tracking logic
- ✅ Unsaved changes detection
- ✅ Save/Open/SaveAs workflows

**What Needs Updating:**
- ⚠️ Frontend: Replace Wails IPC calls with Electron IPC (done in Story 3.5)
- ⚠️ Dialog triggering: Use window.electronAPI instead of Wails bindings

**Adaptation Status:**
- Stories 4.1-4.8: Backend code 100% reusable
- Frontend IPC updates: Covered by Story 3.5
- **Additional effort: 0 hours** (handled by Epic 3)
```

**Change 4: Epic 5 - Complete Rewrite**

REPLACE EPIC 5 WITH:
```markdown
## Epic 5: Playwright Electron Testing [REPLACED - pyax → Playwright]

**Status:** REPLACED as of 2026-02-15  
**Reason:** Discovery - pyax cannot test Wails WebView content (HTML/JS invisible to accessibility API)

**Critical Finding:**
- ❌ pyax can see native macOS windows but NOT WebView content
- ❌ HTML buttons, JavaScript events invisible to accessibility API
- ❌ Cannot click buttons, cannot test keyboard shortcuts in WebView
- ✅ Playwright has native Electron support (official API)

**Goal:** Automated Electron app testing using Playwright native integration

**User Outcome:** Developers can run automated UI tests against Electron app with full coverage

**Architecture Benefits:**
- ✅ Playwright `_electron` API (first-class support)
- ✅ Dialog stubbing via electron-playwright-helpers
- ✅ Can test all UI elements (buttons, inputs, everything)
- ✅ Can test keyboard shortcuts
- ✅ Can test IPC communication
- ✅ CI/CD friendly (headless mode, no accessibility permissions)

**Stories (NEW):**

### Story 5.1: Set Up Playwright Electron Environment
**Effort:** 2 hours
**Goal:** Configure Playwright for Electron testing

**Tasks:**
- Install @playwright/test
- Install electron-playwright-helpers
- Create test configuration
- Set up test fixtures for Electron app
- Document test execution

**Acceptance Criteria:**
- Playwright can launch Electron app
- Test fixtures available
- Can run basic smoke test
- Documentation updated

### Story 5.2: Port Existing Playwright Tests to Electron API
**Effort:** 8 hours
**Goal:** Migrate 30+ browser tests to Electron

**Tasks:**
- Update test imports (_electron API)
- Replace page.goto with electronApp.firstWindow()
- Update selectors if needed
- Verify all assertions work
- Run full test suite

**Acceptance Criteria:**
- All 30+ tests ported
- All tests pass
- No browser-specific code remains
- Test coverage maintained

### Story 5.3: Implement Dialog Stubbing Tests
**Effort:** 4 hours
**Goal:** Test file dialogs with stubbing

**Tasks:**
- Stub showOpenDialog with test paths
- Stub showSaveDialog with test paths
- Test dialog cancellation
- Verify file operations with stubbed dialogs

**Acceptance Criteria:**
- Can stub open dialog
- Can stub save dialog
- Can test cancellation
- File operations work with stubs

### Story 5.4: Create File Operation Tests
**Effort:** 4 hours
**Goal:** End-to-end file operation testing

**Tasks:**
- Test New spreadsheet workflow
- Test Open file workflow
- Test Save file workflow
- Test Save As workflow
- Test file status tracking
- Test unsaved changes warnings

**Acceptance Criteria:**
- All file operations tested
- Status tracking verified
- Warnings tested
- Edge cases covered

### Story 5.5: Verify All Tests Pass in Electron
**Effort:** 4 hours
**Goal:** Full test suite verification

**Tasks:**
- Run complete test suite
- Fix Electron-specific issues
- Verify test coverage
- Document any limitations
- Update test documentation

**Acceptance Criteria:**
- All tests pass
- Coverage maintained
- No flaky tests
- Documentation updated

### Story 5.6: Update CI/CD for Electron Testing
**Effort:** 2 hours
**Goal:** Automate test execution

**Tasks:**
- Update test scripts in package.json
- Configure GitHub Actions (if applicable)
- Document test execution for team
- Set up test reporting

**Acceptance Criteria:**
- `npm test` runs Electron tests
- CI/CD configured (if applicable)
- Team documentation updated
- Test reports available

**Total Effort:** ~24 hours (3 days)

**Previous Work Status:**
- Stories 5.1-5.5 (pyax): Obsolete, replaced by Playwright approach
- Isolated test runner infrastructure: Reusable concept, different implementation
```

---

### Sprint Status Changes

**File:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Changes:**

```yaml
# Epic 2: Web Mode Preservation [OBSOLETE]
epic-2: obsolete  # Was: done
epic-2-obsolete-reason: "Electron eliminates need for separate web mode"
epic-2-migration: "HTTP server reused as embedded server in Electron"

# Epic 3: Electron Desktop App [REVISED]
epic-3: backlog  # Was: done (Wails implementation obsolete)
epic-3-status-note: "Wails implementation complete but obsolete - replaced with Electron"
3-1-create-electron-main-process: backlog  # NEW
3-2-create-electron-preload-script: backlog  # NEW
3-3-integrate-go-http-server: backlog  # NEW
3-4-implement-electron-file-dialogs: backlog  # NEW
3-5-update-frontend-for-electron-ipc: backlog  # NEW
3-6-configure-electron-builder: backlog  # NEW
3-7-verify-electron-app-launches: backlog  # NEW

# Epic 4: Native File Operations [ADAPTED]
epic-4: done  # Backend complete, frontend adapted in Epic 3
epic-4-status-note: "Backend 100% reusable, frontend IPC updates in Story 3.5"

# Epic 5: Playwright Electron Testing [REPLACED]
epic-5: backlog  # Was: in-progress (pyax approach obsolete)
epic-5-status-note: "pyax implementation obsolete - replaced with Playwright Electron"
5-1-setup-playwright-electron-environment: backlog  # NEW
5-2-port-existing-playwright-tests-to-electron: backlog  # NEW
5-3-implement-dialog-stubbing-tests: backlog  # NEW
5-4-create-file-operation-tests: backlog  # NEW
5-5-verify-all-tests-pass-in-electron: backlog  # NEW
5-6-update-cicd-for-electron-testing: backlog  # NEW
```

---

## Section 5: Implementation Handoff

### Change Scope Classification

**Classification: MAJOR**

This change requires:
- ✅ Fundamental technology stack replacement
- ✅ Multiple epics affected (2, 3, 4, 5)
- ✅ Architecture document significant updates
- ✅ PRD technology choice revision
- ✅ PM/Architect involvement for replan

### Handoff Recipients

**Primary:** Product Manager (John) + Solution Architect (Winston)

**Responsibilities:**

1. **Product Manager (John):**
   - Review and approve PRD changes
   - Validate that Electron meets product requirements
   - Approve non-native dialogs trade-off
   - Update stakeholder communications

2. **Solution Architect (Winston):**
   - Review and approve Architecture changes
   - Validate Electron architecture design
   - Ensure technical feasibility
   - Update technical documentation

3. **Scrum Master (Bob):**
   - Update sprint status
   - Generate new sprint plan for Electron implementation
   - Coordinate Epic 3 and Epic 5 story creation
   - Track progress through implementation

4. **Development Team:**
   - Implement Epic 3 stories (Electron setup)
   - Adapt Epic 4 frontend (IPC updates)
   - Implement Epic 5 stories (Playwright tests)
   - Verify all tests pass

### Success Criteria

**Planning Phase Complete When:**
- ✅ PRD updated with Electron technology choice
- ✅ Architecture document rewritten with Electron section
- ✅ Epics 2, 3, 4, 5 revised in epics.md
- ✅ Sprint status updated
- ✅ New sprint plan generated
- ✅ Implementation readiness check passed

**Implementation Phase Complete When:**
- ✅ Electron app launches and displays grid
- ✅ File dialogs work (open, save, save as)
- ✅ All file operations functional
- ✅ All Playwright tests ported and passing
- ✅ Test coverage maintained (30+ UI tests)
- ✅ Documentation updated
- ✅ App packaged and distributable

### Next Steps

**Immediate (Today):**
1. Review and approve this Sprint Change Proposal
2. Run `/bmad-bmm-create-architecture` (Edit Mode) to update Architecture
3. Run `/bmad-bmm-create-epics-and-stories` (Edit Mode) to revise Epics

**This Week:**
4. Run `/bmad-bmm-check-implementation-readiness` to verify alignment
5. Run `/bmad-bmm-sprint-planning` to generate new sprint plan
6. Begin Epic 3 implementation (Electron setup)

**Next Week:**
7. Complete Epic 3 (Electron foundation)
8. Adapt Epic 4 (frontend IPC)
9. Begin Epic 5 (Playwright tests)

**Timeline:** ~8 days implementation (2 weeks calendar time)

---

## Appendices

### Appendix A: Research Documents

1. **Epic 5 Findings:** `epic-5-findings-wails-webview-testing-limits.md`
   - Documents pyax limitation discovery
   - Explains WebView accessibility architecture
   - Recommends path forward

2. **Electron Migration Analysis:** `electron-migration-analysis.md`
   - Comprehensive Electron vs Wails comparison
   - Testability deep dive
   - Implementation plan with code examples
   - Trade-offs analysis

### Appendix B: Code Reusability Matrix

| Component | Lines | Reusable? | Action |
|-----------|-------|-----------|--------|
| Go backend (model, controller) | 5,400+ | ✅ 100% | None |
| HTTP server | 304 | ✅ 100% | Embed in Electron |
| Frontend UI (HTML/CSS/JS) | ~500 | ✅ 95% | Minor IPC updates |
| Wails IPC layer | 382 | ❌ 0% | Replace with Electron |
| Web mode server | 304 | ⚠️ 50% | Reuse as embedded |
| pyax tests | 200 | ❌ 0% | Replace with Playwright |
| **Total** | **7,090** | **82%** | **-700 net lines** |

### Appendix C: Risk Mitigation Plan

**Risk 1: Electron Learning Curve**
- Mitigation: Excellent documentation, large community
- Fallback: Hire Electron consultant if needed
- Probability: Medium, Impact: Low

**Risk 2: Dialog Behavior Differences**
- Mitigation: User explicitly accepted non-native dialogs
- Fallback: Can implement native menus in Epic 7 if needed
- Probability: Low, Impact: Low

**Risk 3: Build/Packaging Issues**
- Mitigation: electron-builder is battle-tested, well-documented
- Fallback: Manual packaging if electron-builder fails
- Probability: Medium, Impact: Medium

**Risk 4: Test Migration Complexity**
- Mitigation: Playwright Electron API is straightforward
- Fallback: Keep some manual testing if automation difficult
- Probability: Low, Impact: Low

**Risk 5: Go Server Integration**
- Mitigation: HTTP server already working, just needs spawn logic
- Fallback: Use separate process if embedding fails
- Probability: Low, Impact: Low

---

## Approval

**Prepared by:** Bob (Scrum Master)  
**Date:** 2026-02-15  
**Status:** ✅ Approved by User (Yaron)

**Approval Notes:**
- User explicitly chose Electron over Wails for testability
- User accepted non-native dialogs trade-off
- User wants to eliminate manual testing
- User approved incremental change proposals

**Next Action:** Update Architecture document (Edit Mode)

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-15  
**Change Proposal ID:** SCP-2026-02-15-ELECTRON
