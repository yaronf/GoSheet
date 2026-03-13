// Story 15.2: Undo/Redo for Cell Edits and Deletion
// Tests keyboard shortcuts (Cmd+Z / Cmd+Shift+Z), toolbar buttons, and Edit menu state.

const { test, expect } = require('./fixtures');
const {
  ensureSpreadsheetView,
  setCellViaApi,
  waitForEditModeReady,
} = require('./helpers');

// Helper: call /api/undo directly via fetch in the renderer.
async function apiUndo(window) {
  return window.evaluate(async () => {
    const res = await fetch('/api/undo', { method: 'POST' });
    return res.json();
  });
}

// Helper: call /api/redo directly via fetch in the renderer.
async function apiRedo(window) {
  return window.evaluate(async () => {
    const res = await fetch('/api/redo', { method: 'POST' });
    return res.json();
  });
}

test.describe('Undo/Redo (Story 15.2)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);
    const newBtn = window.locator('#new-btn');
    await newBtn.click();
    const modal = window.locator('#modal-overlay');
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await window.locator('#modal-ok').click();
      await expect(modal).toBeHidden();
    }
    await expect(window.locator('#cell-0-0')).toBeVisible();
    await expect(window.locator('#file-status')).toContainText('Saved', {
      timeout: 3000,
    });
  });

  // AC1: Undo cell edit via Cmd+Z
  test('Cmd+Z undoes a cell edit', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await expect(window.locator('#cell-0-0')).toHaveText('hello');

    await window.keyboard.press('Meta+z');

    await expect(window.locator('#cell-0-0')).toHaveText('', { timeout: 3000 });
  });

  // AC2: Undo cell deletion (Delete key → backend ClearRange)
  test('Cmd+Z restores a deleted cell value', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'restore-me');
    await expect(window.locator('#cell-0-0')).toHaveText('restore-me');

    // Select and delete via Delete key
    await window.locator('#cell-0-0').click();
    await window.keyboard.press('Delete');

    await expect(window.locator('#cell-0-0')).toHaveText('', { timeout: 3000 });

    // Undo — value should be restored
    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-0')).toHaveText('restore-me', {
      timeout: 3000,
    });
  });

  // AC3: Sequential undo reverses in order
  test('Cmd+Z repeatedly undoes multiple edits in reverse order', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'first');
    await setCellViaApi(window, 0, 0, 'second');
    await expect(window.locator('#cell-0-0')).toHaveText('second');

    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-0')).toHaveText('first', {
      timeout: 3000,
    });

    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-0')).toHaveText('', { timeout: 3000 });
  });

  // AC4: Redo via Cmd+Shift+Z
  test('Cmd+Shift+Z redoes an undone edit', async ({ window }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-0')).toHaveText('', { timeout: 3000 });

    await window.keyboard.press('Meta+Shift+z');
    await expect(window.locator('#cell-0-0')).toHaveText('hello', {
      timeout: 3000,
    });
  });

  // AC5 / AC7: Edit menu Undo item disabled on fresh sheet
  test('Edit menu Undo is disabled on fresh sheet, enabled after edit', async ({
    electronApp,
    window,
  }) => {
    // Fresh sheet — undo should be disabled
    const undoEnabledBefore = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((i) => i.label === 'Edit');
      const undoItem = editMenu?.submenu.items.find((i) => i.id === 'undo');
      return undoItem?.enabled ?? null;
    });
    expect(undoEnabledBefore).toBe(false);

    // Make an edit via the API, then trigger undo state update via keyboard shortcut
    // (which calls performUndo internally, but we want just an edit then check)
    await setCellViaApi(window, 0, 0, 'x');

    // The menu state updates when undo/redo is triggered or when a cell is set via UI.
    // Use the API directly and manually trigger applyUndoRedoState via evaluate.
    await window.evaluate(async () => {
      // Undo the set — after this canRedo=true, canUndo=false
      await fetch('/api/undo', { method: 'POST' });
      // Re-set so we get canUndo=true
      await fetch('/api/redo', { method: 'POST' });
    });

    // Now set a cell via the UI to trigger the menu state update path
    const cell = window.locator('#cell-1-0');
    await cell.click();
    await cell.dblclick();
    await waitForEditModeReady(window);
    await window.keyboard.type('test');
    await window.keyboard.press('Enter');

    // Wait for undo button to become enabled (proxy for menu state update)
    await expect(window.locator('#undo-btn')).toBeEnabled({ timeout: 3000 });

    const undoEnabledAfter = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const editMenu = menu.items.find((i) => i.label === 'Edit');
      const undoItem = editMenu?.submenu.items.find((i) => i.id === 'undo');
      return undoItem?.enabled ?? null;
    });
    expect(undoEnabledAfter).toBe(true);
  });

  // AC6 / AC7: Undo/Redo toolbar buttons disabled on fresh sheet
  test('Undo/Redo toolbar buttons are disabled on fresh sheet', async ({
    window,
  }) => {
    await expect(window.locator('#undo-btn')).toBeDisabled();
    await expect(window.locator('#redo-btn')).toBeDisabled();
  });

  // AC6: Toolbar undo button enabled after edit, redo enabled after undo
  test('Undo toolbar button enables after edit; Redo enables after undo', async ({
    window,
  }) => {
    // Use UI editing so applyUndoRedoState runs
    const cell = window.locator('#cell-0-0');
    await cell.click();
    await cell.dblclick();
    await waitForEditModeReady(window);
    await window.keyboard.type('hello');
    await window.keyboard.press('Enter');

    await expect(window.locator('#undo-btn')).toBeEnabled({ timeout: 3000 });
    await expect(window.locator('#redo-btn')).toBeDisabled();

    // Undo via toolbar button
    await window.locator('#undo-btn').click();
    await expect(window.locator('#cell-0-0')).toHaveText('', { timeout: 3000 });
    await expect(window.locator('#undo-btn')).toBeDisabled({ timeout: 3000 });
    await expect(window.locator('#redo-btn')).toBeEnabled({ timeout: 3000 });

    // Redo via toolbar button
    await window.locator('#redo-btn').click();
    await expect(window.locator('#cell-0-0')).toHaveText('hello', {
      timeout: 3000,
    });
    await expect(window.locator('#undo-btn')).toBeEnabled({ timeout: 3000 });
    await expect(window.locator('#redo-btn')).toBeDisabled({ timeout: 3000 });
  });

  // File status returns to "Saved" when undo reverts to the last-saved state
  test('file status shows Saved after undo reverts all changes on a new sheet', async ({
    window,
  }) => {
    // Fresh sheet starts as Saved
    await expect(window.locator('#file-status')).toContainText('Saved');

    // Make an edit — should become Unsaved
    const cell = window.locator('#cell-0-0');
    await cell.click();
    await cell.dblclick();
    await waitForEditModeReady(window);
    await window.keyboard.type('hello');
    await window.keyboard.press('Enter');
    await expect(window.locator('#undo-btn')).toBeEnabled({ timeout: 3000 });
    await expect(window.locator('#file-status')).toContainText('Unsaved');

    // Undo — should revert to Saved
    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-0')).toHaveText('', { timeout: 3000 });
    await expect(window.locator('#file-status')).toContainText('Saved', {
      timeout: 3000,
    });
  });

  // AC7: Cmd+Z does nothing when history is empty (no crash, no state change)
  test('Cmd+Z is a no-op on empty history', async ({ window }) => {
    // Fresh sheet — pressing Cmd+Z should not crash or alter anything
    await window.keyboard.press('Meta+z');
    await expect(window.locator('#cell-0-0')).toHaveText('');
    await expect(window.locator('#undo-btn')).toBeDisabled();
  });

  // HTTP API + UI state tests
  test('POST /api/undo on empty stack: undo/redo buttons stay disabled', async ({
    window,
  }) => {
    const json = await apiUndo(window);
    expect(json.success).toBe(true);
    expect(json.data.canUndo).toBe(false);
    expect(json.data.canRedo).toBe(false);

    // UI: toolbar buttons must reflect the empty undo stack
    await window.evaluate(
      (data) => window.applyUndoRedoState?.(data),
      json.data
    );
    await expect(window.locator('#undo-btn')).toBeDisabled();
    await expect(window.locator('#redo-btn')).toBeDisabled();
  });

  test('POST /api/undo after edit: cell cleared and redo button enabled', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await expect(window.locator('#cell-0-0')).toHaveText('hello');

    const json = await apiUndo(window);
    expect(json.success).toBe(true);
    expect(json.data.canUndo).toBe(false);
    expect(json.data.canRedo).toBe(true);
    expect(json.data.redoDescription).toContain('A1');

    // UI: cell must be cleared and redo button enabled
    await window.evaluate(
      (data) => window.applyUndoRedoState?.(data),
      json.data
    );
    await window.evaluate(() => window.refreshAllCells?.());
    await expect(window.locator('#cell-0-0')).toHaveText('', { timeout: 3000 });
    await expect(window.locator('#redo-btn')).toBeEnabled({ timeout: 3000 });
    await expect(window.locator('#undo-btn')).toBeDisabled();
  });

  test('POST /api/redo re-applies undone edit: cell shows value', async ({
    window,
  }) => {
    await setCellViaApi(window, 0, 0, 'hello');
    await apiUndo(window);
    const json = await apiRedo(window);
    expect(json.success).toBe(true);
    expect(json.data.canUndo).toBe(true);
    expect(json.data.canRedo).toBe(false);

    // UI: cell must display the re-applied value
    await window.evaluate(
      (data) => window.applyUndoRedoState?.(data),
      json.data
    );
    await window.evaluate(() => window.refreshAllCells?.());
    await expect(window.locator('#cell-0-0')).toHaveText('hello', {
      timeout: 3000,
    });
    await expect(window.locator('#undo-btn')).toBeEnabled({ timeout: 3000 });
    await expect(window.locator('#redo-btn')).toBeDisabled();
  });
});
