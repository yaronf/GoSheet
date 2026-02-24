// Minimal test to debug Playwright Electron launch issue
const playwright = require('playwright');
const path = require('path');

(async () => {
  try {
    console.log('[Test] Launching Electron...');
    const electronPath = require('electron');
    console.log('[Test] Electron path:', electronPath);

    const electronApp = await playwright._electron.launch({
      executablePath: electronPath,
      args: [path.join(__dirname, '..', 'electron', 'main.js')],
      timeout: 30000,
    });

    console.log('[Test] Electron launched successfully!');

    const window = await electronApp.firstWindow();
    console.log('[Test] Got first window');

    const title = await window.title();
    console.log('[Test] Window title:', title);

    await electronApp.close();
    console.log('[Test] Electron closed successfully');
  } catch (error) {
    console.error('[Test] ERROR:', error.message);
    console.error('[Test] Stack:', error.stack);
    process.exit(1);
  }
})();
