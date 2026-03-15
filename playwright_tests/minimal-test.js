// Minimal test to debug Playwright Electron launch issue
const playwright = require('playwright');
const path = require('path');

(async () => {
  try {
    const electronPath = require('electron');

    const electronApp = await playwright._electron.launch({
      executablePath: electronPath,
      args: [path.join(__dirname, '..', 'electron', 'main.js')],
      timeout: 30000,
    });

    const window = await electronApp.firstWindow();
    await window.title(); // ensure window is ready
    await electronApp.close();
  } catch (error) {
    console.error('[Test] ERROR:', error.message);
    console.error('[Test] Stack:', error.stack);
    process.exit(1);
  }
})();
