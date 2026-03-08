// Story 16.8: Unified Logging Tests
// Verifies renderer console-message level-aware forwarding behaviour.

const { test, expect } = require('./fixtures');

test.describe('Unified logging — renderer forwarding', () => {
  test('renderer console.error is captured as error level', async ({
    window,
  }) => {
    // Playwright's page.on('console') mirrors console-message events from the renderer.
    // We verify that console.error produces a ConsoleMessage with type 'error'.
    const errorMessages = [];
    window.on('console', (msg) => {
      if (msg.type() === 'error') errorMessages.push(msg.text());
    });

    await window.evaluate(() => console.error('test-error-16-8'));

    // Condition-based wait: poll until the message appears (no sleeps)
    await expect
      .poll(() => errorMessages.some((m) => m.includes('test-error-16-8')), {
        timeout: 5000,
      })
      .toBe(true);
  });

  test('renderer console.warn is captured as warning level', async ({
    window,
  }) => {
    const warnMessages = [];
    window.on('console', (msg) => {
      if (msg.type() === 'warning') warnMessages.push(msg.text());
    });

    await window.evaluate(() => console.warn('test-warn-16-8'));

    await expect
      .poll(() => warnMessages.some((m) => m.includes('test-warn-16-8')), {
        timeout: 5000,
      })
      .toBe(true);
  });

  test('renderer console.log is captured as log level', async ({ window }) => {
    const logMessages = [];
    window.on('console', (msg) => {
      if (msg.type() === 'log') logMessages.push(msg.text());
    });

    await window.evaluate(() => console.log('test-log-16-8'));

    await expect
      .poll(() => logMessages.some((m) => m.includes('test-log-16-8')), {
        timeout: 5000,
      })
      .toBe(true);
  });

  test('main process forwards renderer errors unconditionally (AC5)', async ({
    electronApp,
    window,
  }) => {
    // Verify that the console-message handler in main.js uses console.error for level=3 messages.
    // We instrument the main process console.error spy via electronApp.evaluate,
    // trigger a renderer error, then confirm the spy captured it.
    await electronApp.evaluate(() => {
      globalThis.__testErrorLog = [];
      const orig = console.error.bind(console);
      console.error = (...args) => {
        globalThis.__testErrorLog.push(args.join(' '));
        orig(...args);
      };
    });

    await window.evaluate(() => console.error('test-forwarded-error-16-8'));

    await expect
      .poll(
        () =>
          electronApp.evaluate(() =>
            (globalThis.__testErrorLog || []).some((m) =>
              m.includes('test-forwarded-error-16-8')
            )
          ),
        { timeout: 5000 }
      )
      .toBe(true);
  });

  test('main process does not forward renderer console.log when DEBUG is false (AC5)', async ({
    electronApp,
    window,
  }) => {
    // In test mode NODE_ENV=test and no --verbose, so DEBUG=false.
    // Renderer console.log (level=1) should NOT be forwarded to main process console.log.
    await electronApp.evaluate(() => {
      globalThis.__testInfoLog = [];
      const orig = console.log.bind(console);
      console.log = (...args) => {
        globalThis.__testInfoLog.push(args.join(' '));
        orig(...args);
      };
    });

    const marker = `test-info-not-forwarded-16-8-${Date.now()}`;
    await window.evaluate((m) => console.log(m), marker);

    // Wait briefly via condition — the message should NOT appear in main process logs
    await expect
      .poll(
        () =>
          electronApp.evaluate(
            (_, m) =>
              (globalThis.__testInfoLog || []).some((s) => s.includes(m)),
            marker
          ),
        { timeout: 2000, intervals: [200] }
      )
      .toBe(false);
  });
});
