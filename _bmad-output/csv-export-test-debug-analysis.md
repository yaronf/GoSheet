# CSV Export Test Failure: Deep Analysis

## Web-Grounded Research Summary

### Playwright + Electron Known Issues

**Playwright Issue #33737** ([microsoft/playwright#33737](https://github.com/microsoft/playwright/issues/33737)): "ElectronApplication.evaluate() is unreliable"
- **Electron 27+** introduced reliability issues with Playwright's `evaluate()` calls
- Errors occur "seemingly at random": "context or browser has been closed", "Promise was collected", "Execution context was destroyed"
- Affects both `electronApp.evaluate()` (main process) and `page.evaluate()` / `window.evaluate()` (renderer process)
- Issue closed as "not_planned" but real projects (e.g., Joplin) have implemented workarounds

**Joplin's workaround** ([laurent22/joplin#12216](https://github.com/laurent22/joplin/pull/12216)): Retry `electronApp.evaluate()` calls during test setup when they fail

### electron-playwright-helpers v2.0

The library **explicitly addresses** these Electron 27+ flakiness issues ([spaceagetv/electron-playwright-helpers](https://github.com/spaceagetv/electron-playwright-helpers)):

> "Starting with Electron 27, Playwright's `evaluate()` calls became unreliable, often throwing errors like 'context or browser has been closed', 'Promise was collected', or 'Execution context was destroyed' seemingly at random."

**v2.0 changes:**
- **Built-in retry logic** for all helper functions (transparent, no code changes needed)
- `retry(fn, options)` - wrap any Playwright call to retry on context errors
- `clickMenuItemById(electronApp, 'menu-id')` - trigger menu actions **without** renderer `evaluate()`
- `stubDialog(app, 'showSaveDialog', { filePath: '...' })` - documented for save dialogs

**Current project:** Uses `electron-playwright-helpers` **v1.7.1** (no retry logic)

### Best Practice: Prefer Menu Clicks Over evaluate()

From [electron-playwright-helpers docs](https://www.npmjs.com/package/electron-playwright-helpers):
- Use `clickMenuItemById(electronApp, 'open-file')` to trigger actions via the application menu
- Combine with `stubDialog()` for file dialogs
- This runs in the **main process** (menu click) rather than renderer `window.evaluate()`, avoiding the flaky code path

### "Target page has been closed" Root Causes (Stack Overflow, Playwright docs)

- Page/browser closes unexpectedly while evaluation is pending
- Long delays between operations allow the page to become unstable
- Page navigation destroys the execution context
- When test times out, Playwright tears down and closes the app → evaluate throws "page closed"

---

## Problem Statement

The test "Export CSV creates file with data" consistently fails with:
- **Test timeout of 30000ms exceeded**
- **Error: page.evaluate: Target page, context or browser has been closed**

The failure occurs at `triggerExportCSV()` → `window.evaluate()` → `handleExportCSV()`.

## What We Know

### 1. Import Works, Export Doesn't

Both use the same pattern:
```javascript
await window.evaluate(async () => {
  await window.handleImportCSV();   // ✓ Works
  await window.handleExportCSV(path); // ✗ Fails
});
```

### 2. The Error Timing

The error says "Target page has been closed" but this likely occurs **after** the 30-second timeout. Sequence:
1. `window.evaluate()` starts
2. Something inside hangs (doesn't return)
3. 30 seconds pass → test timeout
4. Playwright tears down, closes Electron
5. `evaluate` throws "page closed" (victim of teardown, not cause)

**Conclusion: Something in the export code path hangs for 30+ seconds.**

### 3. Code Path Comparison

**Import (works):**
```
handleImportCSV() 
  → PreviewCSV('') 
  → showOpenDialog (STUBBED - returns immediately)
  → fetch('/api/csv/preview') 
  → showCSVPreviewModal()
```

**Export (fails):**
```
handleExportCSV(testPath)
  → ExportCSV(testPath)  // path provided, skips dialog
  → fetch('POST', '/api/csv/export', { path })
  → backend writes file
  → showAlert()
```

Key difference: Import goes through a **stubbed** dialog (returns instantly). Export bypasses dialog and goes **directly to HTTP**.

### 4. Most Likely Culprit: fetch() Hanging

The `fetch()` to `/api/csv/export` is the only long-running operation. If it never resolves:
- The `await` in ExportCSV hangs
- The `await` in handleExportCSV hangs  
- The `await` in window.evaluate hangs
- Test runs for 30s, times out, Playwright closes app

**Why would fetch hang?**
- Server doesn't respond (crashes? deadlocks?)
- Request never reaches server
- Server responds with something that breaks parsing (unlikely to hang)

### 5. Why No Logs?

We added `console.log` throughout the export path. None appear. Two possibilities:
- Code never executes (unlikely - we get to evaluate)
- Playwright doesn't capture renderer process console output by default

## Diagnostic Strategy

### Phase 1: Isolate the Backend

**Test the backend directly** - bypass the renderer entirely. If the backend works when called from Node, the problem is in the renderer/Electron layer.

```javascript
// Add a diagnostic test
test('Debug: Backend export works when called from Node', async ({ electronApp }) => {
  const response = await fetch('http://localhost:3000/api/csv/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '/tmp/test-export.csv' })
  });
  const json = await response.json();
  expect(json.success).toBe(true);
});
```

**Problem:** The test runs in Node, but the Go server is spawned by Electron. We need the server to be running. The `electronApp` fixture gives us the app - the server should be running. But fetch from Node might hit a different server if multiple are running.

**Alternative:** Use `electronApp.evaluate()` in the **main process** to make the HTTP request, or use a simple curl in a beforeAll.

### Phase 2: Simplify the Renderer Call

**Strip down to minimum** - what's the simplest thing that could work?

```javascript
// Minimal test: can we even make a fetch from the renderer?
test('Debug: Renderer can fetch /api/csv/export', async ({ window }) => {
  const result = await window.evaluate(async () => {
    const res = await fetch('/api/csv/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/tmp/test.csv' })
    });
    return { status: res.status, ok: res.ok };
  });
  expect(result.ok).toBe(true);
});
```

If this fails with timeout → fetch from renderer is broken.
If this passes → the issue is in handleExportCSV/ExportCSV logic.

### Phase 3: Check for Serialization Issues

**Could the path cause problems?** We're passing a path like `/var/folders/xx/.../gosheet-csv-test-xxx/export.csv` through `window.__testExportPath`. 

- Path might have special characters?
- Path might not serialize correctly across the evaluate boundary?
- Try a simple path: `/tmp/gosheet-test-export.csv`

### Phase 4: Test Order / State

**Does test order matter?** Run the export test in isolation vs. after import tests:
```bash
# Isolated
npx playwright test -g "Export CSV creates file with data"

# After imports (run describe block)
npx playwright test test_csv_import.spec.js
```

If it passes in isolation but fails after imports, there's state pollution.

## Alternative Approaches

### A. Don't Use window.evaluate for Export

Instead of calling export from the renderer, could we:
1. **Use the menu** - `electronApp.evaluate` to trigger File → Export CSV, then stub the dialog
2. **Call backend from test** - Make HTTP request from Node test, verify file exists. Doesn't test the UI flow but tests the critical path.

### B. Increase Timeout for Debugging

```javascript
test('Export CSV creates file with data', async ({ window, electronApp }) => {
  test.setTimeout(60000); // 60 seconds
  // ...
});
```

If it passes with 60s, something is slow. If it still fails, it's a hang.

### C. Use Playwright's page.on('console') to Capture Logs

```javascript
window.on('console', msg => {
  console.log('[Renderer]', msg.text());
});
```

This might reveal where the code gets stuck.

## Recommended Next Steps (Web-Grounded)

### Primary: Avoid window.evaluate() for Export

**Use `clickMenuItemById` + `stubDialog`** (electron-playwright-helpers pattern):

```javascript
// Instead of: await triggerExportCSV(window, csvPath)
await stubDialog(electronApp, 'showSaveDialog', { canceled: false, filePath: csvPath });
await clickMenuItemById(electronApp, 'export-csv');
```

Our menu has `id: 'export-csv'` in `electron/menu.js`. This triggers the action via the main process (menu click → IPC → renderer) instead of calling `window.evaluate()` in the renderer. No flaky evaluate path.

### Secondary: Upgrade electron-playwright-helpers

- Current: v1.7.1
- Target: v2.0+ (has built-in retry for context errors)
- Migration: `npm install electron-playwright-helpers@latest` (requires Node 18+)

### Tertiary: Wrap custom evaluate calls with retry()

If we must use `window.evaluate()`, wrap with the v2.0 `retry()` helper:

```javascript
const { retry } = require('electron-playwright-helpers');
await retry(() => window.evaluate(async () => { ... }));
```

### Diagnostic (still useful)

1. **Minimal fetch test** - confirms whether fetch or evaluate is the bottleneck
2. **Console listener** - captures renderer logs for debugging

## Hypothesis Summary

| Hypothesis | Likelihood | How to Verify |
|------------|------------|---------------|
| fetch() to /api/csv/export hangs | High | Minimal fetch test |
| Backend crashes on export | Medium | Call backend from Node |
| Path serialization issue | Low | Use /tmp/test.csv |
| Dialog stub interfering | Low | We bypass dialog with path |
| Test isolation/order | Low | Run single test |
