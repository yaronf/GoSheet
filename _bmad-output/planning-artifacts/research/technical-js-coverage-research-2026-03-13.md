# Technical Research: JavaScript Frontend Coverage for GoSheet

Date: 2026-03-13

## Context

GoSheet's frontend is plain HTML/JS (no bundler, no TypeScript) served as static files from the Go server. Tests run via Playwright with an Electron driver. We need JS coverage to complement the existing Go coverage (89.8% total).

## Options Considered

### Option A: Playwright `page.coverage`
**Verdict: Dead end.** The API is Chromium-only by explicit Playwright design. Not available when driving Electron.

### Option B: V8/CDP via `newCDPSession`
Electron's renderer is a Chromium process and supports CDP (`Profiler.startPreciseCoverage`). In principle, `page.context().newCDPSession(page)` could work.

**Why we rejected it:**
- Playwright docs say CDP sessions are "Chromium-based browsers only" — compatibility with Electron's renderer via Playwright 1.58 is unconfirmed and would require a spike.
- Output is V8 block-level coverage (byte offset ranges), requiring `v8-to-istanbul` conversion. This conversion introduces fidelity loss, particularly for branch coverage — which is the metric we care most about.
- Extra plumbing: main process wiring via `webContents.debugger` or CDP session management, script URL mapping for `file://`-served assets.
- The sole advantage over Option A is no source modification — not worth the risk and complexity.

### Option C: Istanbul source instrumentation (chosen)
**Why chosen:**
- Mature, battle-tested toolchain (`istanbul-lib-instrument` v6, `nyc`).
- First-class branch coverage: `if/else`, ternary, `&&`/`||`, `??`, `switch` arms are all tracked as independent counters. This is the most reliable branch coverage available for JS.
- Works with plain JS — no bundler or TypeScript required. `instrumentSync(source, filename)` takes a JS string and returns an instrumented JS string.
- Extraction via `page.evaluate(() => window.__coverage__)` — standard, confirmed to work in Electron renderer.
- CI-friendly: instrument script + `nyc report` are both pure Node.js.
- No Electron/CDP uncertainty.

### Option D: Mutation testing (Stryker)
Conceptually superior quality signal for E2E-tested code but out of scope for now. Deferred to backlog.

## Workflow (Option C)

1. `scripts/instrument-frontend.js` — reads `frontend/*.js`, instruments each with `istanbul-lib-instrument`, writes to `frontend-instrumented/`.
2. Go server serves from `frontend-instrumented/` when `COVERAGE=1` env var is set.
3. Playwright `globalTeardown` extracts `window.__coverage__` via `page.evaluate()` and writes `.nyc_output/coverage.json`.
4. `npm run coverage:report` runs `nyc report --reporter=html --reporter=lcov --reporter=text-summary`.

## Branch Coverage Targets

### Industry baselines
- **80% line / 70% branch** — common minimum for "acceptable" coverage gates in enterprise JS projects (e.g., Jest defaults, many team standards).
- **80% branch** — widely cited as the threshold where branch coverage starts providing meaningful signal; below this, too many decision paths are untested.
- **90%+ branch** — typical for well-tested utility/library code; harder to achieve in UI-heavy code due to event-driven paths.
- **E2E-specific reality**: E2E line coverage tends to run 85–95% naturally (most lines execute during happy-path tests). Branch coverage from E2E is typically 60–75% — many error branches and edge cases are never exercised.

### Recommended targets for GoSheet frontend
| Metric | Gate (CI fail below) | Goal |
|--------|---------------------|------|
| Line | 80% | 85% |
| Branch | 65% | 75% |
| Function | 80% | 90% |

Rationale: branch gate at 65% is achievable from E2E tests without heroic effort; 75% goal pushes us to cover at least the main error/edge paths. A higher branch gate would require dedicated unit tests for every UI edge case, which is not the current testing strategy.

### What branch coverage tells us here
The value for GoSheet is **gap-finding**, not gating. Uncovered branches in `frontend/app-cell-editor.js`, `frontend/app-file-ops.js`, etc. will point to error states and edge cases that no Playwright test ever exercises — those are candidates for new tests. The aggregate percentage is secondary.

## References
- `istanbul-lib-instrument` v6: https://github.com/istanbuljs/istanbuljs/tree/main/packages/istanbul-lib-instrument
- `nyc` v15: https://github.com/istanbuljs/nyc
- `v8-to-istanbul`: rejected (see Option B above)
