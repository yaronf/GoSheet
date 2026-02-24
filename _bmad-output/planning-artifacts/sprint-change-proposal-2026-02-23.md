# Sprint Change Proposal: Electron Upgrade vs Story 10.9 Scope

**Date:** 2026-02-23  
**Trigger:** User question during Story 10.9 (Universal macOS Build)  
**Scope:** Minor (story scope decision)

---

## 1. Issue Summary

**Question:** Should the Electron upgrade (TECHNICAL-DEBT #1) be folded into Story 10.9 (Implement Universal macOS Build)?

**Context:**
- **Story 10.9** delivers universal macOS binary (Intel + Apple Silicon) via Go cross-compilation and electron-builder config
- **TECHNICAL-DEBT #1** documents need to upgrade from Electron 30.5.1 (EOL) to a supported version (38.x/39/40) while keeping Playwright operational
- Both touch `package.json`, build scripts, and the Electron app

**Evidence:**
- Electron 30.5.1 is EOL; security and compatibility concerns
- Story 5.1 previously downgraded from Electron 40 due to CDP timeouts with Playwright
- 10.9 estimated 2–3 hours; Electron upgrade estimated 2–4 hours

---

## 2. Impact Analysis

### Epic Impact
- **Epic 10 (Code Quality & Technical Debt):** Both items belong here
- No other epics affected

### Story Impact
- **10.9:** Would expand scope if Electron upgrade is folded in
- **Future:** Electron upgrade could be a separate story (e.g. 10.9b or new story)

### Technical Impact
- **10.9:** Go cross-compilation + electron-builder `extraResources` + mac target arch
- **Electron upgrade:** `package.json` devDependencies, Playwright version, CDP compatibility
- **Overlap:** Both modify `package.json` and build flow
- **Isolation:** 10.9 does not depend on Electron version; universal build works with 30.5.1

### Risk Assessment
| Approach | Effort | Risk | Debugging |
|----------|--------|------|-----------|
| **Keep separate** | 2–3h (10.9) + 2–4h (later) | Low | Clear cause if something breaks |
| **Fold into 10.9** | 4–7h combined | Medium | Hard to tell if failure is universal build or Electron upgrade |

---

## 3. Recommended Approach

**Recommendation: Do NOT fold. Keep Story 10.9 and Electron upgrade as separate work.**

### Rationale

1. **Different concerns**
   - 10.9: Universal binary (Go cross-compilation, extraResources, mac target)
   - Electron upgrade: Security, Playwright compatibility, CDP stability

2. **Risk isolation**
   - Electron upgrade has known compatibility risk (CDP timeouts)
   - If combined and tests fail, it is unclear whether the cause is universal build or Electron/Playwright

3. **Scope and estimation**
   - 10.9 is well-scoped (2–3h) with clear ACs
   - Adding Electron upgrade would roughly double scope and require rewriting ACs

4. **Validation differs**
   - 10.9: `npm run build` succeeds, app runs on arm64/x64
   - Electron upgrade: All Playwright tests pass, no CDP timeouts, app functions correctly

5. **No dependency**
   - 10.9 does not require a newer Electron; it works with 30.5.1

### Alternative: Sequential in Same Session

If you want both done in one session:
- Complete 10.9 first (universal build)
- Then run a new story for Electron upgrade (create via `create-story` or add to Epic 10 backlog)
- Same total effort, but with clear separation and easier debugging

---

## 4. Detailed Change Proposals

### No changes to Story 10.9

Story 10.9 remains as-is:
- Tasks 1–3 unchanged
- No new ACs or tasks for Electron upgrade

### Electron upgrade remains in TECHNICAL-DEBT

- TECHNICAL-DEBT #1 stays as a separate, deferred item
- Can be turned into a story (e.g. “Upgrade Electron to supported version”) when prioritized

---

## 5. Implementation Handoff

**Scope:** Minor – story scope decision, no artifact edits

**Action:**
1. Proceed with Story 10.9 as written (universal macOS build only)
2. Leave Electron upgrade as TECHNICAL-DEBT #1 for a future story
3. Optionally create a new Epic 10 story for Electron upgrade and add it to backlog

**Handoff:** Development team – continue with 10.9 dev-story workflow

---

## 6. Approval

**Proposal:** Keep 10.9 and Electron upgrade separate; complete 10.9 first.

**User approval:** [x] Yes  [ ] No  [ ] Revise
