# Story 14.3: Port Chromium Click Tests to Electron

**Status:** done
**Epic:** 14 — Electron Platform Upgrade

---

## Story

As a developer,
I want the 5 real-click tests ported from the Chromium project into the Electron project,
So that the `chromium-web` project and its infrastructure can be removed entirely.

---

## Acceptance Criteria

**Given** the 5 tests in `test_ui_interactions.spec.js`
**When** each is ported to the Electron project
**Then** all 5 pass reliably in `npm run test:electron` with no flakiness (passes on 3 consecutive runs)

**Given** the Chromium project is removed from `playwright.config.js`
**When** `npm test` is run
**Then** only the electron project runs and all tests pass
**And** `test_ui_interactions.spec.js`, `global-setup.js`, and `global-teardown.js` are deleted

**Given** the CI workflow installs `chromium` browser
**When** the Chromium project is removed
**Then** the CI step `npx playwright install --with-deps chromium` is removed (Electron binary comes from npm, no separate install needed)

---

## Tasks / Subtasks

- [x] Task 1: Attempt naive port — try real Playwright clicks in Electron first (AC: 1)
  - [x] Create `playwright_tests/test_click_interactions.spec.js` using the `{ window }` fixture
  - [x] Port all 5 tests using direct `cell.click()` / `cell.dblclick()` (no workarounds needed)
  - [x] Run 3 times consecutively — 5/5 passed all 3 runs

- [x] Task 2: Fix click reliability if naive port is flaky (AC: 1)
  - [x] N/A — naive port passed 3/3 runs with zero flakiness on Electron 40

- [x] Task 3: Delete Chromium infrastructure (AC: 2, 3)
  - [x] Delete `playwright_tests/test_ui_interactions.spec.js`
  - [x] Delete `playwright_tests/global-setup.js`
  - [x] Delete `playwright_tests/global-teardown.js`
  - [x] Remove `chromium-web` project from `playwright.config.js`
  - [x] Remove `globalSetup` and `globalTeardown` references from `playwright.config.js`
  - [x] Remove `test:chromium` script from `package.json`
  - [x] `GOSHEET_WEB_PORT` only referenced in deleted files — no remaining references

- [x] Task 4: Update CI workflow (AC: 3)
  - [x] Remove `npx playwright install --with-deps chromium` step from `.github/workflows/test.yml`
  - [x] System deps for Electron (libnss3, xvfb, etc.) retained

- [x] Task 5: Run full suite and verify (AC: 1, 2)
  - [x] `npm run test:electron` — 201/201 pass (includes the 5 new click tests)
  - [x] `npm test` — same result (electron only, no chromium project)
  - [x] Pushed to main (commit 54c60c4) — CI pending

---

## Dev Notes

### The 5 tests to port

From `test_ui_interactions.spec.js`:

1. **`single click selects cell`** — `cell.click()` → expect `selected` class
2. **`single click updates formula bar`** — `cell.click()` → expect `#cell-ref` text = `C4`
3. **`double click enters edit mode`** — `cell.dblclick()` → expect `.cell-editor` visible → type → Enter → check cell text
4. **`shift+click extends selection to range`** — click A1, shift+click C3 → expect 9 cells selected
5. **`click away from cell saves edit`** — dblclick, type, click another cell → expect original cell updated

### Why clicks were flaky in Electron (Electron 30 era)

From `technical-ui-testing-research-2026-02-28.md`:
- Playwright's `click()` sends synthetic events; Electron 30's webview sometimes dropped them
- Window focus issues: the Electron window wasn't focused when clicks were dispatched
- Result: `selectCellViaApp` (JS evaluate) was used as a workaround throughout `test_spreadsheet.spec.js`

**With Electron 40**, the webview/click handling is significantly improved. Try the naive port first — it may just work.

### Click fix options (apply only if naive port is flaky)

**Option A: `cell.focus()` before `cell.click()`**
```js
await cell.focus();
await cell.click();
await expect(cell).toHaveClass(/selected/, { timeout: 3000 });
```

**Option B: In-page click via evaluate (most reliable)**
```js
await window.evaluate((id) => document.getElementById(id).click(), 'cell-5-5');
await expect(cell).toHaveClass(/selected/, { timeout: 3000 });
```

**Option C: `click({ force: true })` (bypasses actionability checks)**
```js
await cell.click({ force: true });
await expect(cell).toHaveClass(/selected/, { timeout: 3000 });
```

**Option D: Wait for window focus before clicking**
```js
await window.evaluate(() => window.focus());
await cell.click();
```

Try options in order: A → D → B. Option B is the nuclear option — it works but bypasses Playwright's actionability checks (scroll into view, visibility, etc.). Prefer A or D if they work.

### Porting pattern

The Chromium tests use `{ browser }` fixture with a manual `context/page`. The Electron tests use `{ window }` from `fixtures.js`. The port is straightforward:

```js
// Chromium (old):
test.describe('UI interactions', () => {
  test.describe.configure({ mode: 'serial' });
  let page;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:3001' });
    page = await context.newPage();
    await page.goto('/');
    await ensureSpreadsheetView(page);
  });
  test('single click selects cell', async () => {
    await page.locator('#cell-5-5').click();
    ...
  });
});

// Electron (new):
const { test, expect } = require('./fixtures');
test.describe('Click interactions (Electron)', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
  });
  test('single click selects cell', async ({ window }) => {
    await window.locator('#cell-5-5').click();
    ...
  });
});
```

Note: serial mode is still recommended to avoid per-test Electron app startup overhead. The `{ window }` fixture launches Electron once per describe block when serial.

### `shift+click` in Electron

Playwright's `click({ modifiers: ['Shift'] })` should work in Electron 40. If not, use:
```js
await window.keyboard.down('Shift');
await cellC3.click();
await window.keyboard.up('Shift');
```

### Files to delete

- `playwright_tests/test_ui_interactions.spec.js`
- `playwright_tests/global-setup.js`
- `playwright_tests/global-teardown.js`

### `playwright.config.js` changes

Remove:
- `globalSetup: require.resolve('./playwright_tests/global-setup.js')`
- `globalTeardown: require.resolve('./playwright_tests/global-teardown.js')`
- The entire `chromium-web` project entry
- The comment about dual projects

### `package.json` changes

Remove:
- `"test:chromium": "playwright test --project=chromium-web"`

Keep:
- `"test": "NODE_ENV=test playwright test"` — now runs electron only
- `"test:electron": "NODE_ENV=test playwright test --project=electron"`

### `.github/workflows/test.yml` changes

Remove:
```yaml
- name: Install Playwright browsers with system dependencies
  run: npx playwright install --with-deps chromium
```

Electron binary is installed via `npm ci` (bundled in the `electron` npm package). No separate Playwright browser install is needed for Electron tests.

Keep all system dependency installs (libnss3, xvfb, etc.) — these are needed for Electron on Ubuntu.

---

## References

- `playwright_tests/test_ui_interactions.spec.js` — the 5 tests to port (source)
- `playwright_tests/fixtures.js` — `{ window }` fixture for Electron tests
- `playwright_tests/helpers.js` — `ensureSpreadsheetView`, `setCellViaApi`, `waitForEditModeReady`
- `playwright.config.js` — project config to update
- `.github/workflows/test.yml` — CI to update
- `_bmad-output/planning-artifacts/research/technical-ui-testing-research-2026-02-28.md` — original flakiness analysis and workarounds

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

### Change Log
