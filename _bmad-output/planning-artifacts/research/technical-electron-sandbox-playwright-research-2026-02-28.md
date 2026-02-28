# Technical Research: Electron + Playwright in Cursor Sandbox

**Date:** 2026-02-28  
**Context:** Electron tests fail in Cursor's AI sandbox with `bad option: --remote-debugging-port=0`; Chromium tests work.

---

## Problem

When running `npx playwright test --project=electron` from the AI sandbox (e.g. via Composer), Electron fails to launch:

```
Electron: bad option: --remote-debugging-port=0
```

The same command works when run in Cursor's terminal. Chromium tests run successfully in the sandbox after `npx playwright install chromium`.

---

## Root Cause

1. **Playwright hardcodes the flag**  
   In `playwright-core/lib/server/electron/electron.js` (line 130):
   ```js
   let electronArguments = ["--inspect=0", "--remote-debugging-port=0", ...options.args || []];
   ```
   There is no launch option to override or remove this.

2. **Electron 30 rejects `=0`**  
   Electron's `--remote-debugging-port` expects a port number. Using `0` (to mean "pick any port") is Chromium behavior; Electron 30.x treats it as invalid and reports "bad option".

3. **Environment difference**  
   The sandbox runs with a different cwd/env than the terminal. GitHub issue [#32027](https://github.com/microsoft/playwright/issues/32027) notes that when cwd differs (e.g. VSCode extension vs terminal), Electron launch can fail. The suggested fix is using absolute paths and explicit `cwd`.

---

## Potential Solutions

### 1. Set explicit `cwd` (low effort) — **TRIED, DID NOT FIX**

Ensure the Electron process runs from the project root:

```js
// fixtures.js
const electronApp = await playwright._electron.launch({
  executablePath: electronPath,
  args: [path.resolve(__dirname, '..', 'electron', 'main.js'), ...],
  cwd: path.resolve(__dirname, '..'),  // ADD THIS
  env: { ... },
});
```

**Validation (2026-02-28):** Implemented in `fixtures.js`. Electron tests still fail with `bad option: --remote-debugging-port=0`. The `cwd` change is irrelevant—Playwright injects `--remote-debugging-port=0` internally before our args; we cannot override or remove it via launch options.

---

### 2. Downgrade Playwright to 1.43.x (medium effort)

Regression appeared in Playwright 1.44; 1.43.1 was the last known good version for some Electron setups.

```bash
npm install @playwright/test@1.43.1 playwright@1.43.1
```

**Pros:** Might avoid the problematic flag or behavior.  
**Cons:** Loses newer fixes; may not address sandbox-specific behavior.

---

### 3. Downgrade Electron to 23.x (medium effort)

Electron 28+ has known issues with `remote-debugging-port` and WebSocket connections ([electron/electron#41325](https://github.com/electron/electron/issues/41325)).

```bash
npm install electron@23
```

**Pros:** Older Electron may accept `=0` or behave differently.  
**Cons:** Older Electron; may conflict with other deps.

---

### 4. Patch Playwright's Electron launcher (high effort)

Use `patch-package` to change the hardcoded args:

```js
// In node_modules/playwright-core/lib/server/electron/electron.js
// Change: "--remote-debugging-port=0" → "--remote-debugging-port=9222"
```

**Pros:** Direct fix without changing project deps.  
**Cons:** Breaks on `npm install`; needs maintenance; port 9222 might conflict.

---

### 5. Run Electron tests only outside sandbox (no code change)

Document that Electron tests must run in Cursor's terminal or CI, not from the AI sandbox.

**Pros:** No code changes; matches current behavior.  
**Cons:** AI cannot run full Playwright suite in sandbox.

---

### 6. Use Chromium for more tests (architectural)

Extend the hybrid pattern from [technical-ui-testing-research-2026-02-28.md](./technical-ui-testing-research-2026-02-28.md): run more tests in Chromium (web mode) and keep Electron only for Electron-specific behavior (menus, IPC, etc.).

**Pros:** More tests run in sandbox; Chromium is more stable.  
**Cons:** Some Electron-only flows stay unsandboxed.

---

## Recommended Approach

1. ~~**Short term:** Add explicit `cwd` in `fixtures.js` (Solution 1) and retry Electron tests in the sandbox.~~ **Tried—did not fix.**
2. **Current:** Treat as environment limitation and document that Electron tests run only in terminal/CI (Solution 5).
3. **Long term:** Prefer Chromium for UI tests where possible; use Electron only when necessary (Solution 6).

---

## References

- [Playwright #32027](https://github.com/microsoft/playwright/issues/32027) – Electron launch failure with VSCode extension; fix: absolute paths, cwd
- [Electron #41325](https://github.com/electron/electron/issues/41325) – remote-debugging-port WebSocket issues in Electron 28+
- [Electron command-line switches](https://www.electronjs.org/docs/latest/api/command-line-switches) – `--remote-debugging-port=port`
- [Playwright Electron API](https://playwright.dev/docs/api/class-electron) – `cwd`, `args`, `env`
