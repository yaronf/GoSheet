// Epic 20: Agentic API Access Layer
// Tests: bootstrap token flow, agent token issuance, read endpoints,
//        patch endpoint, commit/rollback, session lifecycle.
//
// NODE_ENV=test disables auth server-side, so no token is needed for
// most calls. We still test that the session lifecycle and operations
// work end-to-end via the HTTP API.

const { test, expect } = require('./fixtures');
const { ensureSpreadsheetView } = require('./helpers');

// Helper: make a fetch call from the renderer context
async function apiFetch(window, method, path, body = null) {
  return window.evaluate(
    async ({ method, path, body }) => {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body !== null) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      let json;
      try {
        json = await res.json();
      } catch {
        json = {};
      }
      return { status: res.status, json };
    },
    { method, path, body }
  );
}

// Helper: make an authenticated fetch call using the agent token
async function agentFetch(window, method, path, token, body = null) {
  return window.evaluate(
    async ({ method, path, token, body }) => {
      const opts = {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      };
      if (body !== null) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      let json;
      try {
        json = await res.json();
      } catch {
        json = {};
      }
      return { status: res.status, json };
    },
    { method, path, token, body }
  );
}

test.describe('Agent API (Epic 20)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ window }) => {
    await ensureSpreadsheetView(window);

    // End any active agent session before resetting the sheet
    await apiFetch(window, 'POST', '/api/agent/session/end');

    // Reset to clean spreadsheet via API (avoids race: new-btn click is async)
    await apiFetch(window, 'POST', '/api/file/new');

    // Sync UI: click new-btn in case it shows modal, then ensure grid visible
    await window.locator('#new-btn').click();
    const modal = window.locator('#modal-overlay');
    if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await window.locator('#modal-ok').click();
      await expect(modal).toBeHidden({ timeout: 5000 });
    }
    await expect(window.locator('#cell-0-0')).toBeVisible({ timeout: 10000 });
  });

  // ── 20.2: Session lifecycle ───────────────────────────────────────────────

  test('issue agent token opens a session', async ({ window }) => {
    const { status, json } = await apiFetch(
      window,
      'POST',
      '/api/agent/token',
      { scope: 'rw' }
    );
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.agentToken).toBeTruthy();
    expect(json.agentId).toMatch(/^agt_/);

    // Session status should now be active
    const { json: statusJson } = await apiFetch(
      window,
      'GET',
      '/api/agent/session/status'
    );
    expect(statusJson.active).toBe(true);
    expect(statusJson.scope).toBe('rw');

    // Cleanup
    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('409 when issuing token while session active', async ({ window }) => {
    await apiFetch(window, 'POST', '/api/agent/token', { scope: 'rw' });

    const { status, json } = await apiFetch(
      window,
      'POST',
      '/api/agent/token',
      { scope: 'ro' }
    );
    expect(status).toBe(409);
    expect(json.success).toBe(false);

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('admin end session clears active session', async ({ window }) => {
    await apiFetch(window, 'POST', '/api/agent/token', { scope: 'rw' });

    const { status } = await apiFetch(window, 'POST', '/api/agent/session/end');
    expect(status).toBe(200);

    const { json } = await apiFetch(window, 'GET', '/api/agent/session/status');
    expect(json.active).toBe(false);
  });

  // ── 20.3: Read endpoints ──────────────────────────────────────────────────

  test('workbook endpoint returns summary', async ({ window }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'ro',
    });
    const token = json.agentToken;

    const { status: wbStatus, json: wbJson } = await window.evaluate(
      async ({ token }) => {
        const res = await fetch('/api/agent/workbook', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return { status: res.status, json: await res.json() };
      },
      { token }
    );
    expect(wbStatus).toBe(200);
    expect(wbJson.success).toBe(true);
    expect(wbJson.workbook).toBeDefined();
    expect(wbJson.workbook.dimensions).toBeDefined();

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('range endpoint returns cell data', async ({ window }) => {
    // Issue token first, then set cell via agent patch (avoids /api/cell/set race with new-sheet reset)
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    // Pre-populate a cell using the agent patch (synchronous, no DOM race)
    await agentFetch(window, 'POST', '/api/agent/patch', token, {
      ops: [{ op: 'SetCell', row: 0, col: 0, value: 'Hello' }],
    });

    const { status, json: rangeJson } = await window.evaluate(
      async ({ token }) => {
        const res = await fetch('/api/agent/range?range=A1:B2', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return { status: res.status, json: await res.json() };
      },
      { token }
    );
    expect(status).toBe(200);
    expect(rangeJson.success).toBe(true);
    expect(rangeJson.cells).toHaveLength(4); // 2x2
    const a1 = rangeJson.cells.find((c) => c.ref === 'A1');
    expect(a1).toBeDefined();
    expect(a1.computed).toBe('Hello');

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('range endpoint rejects oversized range', async ({ window }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'ro',
    });
    const token = json.agentToken;

    // 200 rows × 100 cols = 20,000 cells > 10,000 cap
    const { status, json: rangeJson } = await window.evaluate(
      async ({ token }) => {
        const res = await fetch('/api/agent/range?range=A1:CV200', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return { status: res.status, json: await res.json() };
      },
      { token }
    );
    expect(status).toBe(400);
    expect(rangeJson.success).toBe(false);
    expect(rangeJson.error).toMatch(/too large/);

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  // ── 20.4: Patch endpoint ──────────────────────────────────────────────────

  test('patch SetCell applies value and is reflected in grid', async ({
    window,
  }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    const { status, json: patchJson } = await window.evaluate(
      async ({ token }) => {
        const res = await fetch('/api/agent/patch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            description: 'test patch',
            ops: [{ op: 'SetCell', row: 1, col: 1, value: 'Patched' }],
          }),
        });
        return { status: res.status, json: await res.json() };
      },
      { token }
    );
    expect(status).toBe(200);
    expect(patchJson.success).toBe(true);
    expect(patchJson.opsCount).toBe(1);

    // Verify via cell/value API
    const { json: cellJson } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=1&col=1'
    );
    expect(cellJson.data?.computed).toBe('Patched');

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('patch rejects unknown op', async ({ window }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    const { status, json: patchJson } = await window.evaluate(
      async ({ token }) => {
        const res = await fetch('/api/agent/patch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ops: [{ op: 'DoSomethingWild' }],
          }),
        });
        return { status: res.status, json: await res.json() };
      },
      { token }
    );
    expect(status).toBe(400);
    expect(patchJson.success).toBe(false);

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('read-only token cannot patch', async ({ window }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'ro',
    });
    const token = json.agentToken;

    const { status, json: patchJson } = await window.evaluate(
      async ({ token }) => {
        const res = await fetch('/api/agent/patch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ops: [{ op: 'SetCell', row: 0, col: 0, value: 'Blocked' }],
          }),
        });
        return { status: res.status, json: await res.json() };
      },
      { token }
    );
    expect(status).toBe(403);
    expect(patchJson.success).toBe(false);

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  // ── 20.2: Commit + undo integration ──────────────────────────────────────

  test('commit collapses agent ops into user history as single undo', async ({
    window,
  }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    // Patch two cells
    await window.evaluate(
      async ({ token }) => {
        await fetch('/api/agent/patch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            description: 'two cells',
            ops: [
              { op: 'SetCell', row: 0, col: 0, value: 'A' },
              { op: 'SetCell', row: 0, col: 1, value: 'B' },
            ],
          }),
        });
      },
      { token }
    );

    // Commit
    const { status: commitStatus } = await window.evaluate(
      async ({ token }) => {
        const res = await fetch('/api/agent/commit', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        return { status: res.status };
      },
      { token }
    );
    expect(commitStatus).toBe(200);

    // End session
    await apiFetch(window, 'POST', '/api/agent/session/end');

    // Values should be set
    const { json: cellA } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=0&col=0'
    );
    expect(cellA.data?.computed).toBe('A');

    // Undo once → both cells cleared (single undo entry from agent commit)
    const { json: undoJson } = await apiFetch(window, 'POST', '/api/undo');
    expect(undoJson.success).toBe(true);

    const { json: cellAAfter } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=0&col=0'
    );
    expect(cellAAfter.data?.computed ?? '').toBe('');
    const { json: cellBAfter } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=0&col=1'
    );
    expect(cellBAfter.data?.computed ?? '').toBe('');
  });

  test('rollback reverts patch and revokes token', async ({ window }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    // Set a cell via patch
    await window.evaluate(
      async ({ token }) => {
        await fetch('/api/agent/patch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ops: [{ op: 'SetCell', row: 2, col: 0, value: 'WillBeRolledBack' }],
          }),
        });
      },
      { token }
    );

    // Confirm value is set
    const { json: before } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=2&col=0'
    );
    expect(before.data?.computed).toBe('WillBeRolledBack');

    // Rollback
    const { status: rollbackStatus } = await window.evaluate(
      async ({ token }) => {
        const res = await fetch('/api/agent/rollback', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        return { status: res.status };
      },
      { token }
    );
    expect(rollbackStatus).toBe(200);

    // Value should be gone
    const { json: after } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=2&col=0'
    );
    expect(after.data?.computed ?? '').toBe('');

    // Session should be gone
    const { json: statusJson } = await apiFetch(
      window,
      'GET',
      '/api/agent/session/status'
    );
    expect(statusJson.active).toBe(false);
  });

  // ── 20.5: Bootstrap endpoint ──────────────────────────────────────────────

  test('bootstrap endpoint returns tools and workbook', async ({ window }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    const { status, json: bootJson } = await window.evaluate(
      async ({ token }) => {
        const res = await fetch(
          `/api/agent/bootstrap?token=${encodeURIComponent(token)}`
        );
        return { status: res.status, json: await res.json() };
      },
      { token }
    );
    expect(status).toBe(200);
    expect(bootJson.success).toBe(true);
    expect(bootJson.tools).toBeDefined();
    expect(Array.isArray(bootJson.tools)).toBe(true);
    expect(bootJson.tools.length).toBeGreaterThan(0);
    expect(bootJson.workbook).toBeDefined();
    expect(bootJson.session).toBeDefined();
    expect(bootJson.session.scope).toBe('rw');

    // Verify tool names match expected set
    const toolNames = bootJson.tools.map((t) => t.name);
    expect(toolNames).toContain('apply_patch');
    expect(toolNames).toContain('get_range');
    expect(toolNames).toContain('get_workbook');
    expect(toolNames).toContain('commit');
    expect(toolNames).toContain('end_session');
    expect(toolNames).toContain('rollback');

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('bootstrap endpoint also accepts Bearer header', async ({ window }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'ro',
    });
    const token = json.agentToken;

    const { status, json: bootJson } = await agentFetch(
      window,
      'GET',
      '/api/agent/bootstrap',
      token
    );
    expect(status).toBe(200);
    expect(bootJson.success).toBe(true);
    expect(bootJson.session.scope).toBe('ro');

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  // ── 20.1: Auth middleware (test-mode bypass) ──────────────────────────────

  test('test mode: requests succeed without Authorization header', async ({
    window,
  }) => {
    // NODE_ENV=test disables auth — all existing API calls work without a token.
    // This test verifies the bypass is active so the full test suite keeps running.
    const { status, json } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=0&col=0'
    );
    expect(status).toBe(200);
    expect(json.success).toBe(true);
  });

  test('test mode: agent endpoints accessible without bootstrap token', async ({
    window,
  }) => {
    // In test mode agent token issuance requires no auth header.
    const { status, json } = await apiFetch(
      window,
      'POST',
      '/api/agent/token',
      { scope: 'rw' }
    );
    expect(status).toBe(200);
    expect(json.agentToken).toBeTruthy();
    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('agent token rejected on file endpoint', async ({ window }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    // Agent token should be blocked on /api/file/* even with valid token.
    // In test mode the middleware still enforces agent-token file-op block.
    const { status } = await agentFetch(
      window,
      'GET',
      '/api/file/status',
      token
    );
    expect(status).toBe(403);

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  // ── 20.4: Additional patch ops ────────────────────────────────────────────

  test('patch InsertRow shifts existing data down', async ({ window }) => {
    // Put data in row 0
    await apiFetch(window, 'POST', '/api/cell/set', {
      row: 0,
      col: 0,
      value: 'Top',
    });

    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    const { status } = await agentFetch(
      window,
      'POST',
      '/api/agent/patch',
      token,
      {
        ops: [{ op: 'InsertRow', row: 0 }],
      }
    );
    expect(status).toBe(200);

    // Original row 0 content should now be in row 1
    const { json: cell } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=1&col=0'
    );
    expect(cell.data?.computed).toBe('Top');

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('patch DeleteRow removes row and shifts data up', async ({ window }) => {
    await apiFetch(window, 'POST', '/api/cell/set', {
      row: 0,
      col: 0,
      value: 'Keep',
    });
    await apiFetch(window, 'POST', '/api/cell/set', {
      row: 1,
      col: 0,
      value: 'Delete',
    });
    await apiFetch(window, 'POST', '/api/cell/set', {
      row: 2,
      col: 0,
      value: 'After',
    });

    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    const { status } = await agentFetch(
      window,
      'POST',
      '/api/agent/patch',
      token,
      {
        ops: [{ op: 'DeleteRow', row: 1 }],
      }
    );
    expect(status).toBe(200);

    const { json: cell } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=1&col=0'
    );
    expect(cell.data?.computed).toBe('After');

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('patch ClearRange clears multiple cells', async ({ window }) => {
    await apiFetch(window, 'POST', '/api/cell/set', {
      row: 0,
      col: 0,
      value: 'A',
    });
    await apiFetch(window, 'POST', '/api/cell/set', {
      row: 0,
      col: 1,
      value: 'B',
    });

    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    const { status } = await agentFetch(
      window,
      'POST',
      '/api/agent/patch',
      token,
      {
        ops: [
          { op: 'ClearRange', startRow: 0, startCol: 0, endRow: 0, endCol: 1 },
        ],
      }
    );
    expect(status).toBe(200);

    const { json: cellA } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=0&col=0'
    );
    expect(cellA.data?.computed ?? '').toBe('');
    const { json: cellB } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=0&col=1'
    );
    expect(cellB.data?.computed ?? '').toBe('');

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('patch AddStyle creates a named style', async ({ window }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    const { status, json: patchJson } = await agentFetch(
      window,
      'POST',
      '/api/agent/patch',
      token,
      {
        description: 'add highlight style',
        ops: [
          {
            op: 'AddStyle',
            name: 'Highlight',
            fontColor: '#fff',
            fillColor: '#e74c3c',
          },
        ],
      }
    );
    expect(status).toBe(200);
    expect(patchJson.opsCount).toBe(1);

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  test('patch validation: invalid op returns failingOpIdx', async ({
    window,
  }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    const { status, json: patchJson } = await agentFetch(
      window,
      'POST',
      '/api/agent/patch',
      token,
      {
        ops: [
          { op: 'SetCell', row: 0, col: 0, value: 'ok' },
          { op: 'BogusOp' },
        ],
      }
    );
    expect(status).toBe(400);
    expect(patchJson.failingOpIdx).toBe(1);

    // First op should NOT have been applied (two-pass validation)
    const { json: cell } = await apiFetch(
      window,
      'GET',
      '/api/cell/value?row=0&col=0'
    );
    expect(cell.data?.computed ?? '').toBe('');

    await apiFetch(window, 'POST', '/api/agent/session/end');
  });

  // ── 20.6: Session status endpoint (API-level; UI hidden in test mode) ──────

  test('session status reflects active/inactive correctly', async ({
    window,
  }) => {
    // Inactive state
    const { json: before } = await apiFetch(
      window,
      'GET',
      '/api/agent/session/status'
    );
    expect(before.active).toBe(false);
    expect(before.agentId).toBeUndefined();

    // Open session
    const { json: issued } = await apiFetch(
      window,
      'POST',
      '/api/agent/token',
      { scope: 'ro' }
    );
    expect(issued.agentId).toMatch(/^agt_/);

    // Active state — token not returned by status endpoint
    const { json: during } = await apiFetch(
      window,
      'GET',
      '/api/agent/session/status'
    );
    expect(during.active).toBe(true);
    expect(during.agentId).toBe(issued.agentId);
    expect(during.scope).toBe('ro');
    expect(during.agentToken).toBeUndefined(); // secret — never in status response

    // End and check inactive again
    await apiFetch(window, 'POST', '/api/agent/session/end');
    const { json: after } = await apiFetch(
      window,
      'GET',
      '/api/agent/session/status'
    );
    expect(after.active).toBe(false);
  });

  test('revoked token returns 401 on subsequent calls', async ({ window }) => {
    const { json } = await apiFetch(window, 'POST', '/api/agent/token', {
      scope: 'rw',
    });
    const token = json.agentToken;

    // End session — token is now revoked
    await agentFetch(window, 'POST', '/api/agent/end', token);

    // Subsequent use of revoked token should be rejected
    const { status } = await agentFetch(
      window,
      'GET',
      '/api/agent/workbook',
      token
    );
    expect(status).toBe(401);
  });
});
