# Sprint Change Proposal — 2026-03-13

## Section 1: Issue Summary

**Trigger:** Completion of Epic 19 (Formula Reference Shift & UI Menu Cleanup) surfaced several small but impactful UX and developer experience issues documented in the backlog. A debugging session today also revealed the Pico.css margin injection bug on `<input>` elements — demonstrating the need for better debugging documentation.

**Problem statement:** The app has accumulated several friction points that don't belong in any existing epic but are visible to daily users and developers:
1. No way to clear all formatting from a cell without deleting content
2. "Clear" (context menu) and "Format Cleanup" (Format menu) are confusingly named and placed
3. Default log output is noisy — INFO-level messages appear without `--verbose`, making it harder to spot real errors
4. No debugging guide exists; discovering the logging system requires reading Story 16.8 notes

These are all small, independent, self-contained improvements with no cross-cutting architectural implications.

## Section 2: Impact Analysis

**Epic Impact:** None of epics 1–19 are affected. Epic 20 (Agentic API) is unrelated and stays backlog.

**Story Impact:** No existing stories need modification.

**Artifact Conflicts:**
- `epics.md` — should note Epic 21
- `sprint-status.yaml` — add Epic 21 entries
- `backlog.md` — remove promoted items

**Technical Impact:** Minimal. CSS, Go logging, Electron menu, and a new markdown doc.

## Section 3: Recommended Approach

**Option 1: Direct Adjustment** — Add Epic 21 with 4–5 stories.

Rationale: All items are small, independent, and well-understood. No architecture or PRD changes needed. Sequencing before Epic 20 makes sense — polish the existing app before adding a large new capability.

Risk: Low. Effort: Low–Medium.

## Section 4: Detailed Change Proposals

### Epic 21: UX Polish & Developer Experience

**Stories:**

| ID | Title | Scope |
|----|-------|-------|
| 21-1 | Clear cell styling | Add "Clear Formatting" action to context menu + Format menu + keyboard shortcut (Cmd+\\) that removes styleId and alignment from selected cells, leaving content intact |
| 21-2 | Rethink Clear / Clear Formatting naming | Audit context menu "Clear" (clears content) vs Format menu "Format Cleanup" (removes unused styles from registry) — rename and reposition for clarity |
| 21-3 | Logging cleanup | Suppress INFO-level logs when running without `--verbose`; fix/suppress Electron CSP warning; consider `--debug` flag for DEBUG-level below INFO |
| 21-4 | Create debugging.md | Document the full debugging workflow: renderer log forwarding rules, `npm start 2>/tmp/gosheet-debug.log`, log format, `--verbose` flag, how to add temporary `console.error` diagnostics |

### Backlog items to remove after implementation:
- "Clear cell styling"
- '"Clear" and "Clear Formatting" UX rethink'
- "Logging: clean the default"
- "Create debugging.md"

## Section 5: Implementation Handoff

**Scope:** Minor — direct implementation by dev team.

**Handoff:** Dev agent implements stories sequentially via `bmad-bmm-dev-story`.

**Success criteria:**
- Cmd+\\ clears formatting on selected cells
- "Clear" and format-related menu items have unambiguous names/placement
- `npm start` (no flags) produces only WARN/ERROR output
- `docs/debugging.md` exists and covers the full debugging workflow

## Checklist Status

- [x] 1.1 Trigger identified
- [x] 1.2 Problem defined
- [x] 1.3 Evidence documented
- [x] 2.1–2.5 Epic impact assessed
- [x] 3.1–3.4 Artifact conflicts analyzed
- [x] 4.1–4.4 Path forward selected
- [x] 5.1–5.5 Proposal components complete
- [x] 6.1–6.2 Proposal reviewed
