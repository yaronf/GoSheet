# Sprint Change Proposal — 2026-03-08

## Section 1: Issue Summary

**Problem:** Story 16.7 (Multi-Window Support) assumed macOS would route Finder double-clicks on `.sheet` files to the running GoSheet instance via Electron's `open-file` event. In practice, this only happens when the app is registered with the OS as a file handler (i.e. packaged/installed). In development mode (`npm start`), Finder spawns a **new Electron process** for each double-click instead of sending `open-file` to the running one. The result: duplicate windows/processes rather than a new window in the existing app.

**Discovered:** During manual testing of Story 16.7 after implementation. Log analysis confirmed `open-file` never fired on the running process when double-clicking in Finder.

**Contributing cause:** Story 16.5 explicitly instructed removing `app.requestSingleInstanceLock()`, which is the standard Electron mechanism for forwarding new-instance launches to the running instance via `second-instance`. That removal was correct for port-conflict reasons but inadvertently eliminated the forwarding mechanism needed for multi-window.

**Evidence:**
- `grep "open-file\|second-instance" /tmp/gosheet.log` — zero `open-file` entries after Finder double-click
- New Go server process spawned (PID visible in `ps`) instead of new window in existing process

---

## Section 2: Impact Analysis

**Epic Impact:**
- Epic 16 (Data Safety & File Integrity): Story 16.7 status must revert from `review` to `in-progress` pending this fix. Story 16.5 implementation note must be corrected.

**Story Impact:**
- **Story 16.5** (done): Implementation note incorrectly states "remove `requestSingleInstanceLock`". The note must be corrected — the lock was correctly removed for port reasons but should have been re-introduced with a `second-instance` handler for window forwarding.
- **Story 16.7** (review → in-progress): Three changes needed:
  1. Re-introduce `app.requestSingleInstanceLock()` (skipped in `NODE_ENV=test`)
  2. Add `app.on('second-instance', ...)` handler to open new window with forwarded file path
  3. Add dedup check in `second-instance` handler (same `windowRegistry.currentFilePath` logic as `open-file`)
  4. Update tests: add `second-instance` test alongside existing `open-file` test

**Artifact Conflicts:**
- `epics.md` — Story 16.7 background text and AC3 reference `open-file` as the mechanism; must clarify that `second-instance` is the primary mechanism for dev mode + future packaged builds when file associations aren't registered
- `epics.md` — Story 16.5 implementation note must remove the incorrect instruction to remove the lock permanently
- `16-7-multi-window-support.md` — Dev Notes must add `second-instance` pattern; tasks must add the single-instance lock subtask

**Technical Impact:**
- `electron/main.js` — add `requestSingleInstanceLock` + `second-instance` handler (small, ~20 lines)
- `playwright_tests/test_multi_window.spec.js` — add one new test for `second-instance` dedup; existing `open-file` tests remain valid (cover the packaged-app path)
- No impact on Go backend, frontend, or other test files

---

## Section 3: Recommended Approach

**Direct Adjustment** — modify Story 16.7 in-progress, implement the fix, re-run tests.

The change is small and well-understood:
1. Guard `requestSingleInstanceLock` with `NODE_ENV !== 'test'` so Playwright tests are unaffected
2. `second-instance` handler mirrors the `open-file` dedup logic already in place
3. One new Playwright test covering `second-instance` forwarding

**Effort:** ~30 minutes implementation + test
**Risk:** Low — the lock is a standard Electron pattern; test-mode guard prevents any Playwright regression
**Timeline impact:** None — Story 16.7 moves back to `in-progress` for one fix cycle, then back to `review`

---

## Section 4: Detailed Change Proposals

### Change 1: `epics.md` — Story 16.5 implementation note

**Story:** 16.5
**Section:** Implementation note

OLD:
```
The `second-instance` handler (`main.js:25`) should be removed at the same time.
```

NEW:
```
Note: `requestSingleInstanceLock` was removed in Story 16.5 for port-conflict reasons.
Story 16.7 re-introduces it (with a `second-instance` handler) for multi-window file forwarding.
```

**Rationale:** The original instruction to permanently remove the lock was overly broad. The lock serves two distinct purposes: port-conflict prevention (no longer needed) and new-instance forwarding (still needed).

---

### Change 2: `epics.md` — Story 16.7 background + AC3

**Story:** 16.7
**Section:** Background + AC3

OLD (Background):
```
After Story 16.5 removes the fixed port and single-instance lock, each GoSheet process will run
with its own ephemeral port. Story 16.7 completes the picture: `open-file` events and CLI launches
spin up a new window (and a new Go server child process) rather than reusing the existing one.
```

