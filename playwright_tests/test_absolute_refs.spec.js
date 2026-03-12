// Story 19.2: Absolute Cell References ($-anchoring)

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView, setCellViaApi } = require('./helpers');

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

test.describe('Absolute cell references (Story 19.2)', () => {
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
    await window.evaluate(async () => {
      await navigator.clipboard.writeText('');
    });
  });

  test('AC1: $A$1 stays fixed when pasting down', async ({
    electronApp,
    window,
  }) => {
    // B1 = =$A$1+C1; paste to B2 → rowOffset=1
    // Expected: =$A$1+C2 ($A$1 fixed, C1 → C2)
    await setCellViaApi(window, 0, 1, '=$A$1+C1');

    await window.locator('#cell-0-1').click();
    await menuCopy(electronApp);
    await window.waitForFunction(
      async () => {
        const t = await navigator.clipboard.readText();
        return t.startsWith('=');
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
        return j.data?.value === '=$A$1+C2';
      },
      null,
      { timeout: 5000 }
    );

    const raw = await getRawValue(window, 1, 1);
    expect(raw).toBe('=$A$1+C2');
  });

  test('AC2: $A1 col anchored, row shifts', async ({ electronApp, window }) => {
    // B1 = =$A1; paste to C3 → rowOffset=2, colOffset=1
    // Expected: =$A3 (col A fixed, row 1→3)
    await setCellViaApi(window, 0, 1, '=$A1');

    await window.locator('#cell-0-1').click();
    await menuCopy(electronApp);
    await window.waitForFunction(
      async () => {
        const t = await navigator.clipboard.readText();
        return t.startsWith('=');
      },
      null,
      { timeout: 5000 }
    );

    await window.locator('#cell-2-2').click();
    await menuPaste(electronApp);

    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cell/raw?row=2&col=2');
        const j = await res.json();
        return j.data?.value === '=$A3';
      },
      null,
      { timeout: 5000 }
    );

    const raw = await getRawValue(window, 2, 2);
    expect(raw).toBe('=$A3');
  });

  test('AC3: A$1 row anchored, col shifts', async ({ electronApp, window }) => {
    // B1 = =A$1; paste to C3 → rowOffset=2, colOffset=1
    // Expected: =B$1 (row 1 fixed, col A→B)
    await setCellViaApi(window, 0, 1, '=A$1');

    await window.locator('#cell-0-1').click();
    await menuCopy(electronApp);
    await window.waitForFunction(
      async () => {
        const t = await navigator.clipboard.readText();
        return t.startsWith('=');
      },
      null,
      { timeout: 5000 }
    );

    await window.locator('#cell-2-2').click();
    await menuPaste(electronApp);

    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cell/raw?row=2&col=2');
        const j = await res.json();
        return j.data?.value === '=B$1';
      },
      null,
      { timeout: 5000 }
    );

    const raw = await getRawValue(window, 2, 2);
    expect(raw).toBe('=B$1');
  });

  test('AC5: formula with $ stored and displayed correctly', async ({
    window,
  }) => {
    // Type =$A$1 into A1 via API, verify raw value roundtrips correctly
    await setCellViaApi(window, 0, 0, '=$A$1');

    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cell/raw?row=0&col=0');
        const j = await res.json();
        return j.data?.value === '=$A$1';
      },
      null,
      { timeout: 5000 }
    );

    const raw = await getRawValue(window, 0, 0);
    expect(raw).toBe('=$A$1');
  });

  test('AC1 variant: $A$1 stays fixed when pasting right', async ({
    electronApp,
    window,
  }) => {
    // B1 = =$A$1+C1; paste to D1 → colOffset=2
    // Expected: =$A$1+E1 ($A$1 fixed, C1 col→E)
    await setCellViaApi(window, 0, 1, '=$A$1+C1');

    await window.locator('#cell-0-1').click();
    await menuCopy(electronApp);
    await window.waitForFunction(
      async () => {
        const t = await navigator.clipboard.readText();
        return t.startsWith('=');
      },
      null,
      { timeout: 5000 }
    );

    await window.locator('#cell-0-3').click();
    await menuPaste(electronApp);

    await window.waitForFunction(
      async () => {
        const res = await fetch('/api/cell/raw?row=0&col=3');
        const j = await res.json();
        return j.data?.value === '=$A$1+E1';
      },
      null,
      { timeout: 5000 }
    );

    const raw = await getRawValue(window, 0, 3);
    expect(raw).toBe('=$A$1+E1');
  });
});
