# Story 21.2: Clear / Format Cleanup Naming UX

Status: done

## Story

As a spreadsheet user,
I want the cell-clearing and format-cleanup actions to have unambiguous names and logical placement,
so that I can instantly understand what each action does without confusion.

## Acceptance Criteria

1. **Given** the context menu is open
   **When** the user sees the content-clearing action
   **Then** it is labelled **"Clear Contents"** (was: "Clear") — unambiguously describes that cell *values* are deleted, not formatting

2. **Given** the Format menu is open
   **When** the user sees the registry-cleanup action
   **Then** it is labelled **"Remove Unused Styles"** (was: "Format Cleanup") — describes what it actually does: removes style definitions that are not in use

3. **Given** the context menu is open
   **When** "Clear Contents" and "Clear Formatting" are both visible
   **Then** "Clear Formatting" appears **above** "Clear Contents" (formatting actions grouped together, destructive content-clear at bottom)

4. **Given** a screen-reader user navigates the context menu
   **When** they reach the clearing actions
   **Then** aria-labels and button text match the new labels

5. **Given** any existing Playwright tests that reference "Clear" label or `data-action="clear"` or "Format Cleanup"
   **When** the rename is applied
   **Then** tests still pass (update test selectors/text as needed)

## Tasks / Subtasks

- [ ] Task 1: Rename context menu button label (AC: 1, 3, 4)
  - [ ] In `frontend/app.js`: change `data-action="clear"` button label from "Clear" to "Clear Contents"
  - [ ] Keep `data-action="clear"` unchanged (backend dispatch key, no need to change)
  - [ ] Verify button order: "Clear Formatting" button is already above "Clear Contents" (done in Story 21.1) — confirm order in HTML

- [ ] Task 2: Rename "Format Cleanup" to "Remove Unused Styles" (AC: 2)
  - [ ] In `electron/menu.js`: change `label: 'Format Cleanup'` to `label: 'Remove Unused Styles'`
  - [ ] In `electron/preload.js`: no change needed (IPC channel `menu-format-cleanup` is internal, renderer uses it via `onMenuFormatCleanup`)
  - [ ] In `frontend/app-file-ops.js`: update any user-visible strings referencing "Format Cleanup" (e.g., `showAlert` messages)

- [ ] Task 3: Update Playwright tests (AC: 5)
  - [ ] Search all test files for text "Clear" used as a context menu label (not `data-action="clear"`)
  - [ ] Update selectors that look for button text "Clear" → "Clear Contents"
  - [ ] Search for "Format Cleanup" in test files → update to "Remove Unused Styles"
  - [ ] Run `npx playwright test` targeted on affected test files to confirm they pass

## Dev Notes

### Current State (post-Story 21.1)

Context menu HTML (in `frontend/app.js` ~lines 172-182):
```html
<button type="button" class="context-menu-item" data-action="clear-formatting">
    Clear Formatting
</button>
<button type="button" class="context-menu-item" data-action="clear">
    Clear
</button>
```

Format menu (`electron/menu.js` ~line 512):
```js
{ id: 'format-cleanup', label: 'Format Cleanup', ... }
```

### Rename Map

| Current label | New label | Location | Why |
|---|---|---|---|
| "Clear" (context menu) | "Clear Contents" | `frontend/app.js` | "Clear" is ambiguous — does it clear values? formatting? both? |
| "Format Cleanup" (Format menu) | "Remove Unused Styles" | `electron/menu.js` | "Format Cleanup" is jargon; the action removes orphaned style definitions from the registry |

### What NOT to change
- `data-action="clear"` attribute on the button — this is the dispatch key, changing it would break the handler in `app-ui.js` (or require updating that too)
- IPC channel name `menu-format-cleanup` in `preload.js` / `menu.js` — internal wire, invisible to users
- The backend API endpoint `/api/format/cleanup` — not user-facing

### Files to Touch
- `frontend/app.js` — rename "Clear" button text to "Clear Contents"
- `electron/menu.js` — rename "Format Cleanup" to "Remove Unused Styles"
- `frontend/app-file-ops.js` — check for any user-visible "Format Cleanup" strings in alerts/logs
- Playwright tests — update any text selectors for "Clear" or "Format Cleanup"

### Testing Notes
- Search: `grep -r "Format Cleanup\|\"Clear\"" playwright_tests/`
- Context menu button label changes don't need a Playwright test — visual-only rename covered by existing context menu tests if they check label text
- If no existing tests check these labels, no new test needed (label correctness is low-risk)
- Run: `npx playwright test test_context_menu.spec.js` (or whichever file covers context menu)

### References
- [Source: frontend/app.js#~175-182] Context menu "Clear" and "Clear Formatting" buttons
- [Source: electron/menu.js#~498-520] Format menu "Clear Formatting" and "Format Cleanup" items
- [Source: frontend/app-file-ops.js#~660-674] Format Cleanup menu handler with alert messages
- [Source: frontend/app-ui.js#~306-312] `dispatchContextMenuAction` "clear" handler

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Renamed context menu "Clear" → "Clear Contents" (label only, `data-action="clear"` unchanged)
- Renamed Format menu "Format Cleanup" → "Remove Unused Styles" (IPC channel `menu-format-cleanup` unchanged)
- Updated error alert string in `app-file-ops.js`
- Updated `test_merge.spec.js` test name and menu item label selector

### File List

- frontend/app.js — "Clear" button label → "Clear Contents"
- electron/menu.js — "Format Cleanup" label → "Remove Unused Styles"
- frontend/app-file-ops.js — error alert string updated
- playwright_tests/test_merge.spec.js — test name and label selector updated
