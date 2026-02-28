# Technical Research: UI Testing Best Practices

**Date:** 2026-02-28  
**Context:** GoSheet spreadsheet app; Playwright + Electron; flaky single-click behavior in tests

---

## Executive Summary

- **Hybrid pattern**: Use API for setup (fast, stable), UI for assertions (validates real behavior).
- **Electron is experimental**: Playwright’s Electron support is experimental; Chromium is the stable option.
- **Electron-specific issues**: Focus, webview handling, and synthetic vs real events can cause flaky clicks.
- **Recommendation**: Prefer Chromium for UI flows where possible; use API setup + UI assertions; keep Electron tests for Electron-only behavior.

---

## 1. Real User Interactions vs Programmatic Bypass

### Real UI Interactions (click, type, etc.)

| Pros | Cons |
|------|------|
| Exercises real user flows | Slower (rendering, animations, network) |
| Catches UI bugs | More brittle (UI changes break tests) |
| Tests event handlers and focus | Higher maintenance |
| Validates accessibility | Flaky in Electron |

### Programmatic Bypass (e.g. `window.selectCell()`)

| Pros | Cons |
|------|------|
| Fast and stable | Skips real click path |
| Avoids Electron click quirks | Misses click handler bugs |
| Less flaky | Not true E2E for that path |

### Industry Practice

**Hybrid pattern** (Netflix, Shopify, Uber):

- **Setup via API**: Create state with API calls instead of UI (login, data, navigation).
- **Assert via UI**: Use real UI interactions only where behavior must be validated.

Example:

```
// Setup via API (fast, stable)
await request.post('/api/cells', { data: { A1: 'test' } });

// Assert via UI (validates real behavior)
await page.goto('/spreadsheet');
await page.locator('#cell-0-0').click();
await expect(page.locator('#cell-0-0')).toHaveClass(/selected/);
```

---

## 2. Electron vs Chromium for UI Testing

| Aspect | Chromium | Electron |
|--------|----------|----------|
| Support | Stable, primary | Experimental |
| Clicks | Standard behavior | Focus/webview issues |
| Use case | Web apps | Desktop apps only |
| Flakiness | Lower | Higher |

**When to use Electron:**

- Testing Electron-only features (menus, native dialogs, IPC).
- Verifying packaging and desktop integration.

**When Chromium is enough:**

- Testing shared UI (spreadsheet, formulas, cells).
- Faster, more reliable runs.

**Strategy:** Run shared UI tests in Chromium; run Electron-specific tests in Electron.

---

## 3. Electron Click Reliability

### Known Issues

1. **Focus**: Clicks can fail if the target or window is not focused.
2. **Webview**: With `<webview>`, Playwright may target the wrong window.
3. **Synthetic events**: Playwright’s `click()` may not fully match real user events in Electron.

### Workarounds

1. **Focus before click:**
   ```javascript
   await page.evaluate(() => document.querySelector('#cell-0-0').focus());
   await page.locator('#cell-0-0').click();
   ```

2. **Force click (bypass actionability):**
   ```javascript
   await page.locator('#cell-0-0').click({ force: true });
   ```

3. **In-page click via `evaluate`:**
   ```javascript
   await page.evaluate(() => document.getElementById('cell-0-0').click());
   ```

4. **Programmatic bypass:** Call app APIs (e.g. `window.selectCell()`) when the goal is state, not click behavior.

---

## 4. Recommendations for GoSheet

### Short Term

1. **Hybrid pattern**
   - Setup: `setCellViaApi`, `setMergeViaApi`, etc.
   - Assert: Real UI interactions where behavior matters (e.g. “clicking a cell selects it”).

2. **Electron tests**
   - Use `selectCellViaApp` for setup and non-click-critical flows.
   - Use real clicks only for tests that explicitly validate click behavior.
   - Add focus before click if needed: `await cell.focus()` then `await cell.click()`.

3. **Documentation**
   - Document when to use API vs UI.
   - Note Electron limitations and workarounds.

### Medium Term

1. **Dual test targets**
   - Chromium: shared UI (spreadsheet, formulas, cells).
   - Electron: menus, IPC, native dialogs, packaging.

2. **Shared UI in Chromium**
   - Serve the app (e.g. `http://localhost:3000`) and run Playwright against Chromium.
   - Faster and more stable for UI flows.

3. **Electron-only suite**
   - Smaller set of tests for Electron-specific behavior.
   - Use bypasses where appropriate to keep them stable.

---

## 6. Implementation (2026-02-28)

- **Chromium project** (`test:chromium`): Runs `test_ui_interactions.spec.js` against Go server on port 3001. Uses real single/double/shift-click. Global setup starts server; teardown stops it.
- **Electron project** (`test:electron`): Runs all other specs. Uses `selectCellViaApp` for setup (hybrid pattern). Electron spawns its own server on 3000.
- **test_ui_interactions.spec.js**: Single click selects, double click edits, shift+click range, click-away saves. Must use real DOM interactions.
- **Scripts**: `npm run test:chromium`, `npm run test:electron`, `npm test` (both).

---

## 7. References

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Electron API](https://playwright.dev/docs/api/class-electron)
- [Playwright Input / Actions](https://playwright.dev/docs/input)
- [Electron click/focus issues (Playwright #9729, #38572)](https://github.com/microsoft/playwright/issues)
- [Hybrid API + UI Testing (Medium)](https://medium.com/@gunashekarr11/the-hybrid-testing-revolution-why-api-ui-tests-in-playwright-change-everything-71cfcb39727e)
- [Programmatic Login for Faster E2E (Momentic)](https://momentic.ai/resources/a-guide-to-programmatic-login-testing-for-faster-more-reliable-e2e-suites)
