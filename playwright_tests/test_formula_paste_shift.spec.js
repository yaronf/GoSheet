// Story 19.1: Formula Reference Shift on Paste

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

/**
 * Read the raw cell value (formula or text) via API.
 */
async function getRawValue(window, row, col) {
  return window.evaluate(
    async ({ row, col }) => {
      const res = await fetch(`/api/cell/raw?row=${row}&col=${col}`);
      const json = await res.json();
      return json.data?.value ?? '';
    },
    { row, col }
  );
}

/**
 * Trigger copy via Electron menu.
 */
async function menuCopy(electronApp) {
  await electronApp.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const editMenu = menu.items.find((item) => item.label === 'Edit');
    const copyItem = editMenu?.submenu?.items?.find(
      (item) => item.label === 'Copy'
    );
    copyItem?.click?.();
  });
}

/**
 * Trigger paste via Electron menu.
 */
async function menuPaste(electronApp) {
  await electronApp.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const editMenu = menu.items.find((item) => item.label === 'Edit');
    const pasteItem = editMenu?.submenu?.items?.find(
      (item) => item.label === 'Paste'
    );
    pasteItem?.click?.();
  });
}

test.describe('Formula reference shift on paste (Story 19.1)', () => {
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
    // Clear clipboard between tests
    await window.evaluate(async () => {
      await navigator.clipboard.writeText('');
    });
  });

  test('AC1: single cell formula shifts down on paste', async ({
    electronApp,
    window,
  }) => {
    // A1 = =B1+C1
    await setCellViaApi(window, 0, 0, '=B1+C1');

    // Copy A1
    await window.locator('#cell-0-0').click();
    await menuCopy(electronApp);

    // Wait for clipboard to contain the formula
    await window.waitForFunction(
      async () => {
        const t = await navigator.clipboard.readText();
        return t.startsWith('=');
      },
      null,
      { timeout: 5000 }
    );

    // Paste into A2
    await window.locator('#cell-1-0').click();
    await menuPaste(electronApp);

    // A2 should have =B2+C2
    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cell/raw?row=1&col=0');
        const j = await res.json();
        return j.data?.value === '=B2+C2';
      },
      null,
      { timeout: 5000 }
    );

    const raw = await getRawValue(window, 1, 0);
    expect(raw).toBe('=B2+C2');
  });

  test('AC2: single cell formula shifts right on paste', async ({
    electronApp,
    window,
  }) => {
    // A1 = =B1+C1
    await setCellViaApi(window, 0, 0, '=B1+C1');

    // Copy A1
    await window.locator('#cell-0-0').click();
    await menuCopy(electronApp);
    await window.waitForFunction(
      async () => {
        const t = await navigator.clipboard.readText();
        return t.startsWith('=');
      },
      null,
      { timeout: 5000 }
    );

    // Paste into B1
    await window.locator('#cell-0-1').click();
    await menuPaste(electronApp);

    // B1 should have =C1+D1
    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cell/raw?row=0&col=1');
        const j = await res.json();
        return j.data?.value === '=C1+D1';
      },
      null,
      { timeout: 5000 }
    );

    const raw = await getRawValue(window, 0, 1);
    expect(raw).toBe('=C1+D1');
  });

  test('AC3: range paste shifts each formula independently', async ({
    electronApp,
    window,
  }) => {
    // A1:A3 = =B1, =B2, =B3
    await setCellViaApi(window, 0, 0, '=B1');
    await setCellViaApi(window, 1, 0, '=B2');
    await setCellViaApi(window, 2, 0, '=B3');

    // Select A1:A3 via Shift-click
    await window.locator('#cell-0-0').click();
    await window.locator('#cell-2-0').click({ modifiers: ['Shift'] });
    await menuCopy(electronApp);

    // Wait for multi-row TSV in clipboard
    await window.waitForFunction(
      async () => {
        const t = await navigator.clipboard.readText();
        return t.includes('\n');
      },
      null,
      { timeout: 5000 }
    );

    // Paste into C1 (colOffset=2, rowOffset=0)
    await window.locator('#cell-0-2').click();
    await menuPaste(electronApp);

    // C1:C3 should have =D1, =D2, =D3
    await window.waitForFunction(
      async () => {
        const r0 = await fetch('/api/cell/raw?row=0&col=2').then((r) =>
          r.json()
        );
        const r1 = await fetch('/api/cell/raw?row=1&col=2').then((r) =>
          r.json()
        );
        const r2 = await fetch('/api/cell/raw?row=2&col=2').then((r) =>
          r.json()
        );
        return (
          r0.data?.value === '=D1' &&
          r1.data?.value === '=D2' &&
          r2.data?.value === '=D3'
        );
      },
      null,
      { timeout: 5000 }
    );

    expect(await getRawValue(window, 0, 2)).toBe('=D1');
    expect(await getRawValue(window, 1, 2)).toBe('=D2');
    expect(await getRawValue(window, 2, 2)).toBe('=D3');
  });

  test('AC6: plain text paste is unchanged', async ({
    electronApp,
    window,
  }) => {
    // A1 = plain text
    await setCellViaApi(window, 0, 0, 'hello');

    await window.locator('#cell-0-0').click();
    await menuCopy(electronApp);
    await window.waitForFunction(
      async () => {
        const t = await navigator.clipboard.readText();
        return t === 'hello';
      },
      null,
      { timeout: 5000 }
    );

    await window.locator('#cell-1-1').click();
    await menuPaste(electronApp);

    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cell/raw?row=1&col=1');
        const j = await res.json();
        return j.data?.value === 'hello';
      },
      null,
      { timeout: 5000 }
    );

    const raw = await getRawValue(window, 1, 1);
    expect(raw).toBe('hello');
  });

  test('zero offset paste: formula unchanged', async ({
    electronApp,
    window,
  }) => {
    // A1 = =B1
    await setCellViaApi(window, 0, 0, '=B1');

    await window.locator('#cell-0-0').click();
    await menuCopy(electronApp);
    await window.waitForFunction(
      async () => {
        const t = await navigator.clipboard.readText();
        return t.startsWith('=');
      },
      null,
      { timeout: 5000 }
    );

    // Paste back to A1 (same location → zero offset)
    await window.locator('#cell-0-0').click();
    await menuPaste(electronApp);

    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cell/raw?row=0&col=0');
        const j = await res.json();
        return j.data?.value === '=B1';
      },
      null,
      { timeout: 5000 }
    );

    const raw = await getRawValue(window, 0, 0);
    expect(raw).toBe('=B1');
  });
});
