// Story 18.1: Click-to-Insert Cell Reference While Editing Formula

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView } = require('./helpers');

test.describe('Click-to-insert cell reference (Story 18.1)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ window }) => {
    // Cancel any in-progress edit
    await window.evaluate(() => {
      const input = document.querySelector('.cell-editor');
      if (input)
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
    });
    // Dismiss any active modal/alert from a previous test (may appear async after test ends)
    const modal = window.locator('#modal-overlay.active');
    if (await modal.isVisible({ timeout: 500 }).catch(() => false)) {
      await window.locator('#modal-ok').click();
      await expect(modal).toBeHidden({ timeout: 2000 });
    }
    await ensureSpreadsheetView(window);
    const newBtn = window.locator('#new-btn');
    await newBtn.click();
    const newModal = window.locator('#modal-overlay');
    if (await newModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await window.locator('#modal-ok').click();
      await expect(newModal).toBeHidden();
    }
    await expect(window.locator('#cell-0-0')).toBeVisible();
  });

  // AC1: Click another cell while editing a formula inserts its reference
  test('click cell while editing formula inserts reference and stays in edit mode', async ({
    window,
  }) => {
    // Start editing A1 with a formula
    await window.locator('#cell-0-0').dblclick();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor') !== null
    );
    const editor = window.locator('.cell-editor');
    await editor.fill('=');

    // Click cell B2 (row=1, col=1)
    await window.locator('#cell-1-1').click();

    // Editor should still be present and have =B2
    await window.waitForFunction(
      () => document.querySelector('.cell-editor')?.value === '=B2',
      { timeout: 2000 }
    );
    await expect(editor).toBeVisible();
    expect(await editor.inputValue()).toBe('=B2');
  });

  // AC2: Clicking a second cell replaces the previous reference
  test('clicking second cell replaces previous reference', async ({
    window,
  }) => {
    await window.locator('#cell-0-0').dblclick();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor') !== null
    );
    const editor = window.locator('.cell-editor');
    await editor.fill('=');

    // Click B2
    await window.locator('#cell-1-1').click();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor')?.value === '=B2',
      { timeout: 2000 }
    );

    // Click C3 — should replace B2 with C3
    await window.locator('#cell-2-2').click();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor')?.value === '=C3',
      { timeout: 2000 }
    );
    expect(await editor.inputValue()).toBe('=C3');
  });

  // AC2: If user typed after the ref, next click appends
  test('click after typing operator appends new reference', async ({
    window,
  }) => {
    await window.locator('#cell-0-0').dblclick();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor') !== null
    );
    const editor = window.locator('.cell-editor');
    await editor.fill('=');

    // Click B2
    await window.locator('#cell-1-1').click();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor')?.value === '=B2',
      { timeout: 2000 }
    );

    // Type a '+' — moves cursor past the ref span
    await editor.press('+');
    await window.waitForFunction(
      () => document.querySelector('.cell-editor')?.value === '=B2+',
      { timeout: 2000 }
    );

    // Click C3 — should append C3 after the +
    await window.locator('#cell-2-2').click();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor')?.value === '=B2+C3',
      { timeout: 2000 }
    );
    expect(await editor.inputValue()).toBe('=B2+C3');
  });

  // AC3: Plain-text edit — cell click commits and navigates, no ref insertion
  test('plain-text edit: click other cell commits and navigates normally', async ({
    window,
  }) => {
    // Start editing A1 with plain text (no =)
    await window.locator('#cell-0-0').dblclick();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor') !== null
    );
    const editor = window.locator('.cell-editor');
    await editor.fill('plaintext');

    // Click B2 — should commit A1 and navigate to B2, NOT insert a ref.
    // The click triggers saveCurrentEditOnCellSwitch synchronously, so
    // the editor is removed before the click handler returns.
    await window.locator('#cell-1-1').click();

    // Wait for: editor gone AND A1 saved with 'plaintext' value
    await window.waitForFunction(
      () =>
        document.querySelector('.cell-editor') === null &&
        document.querySelector('#cell-0-0')?.textContent === 'plaintext',
      { timeout: 4000 }
    );

    // B2 should now be selected
    await window.waitForFunction(
      () => document.querySelector('#cell-1-1')?.classList.contains('selected'),
      { timeout: 3000 }
    );
  });

  // AC4: Formula evaluates correctly after click-insert
  test('formula evaluates correctly after click-insert and commit', async ({
    window,
  }) => {
    // Put 42 in B1 via UI to avoid racing with async operations from prior test
    await window.locator('#cell-0-1').dblclick();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor') !== null
    );
    await window.locator('.cell-editor').fill('42');
    await window.locator('.cell-editor').press('Enter');
    await window.waitForFunction(
      () => document.querySelector('#cell-0-1')?.textContent === '42',
      { timeout: 3000 }
    );

    // Edit A1: type '=' then click B1
    await window.locator('#cell-0-0').dblclick();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor') !== null
    );
    const editor = window.locator('.cell-editor');
    await editor.fill('=');

    await window.locator('#cell-0-1').click();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor')?.value === '=B1',
      { timeout: 2000 }
    );

    // Commit with Enter — finishEditing is synchronous for the editor removal
    // but SetCellValue + refreshAllCells are async. Wait for both.
    await editor.press('Enter');
    await window.waitForFunction(
      () =>
        document.querySelector('.cell-editor') === null &&
        document.querySelector('#cell-0-0')?.textContent === '42',
      { timeout: 5000 }
    );
    expect(await window.locator('#cell-0-0').textContent()).toBe('42');
  });

  // AC5: Formula bar click also inserts reference
  test('formula bar focus: clicking cell inserts reference in formula bar', async ({
    window,
  }) => {
    // Select A1
    await window.locator('#cell-0-0').click();

    // Focus the formula bar and type '=' — use type() to keep focus
    const formulaBar = window.locator('#formula-bar');
    await formulaBar.click();
    await formulaBar.pressSequentially('=');

    // Confirm formula bar is focused and has '='
    await window.waitForFunction(
      () =>
        document.activeElement?.id === 'formula-bar' &&
        document.getElementById('formula-bar')?.value === '=',
      { timeout: 2000 }
    );

    // Click B2
    await window.locator('#cell-1-1').click();

    // Formula bar should contain =B2
    await window.waitForFunction(
      () => document.getElementById('formula-bar')?.value === '=B2',
      { timeout: 2000 }
    );
    expect(await formulaBar.inputValue()).toBe('=B2');
  });

  // AC4 (Tab variant): Tab-commit also evaluates correctly after click-insert
  // NOTE: kept last — Tab commit leaves a setTimeout(100)->selectCell->loadCells
  // async chain running; placing it last prevents it from crashing the next test.
  test('Tab-commit evaluates correctly after click-insert', async ({
    window,
  }) => {
    // Put 7 in C1 via UI
    await window.locator('#cell-0-2').dblclick();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor') !== null
    );
    await window.locator('.cell-editor').fill('7');
    await window.locator('.cell-editor').press('Enter');
    await window.waitForFunction(
      () => document.querySelector('#cell-0-2')?.textContent === '7',
      { timeout: 3000 }
    );

    // Edit A1: type '=' then click C1
    await window.locator('#cell-0-0').dblclick();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor') !== null
    );
    await window.locator('.cell-editor').fill('=');
    await window.locator('#cell-0-2').click();
    await window.waitForFunction(
      () => document.querySelector('.cell-editor')?.value === '=C1',
      { timeout: 2000 }
    );

    // Commit with Tab — wait for editor gone and A1='7' (formula evaluated)
    await window.locator('.cell-editor').press('Tab');
    await window.waitForFunction(
      () =>
        document.querySelector('.cell-editor') === null &&
        document.querySelector('#cell-0-0')?.textContent === '7',
      { timeout: 5000 }
    );
    expect(await window.locator('#cell-0-0').textContent()).toBe('7');
  });
});