NEW:
```
After Story 16.5 introduces ephemeral ports, each window has its own Go server. Story 16.7
completes the picture: Finder double-clicks and CLI launches open a new window in the existing
process rather than spawning a duplicate process. This requires re-introducing
`app.requestSingleInstanceLock()` with a `second-instance` handler that forwards the file path
to the running instance. The `open-file` event continues to handle the packaged-app/registered
file-association path.
```

OLD (AC3):
```
Given GoSheet is launched from the CLI with a file path argument
When a GoSheet instance is already running
Then a new window opens with the specified file (macOS routes `open-file` to the running app;
Electron handles it by creating a new window)
```

NEW:
```
Given GoSheet is launched from the CLI with a file path argument
When a GoSheet instance is already running
Then a new window opens with the specified file in the existing process
And the new launch exits immediately after forwarding the file path via `second-instance`
```

**Rationale:** The original text incorrectly described the mechanism. In development and for unregistered file associations, `second-instance` is the actual forwarding path, not `open-file`.

---

### Change 3: `epics.md` — Story 16.7 implementation note

**Story:** 16.7
**Section:** Implementation note

OLD:
```
File path routing (`open-file`, CLI arg, Recent Files) calls `createWindow(filePath)` rather
than sending an IPC message to the existing window.
```

NEW:
```
File path routing uses two complementary mechanisms:
- `second-instance`: primary path for dev mode and unregistered file associations — new Electron
  process forwards its argv to the running instance, which calls `createWindow(filePath)`
- `open-file`: fires in packaged builds with registered `.sheet` file association — also calls
  `createWindow(filePath)` with dedup check
- `requestSingleInstanceLock` must be skipped in `NODE_ENV=test` to avoid breaking Playwright
  (each test run launches a fresh instance)
```

---

### Change 4: `16-7-multi-window-support.md` — tasks + dev notes

**Story file:** `_bmad-output/implementation-artifacts/16-7-multi-window-support.md`

Add to Tasks:
```
- [ ] Task 7: Single-instance lock + second-instance handler (AC: 1, 3)
  - [ ] Add `app.requestSingleInstanceLock({ argv: process.argv })` at top of main.js,
        skipped when `NODE_ENV === 'test'`
  - [ ] If lock not obtained: `app.quit(); process.exit(0)`
  - [ ] Add `app.on('second-instance', (event, argv) => { ... })` — extract file from argv,
        apply same dedup check as open-file handler, call `createWindow(filePath)` or focus
  - [ ] Update test: add test for second-instance dedup (double-open same file stays at 1 window)
```

Add to Dev Notes:
```
### Single-Instance Lock — Required for Finder/CLI Forwarding

`app.requestSingleInstanceLock()` must be active in production. When GoSheet is not a registered
file handler (dev mode, unregistered association), Finder spawns a new process on double-click.
The lock causes that new process to quit immediately and emit `second-instance` on the running
instance with the new argv.

Skip the lock in test mode — Playwright launches a fresh instance per test run:
```js
if (process.env.NODE_ENV !== 'test') {
  const gotLock = app.requestSingleInstanceLock({ argv: process.argv });
  if (!gotLock) { app.quit(); process.exit(0); }
}

app.on('second-instance', (event, argv) => {
  const fp = argv.find(a => !a.startsWith('-') && (a.endsWith('.sheet') || a.endsWith('.csv')));
  if (fp && fs.existsSync(fp)) {
    const resolved = path.resolve(fp);
    for (const [win, state] of windowRegistry) {
      if (state.currentFilePath && path.resolve(state.currentFilePath) === resolved) {
        if (!win.isDestroyed()) { win.show(); win.focus(); }
        return;
      }
    }
    createWindow(fp);
  } else {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length && !wins[0].isDestroyed()) { wins[0].show(); wins[0].focus(); }
  }
});
```
```

---

### Change 5: `sprint-status.yaml`

```
16-7-multi-window-support: review → in-progress
```

---

## Section 5: Implementation Handoff

**Scope classification:** Minor — direct implementation by dev team, no PO/PM involvement needed.

**Handoff:** Development team implements Change 4 (main.js + test), then updates story status back to `review`.

**Success criteria:**
- Double-clicking an already-open `.sheet` file in Finder focuses the existing window (no new window)
- Double-clicking a different `.sheet` file opens a new window in the existing process
- All 5 existing `test_multi_window.spec.js` tests still pass
- New `second-instance` dedup test passes
- `NODE_ENV=test` path unaffected (Playwright suite green)
