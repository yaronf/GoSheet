// Story 3.1: Electron Main Process
// Handles app lifecycle, Go server spawning, and window creation
//
// Story 16.8: Unified log format across all three layers:
//   [ISO-timestamp] [LEVEL] [SOURCE] message
//   Sources: [Electron], [Go Server], [Renderer]
//   Levels:  INFO (default), DEBUG (--verbose only), WARN, ERROR
//   All output is timestamped unconditionally. If --log-file=<path> is set,
//   output is also appended to the file.
//
// Story 10.8: Debug logs — --verbose flag or NODE_ENV=development.
//   DEBUG=1 env var is intentionally NOT supported; use --verbose instead.
const DEBUG =
  process.argv.includes('--verbose') || process.env.NODE_ENV === 'development';
// In test mode, hide windows unless ELECTRON_SHOW_WINDOW=1 (same as createWindow)
const IS_TEST = process.env.NODE_ENV === 'test';
const SHOW_WINDOW_IN_TEST = process.env.ELECTRON_SHOW_WINDOW === '1';

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeTheme,
  Menu,
} = require('electron');

// Story 16.7: Single-instance lock — forwards Finder/CLI launches to the running instance.
// In dev mode (unregistered file association), Finder spawns a new process on double-click
// instead of sending 'open-file' to the running one. The lock causes the new process to quit
// and emit 'second-instance' on the running instance with the forwarded argv.
// Skipped in test mode — Playwright launches a fresh instance per test run.
if (process.env.NODE_ENV !== 'test') {
  const gotLock = app.requestSingleInstanceLock({ argv: process.argv });
  if (!gotLock) {
    app.quit();
    process.exit(0);
  }
}

const { spawn } = require('child_process');
const path = require('node:path');
const fs = require('fs');
const os = require('os');

// Story 16.8: Universal timestamp wrapper — applies to terminal and --log-file alike.
// Format: [ISO-timestamp] [LEVEL] original-message
// --log-file=<path> additionally appends to file in the same format.
// logStream is module-level so Go server pipe forwarding can also write to it.
let logStream = null;
{
  const logFileArg = process.argv.find((a) => a.startsWith('--log-file='));
  if (logFileArg) {
    const logFilePath = logFileArg.slice('--log-file='.length);
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  }
  const makeWrap =
    (orig, level) =>
    (...args) => {
      const ts = new Date().toISOString().slice(0, 19) + 'Z';
      const msg = args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ');
      const line = `[${ts}] [${level}] ${msg}`;
      if (logStream) logStream.write(line + '\n');
      orig(line);
    };
  console.log = makeWrap(console.log, 'INFO ');
  console.error = makeWrap(console.error, 'ERROR');
  console.warn = makeWrap(console.warn, 'WARN ');
  if (logFileArg) {
    console.log(
      `[Electron] Logging to file: ${logFileArg.slice('--log-file='.length)}`
    );
  }
}
const {
  initializeMenu,
  updateMenuState,
  updateRecentFiles,
  updateFormatMenuStyles,
} = require('./menu');

// Story 13.10: App settings persistence (RTL mode, future settings)
const { getSettings, setSetting } = require('./settings');

// Story 8.2: Custom recent files storage (app.getRecentDocuments can return empty on macOS)
const RECENT_FILES_PATH = path.join(
  app.getPath('userData'),
  'recent-files.json'
);
const MAX_RECENT_FILES = 10;
if (DEBUG) console.log('[Electron] Recent files path:', RECENT_FILES_PATH);

function loadRecentFiles() {
  try {
    if (fs.existsSync(RECENT_FILES_PATH)) {
      const data = JSON.parse(fs.readFileSync(RECENT_FILES_PATH, 'utf8'));
      const files = Array.isArray(data) ? data : [];
      if (DEBUG)
        console.log(
          '[Electron] loadRecentFiles from JSON:',
          files.length,
          files
        );
      return files;
    }
    if (DEBUG)
      console.log('[Electron] loadRecentFiles: no JSON at', RECENT_FILES_PATH);
  } catch (err) {
    console.error('[Electron] Error loading recent files:', err);
  }
  return [];
}

function saveRecentFiles(files) {
  try {
    fs.writeFileSync(
      RECENT_FILES_PATH,
      JSON.stringify(files.slice(0, MAX_RECENT_FILES))
    );
  } catch (err) {
    console.error('[Electron] Error saving recent files:', err);
  }
}

function addToRecentFiles(filePath) {
  let files = loadRecentFiles();
  files = files.filter((p) => p !== filePath);
  files.unshift(filePath);
  saveRecentFiles(files);
  syncRecentFilesMenu();
}

function clearRecentFiles() {
  saveRecentFiles([]);
  syncRecentFilesMenu();
}

function syncRecentFilesMenu() {
  const files = loadRecentFiles();
  if (DEBUG)
    console.log(
      '[Electron] syncRecentFilesMenu: windows=',
      BrowserWindow.getAllWindows().length,
      'files=',
      files.length
    );
  // Menu is app-level; one rebuild covers all windows
  updateRecentFiles(files, { onClear: clearRecentFiles });
  updateDockMenu(files);
}

// Story 8.3: Ensure recent files are saved to disk before quit (defensive; normally saved on each add/remove)
function ensureRecentFilesSaved() {
  try {
    const files = loadRecentFiles();
    saveRecentFiles(files);
    if (DEBUG)
      console.log(
        '[Electron] ensureRecentFilesSaved: persisted',
        files.length,
        'files'
      );
  } catch (err) {
    console.error('[Electron] Error saving recent files on quit:', err);
  }
}

// Story 8.3: Clean up temp files created by Go server (download/upload)
// Go server uses /tmp on Unix (server/main.go)
function cleanupTempFiles() {
  const tempPaths =
    process.platform === 'win32'
      ? [
          path.join(os.tmpdir(), 'gosheet_download.gosheet'),
          path.join(os.tmpdir(), 'gosheet_upload.gosheet'),
        ]
      : ['/tmp/gosheet_download.gosheet', '/tmp/gosheet_upload.gosheet'];
  for (const p of tempPaths) {
    try {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        if (DEBUG) console.log('[Electron] Cleaned up temp file:', p);
      }
    } catch (err) {
      if (err.code !== 'ENOENT')
        console.warn('[Electron] Could not remove temp file:', p, err.message);
    }
  }
}

/**
 * Updates the macOS dock menu with New Spreadsheet, Open..., and up to 5 recent files.
 * Called on app ready and when recent files change via syncRecentFilesMenu.
 * @param {string[]} [recentFiles] - Optional list of recent file paths; if omitted, loads from storage.
 */
function updateDockMenu(recentFiles) {
  if (process.platform !== 'darwin') return;
  if (!app.dock) return;

  const files = Array.isArray(recentFiles) ? recentFiles : loadRecentFiles();
  const recentFilesList = files.slice(0, 5);
  const template = [
    {
      label: 'New Spreadsheet',
      click: () => {
        const target =
          BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (target && !target.isDestroyed()) {
          target.show();
          target.webContents.send('menu-new');
        } else {
          createWindow();
        }
      },
    },
    {
      label: 'Open...',
      click: () => {
        const target =
          BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (target && !target.isDestroyed()) {
          target.show();
          target.webContents.send('menu-open');
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
  ];

  if (recentFilesList.length === 0) {
    template.push({ label: '(No recent files)', enabled: false });
  } else {
    recentFilesList.forEach((filePath) => {
      template.push({
        label: path.basename(filePath),
        click: () => {
          if (!fs.existsSync(filePath)) {
            console.warn(
              '[Electron] Dock: recent file no longer exists:',
              filePath
            );
            return;
          }
          createWindow(filePath);
        },
      });
    });
  }

  app.dock.setMenu(Menu.buildFromTemplate(template));
  if (DEBUG)
    console.log(
      '[Electron] Dock menu updated with',
      recentFilesList.length,
      'recent files'
    );
}

// Story 16.7: Per-window registry — BrowserWindow → { goServer, goServerPort }
const windowRegistry = new Map();

// Story 7.7: Store file path to open when app is launched by double-clicking a file
let pendingFileToOpen = null;

// Support command-line file argument: `npm start -- /path/to/file.sheet`
// Also handles Electron's argv where the app path is argv[1] in packaged mode.
const cliArgs = process.argv.slice(2);

if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
  process.stdout.write(`GoSheet — Lightweight spreadsheet for macOS

Usage:
  gosheet [options] [file.sheet]

Arguments:
  file.sheet        Open the specified spreadsheet file on launch

Options:
  --verbose              Enable verbose debug logging
  --log-file=<path>      Append all log output to a file (combined with --verbose for full logs)
  --help, -h             Show this help message
`);
  app.quit();
  process.exit(0);
}

// Story 16.3: Support .sheet and .csv file paths from CLI
const argFilePath = cliArgs.find(
  (a) => !a.startsWith('-') && (a.endsWith('.sheet') || a.endsWith('.csv'))
);
if (argFilePath && fs.existsSync(argFilePath)) {
  pendingFileToOpen = argFilePath;
  if (DEBUG) console.log('[Electron] CLI file to open:', argFilePath);
}

// Story 7.11: Track whether we've decided to quit (for quit warning dialog — app-level)
// isQuitting: user confirmed quit (or no unsaved changes) — skip dialog, allow close
// isQuitInitiated: before-quit has been entered once — prevent re-entry loop
let isQuitting = false;
let isQuitInitiated = false;

// Story 7.10: Listen for system theme changes — registered ONCE at module level.
// Must NOT be inside createWindow() — each call would add another listener.
nativeTheme.on('updated', () => {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  if (DEBUG) console.log('[Electron] System theme changed to:', theme);
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('theme-changed', theme);
  });
});

// Story 3.3: Start Go HTTP Server as child process
// Story 16.7: Returns { goServer, portReady } — no longer sets module-level globals
function startGoServer() {
  if (DEBUG) console.log('[Electron] Starting Go HTTP server...');

  // Determine Go server binary path
  // In development: use server/ directory relative to project root
  // In production: use packaged binary in app resources
  const isDev = !app.isPackaged;
  const serverPath = isDev
    ? path.join(__dirname, '..', 'bin', 'gosheet-server')
    : path.join(process.resourcesPath, 'server', 'gosheet-server');

  if (DEBUG) {
    console.log(`[Electron] Mode: ${isDev ? 'development' : 'production'}`);
    console.log(`[Electron] Server path: ${serverPath}`);
  }

  // Check if server binary exists
  if (!fs.existsSync(serverPath)) {
    console.error(
      `[Electron] ERROR: Go server binary not found at: ${serverPath}`
    );
    console.error(`[Electron] Please build the server first: make build`);
    dialog.showErrorBox(
      'Server Not Found',
      `Go server binary not found.\n\nPlease build the server first:\n  make build\n\nExpected location:\n  ${serverPath}`
    );
    app.quit();
    return null;
  }

  // Spawn Go server process
  // Set cwd to Resources directory so server can find frontend files
  const serverCwd = isDev
    ? path.join(__dirname, '..') // Project root in dev mode
    : process.resourcesPath; // Resources directory in packaged app

  if (DEBUG) console.log(`[Electron] Server working directory: ${serverCwd}`);

  const spawnArgs = [];
  if (DEBUG) spawnArgs.push('--verbose');
  spawnArgs.push(`--userData=${app.getPath('userData')}`); // Story 20.7: audit log path
  const goServer = spawn(serverPath, spawnArgs, {
    cwd: serverCwd,
    // fd 3 is a dedicated port-announcement pipe (Story 16.5).
    // Go writes "PORT=<n>\n" to fd 3 then closes it — isolated from stdout/stderr logs.
    stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
  });

  let _resolvePort, _rejectPort;
  const portReady = new Promise((resolve, reject) => {
    _resolvePort = resolve;
    _rejectPort = reject;
  });

  // Read bound port (and bootstrap token) from fd 3.
  // Go writes "PORT=<n>\nTOKEN=<t>\n" then closes the pipe.
  // TOKEN is absent in test mode (NODE_ENV=test) — auth is disabled server-side.
  goServer.stdio[3].once('data', (data) => {
    const raw = data.toString();
    const portMatch = raw.match(/PORT=(\d+)/);
    if (portMatch) {
      const port = parseInt(portMatch[1], 10);
      const tokenMatch = raw.match(/TOKEN=([^\n]+)/);
      const token = tokenMatch ? tokenMatch[1].trim() : '';
      if (DEBUG)
        console.log(
          `[Electron] Go server bound to port: ${port}, token present: ${token.length > 0}`
        );
      _resolvePort({ port, token });
    } else {
      const msg = `Failed to parse port from Go server fd 3: "${raw.trim()}"`;
      console.error('[Electron]', msg);
      _rejectPort(new Error(msg));
    }
  });

  // Forward Go server output raw — it already carries the unified format:
  //   [ISO] [LEVEL] [go] message
  // Bypassing console.log/error avoids double-prefixing from the timestamp wrapper.
  // Write to logStream (--log-file) if active, then to the original stderr/stdout.
  // Push events (cells_changed, session_changed) are now delivered via SSE on
  // GET /api/events — no stdout side-channel needed (Story 20.8).
  const forwardGoOutput = (data) => {
    const text = data.toString();
    for (const line of text.split('\n')) {
      if (line === '') continue;
      if (logStream) logStream.write(line + '\n');
      process.stderr.write(line + '\n');
    }
  };
  goServer.stdout.on('data', forwardGoOutput);
  goServer.stderr.on('data', forwardGoOutput);

  goServer.on('error', (error) => {
    console.error('[Electron] Failed to start Go server:', error);
    _rejectPort(error);
  });

  goServer.on('close', (code) => {
    if (code !== 0) {
      console.error(`[Electron] Go server exited with code ${code}`);
    } else if (DEBUG) {
      console.log(`[Electron] Go server exited with code ${code}`);
    }
  });

  if (DEBUG)
    console.log(`[Electron] Go server started with PID: ${goServer.pid}`);
  return { goServer, portReady };
}

// Story 3.1: Create window with its own Go server
// Story 16.7: async factory — each call spawns its own server + registers in windowRegistry
async function createWindow(filePath = null) {
  if (DEBUG) console.log('[Electron] Creating window, filePath:', filePath);

  const serverResult = startGoServer();
  if (!serverResult) return null; // startGoServer already showed error + quit

  const { goServer, portReady } = serverResult;
  let port, bootstrapToken;
  try {
    const result = await Promise.race([
      portReady,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Go server startup timeout')), 10000)
      ),
    ]);
    port = result.port;
    bootstrapToken = result.token;
  } catch (err) {
    console.error('[Electron] Go server failed to start:', err.message);
    dialog.showErrorBox(
      'Server Failed to Start',
      `The Go server did not start within 10 seconds.\n\n${err.message}\n\nPlease check the logs and try again.`
    );
    goServer.kill();
    return null;
  }

  const isTest = process.env.NODE_ENV === 'test';
  const showWindow = process.env.ELECTRON_SHOW_WINDOW === '1';

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'GoSheet',
    show: showWindow || !isTest, // Hide window in test mode unless ELECTRON_SHOW_WINDOW=1
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Story 16.7 bug fix: set currentFilePath immediately so open-file dedup works
  // even if open-file fires before did-finish-load completes.
  windowRegistry.set(win, {
    goServer,
    goServerPort: port,
    bootstrapToken,
    currentFilePath: filePath,
  });
  attachWindowCloseHandler(win);

  win.on('closed', () => {
    const state = windowRegistry.get(win);
    if (state) {
      state.goServer.kill('SIGTERM');
      windowRegistry.delete(win);
    }
    if (windowRegistry.size === 0 && process.platform !== 'darwin') app.quit();
  });

  // Load frontend from Go HTTP server (append ?debug=1 for verbose frontend logs)
  // If a file will be opened, pass ?file= so the renderer skips the welcome flash.
  // Story 20.1: pass bootstrap token so renderer can authenticate API calls.
  const params = new URLSearchParams();
  if (DEBUG) params.set('debug', '1');
  if (filePath) params.set('file', filePath);
  if (bootstrapToken) params.set('token', bootstrapToken);
  const paramStr = params.toString();
  const serverUrl = `http://localhost:${port}${paramStr ? '?' + paramStr : ''}`;
  if (DEBUG) console.log(`[Electron] Loading frontend from: ${serverUrl}`);

  // Grant clipboard permissions in test mode — navigator.clipboard requires
  // explicit permission grant when the window is hidden (NODE_ENV=test).
  if (isTest) {
    win.webContents.session.setPermissionRequestHandler(
      (_webContents, permission, callback) => {
        if (
          permission === 'clipboard-read' ||
          permission === 'clipboard-sanitized-write'
        ) {
          callback(true);
        } else {
          callback(false);
        }
      }
    );
    win.webContents.session.setPermissionCheckHandler(
      (_webContents, permission) => {
        return (
          permission === 'clipboard-read' ||
          permission === 'clipboard-sanitized-write'
        );
      }
    );
  }

  // Forward renderer console logs to main process terminal
  // Story 16.8: Forward renderer logs by level. Errors/warnings always forwarded;
  // info/verbose gated behind DEBUG. level: 0=verbose, 1=info, 2=warning, 3=error.
  win.webContents.on('console-message', (_event, level, message) => {
    if (level === 3) {
      console.error(`[Renderer] ${message}`);
    } else if (level === 2) {
      console.warn(`[Renderer] ${message}`);
    } else if (DEBUG) {
      console.log(`[Renderer] ${message}`);
    }
  });

  // Story 7.7 & 7.6: Handle file to open after window is ready
  // Story 16.3: Route .csv to menu-open-csv; guard against missing files
  // Story 16.7: filePath param takes priority over pendingFileToOpen (first window only)
  win.webContents.on('did-finish-load', () => {
    // Resolve which file to open: explicit filePath param, or pendingFileToOpen (CLI/Finder, first window only)
    let fileToOpen = filePath;
    if (!fileToOpen && pendingFileToOpen) {
      fileToOpen = pendingFileToOpen;
      pendingFileToOpen = null;
    }

    if (fileToOpen) {
      if (DEBUG)
        console.log('[Electron] Window ready, opening file:', fileToOpen);
      if (!fs.existsSync(fileToOpen)) {
        console.warn('[Electron] File no longer exists:', fileToOpen);
        win.webContents.send('open-file-error', fileToOpen);
      } else if (fileToOpen.endsWith('.csv')) {
        win.webContents.send('menu-open-csv', fileToOpen);
      } else {
        win.webContents.send('menu-open-recent', fileToOpen);
        // Track file in registry immediately so open-file dedup works
        // before file:addRecent is called by the renderer
        const state = windowRegistry.get(win);
        if (state) state.currentFilePath = fileToOpen;
      }
    }

    // Story 8.2: Sync menu again when window is ready (ensures menu matches welcome screen)
    syncRecentFilesMenu();

    // Story 7.10: Send initial theme to renderer
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    if (DEBUG)
      console.log('[Electron] Sending initial theme to renderer:', theme);
    win.webContents.send('theme-changed', theme);
  });

  // Clear cache in development mode to ensure latest code is loaded
  if (process.env.NODE_ENV !== 'production') {
    win.webContents.session.clearCache().then(() => {
      if (DEBUG) console.log('[Electron] Cache cleared');
      win.loadURL(serverUrl).catch((err) => {
        console.error('[Electron] Failed to load URL:', err);
      });
    });
  } else {
    win.loadURL(serverUrl).catch((err) => {
      console.error('[Electron] Failed to load URL:', err);
    });
  }

  if (DEBUG) console.log('[Electron] Window created');
  return win;
}

// Story 16.7: Per-window close handler
// App-level isQuitting is shared; per-window dialog state is local to the closure.
function attachWindowCloseHandler(win) {
  let winLastQuitAttempt = 0;

  win.on('close', (event) => {
    // If we've already decided to quit, allow the close
    if (isQuitting) {
      return;
    }

    // In test mode, skip the unsaved changes dialog and allow the close
    const isTestMode = process.env.NODE_ENV === 'test';
    if (isTestMode) {
      if (DEBUG)
        console.log(
          '[Electron] Test mode: Skipping unsaved changes check, allowing close'
        );
      const isLastWindow = windowRegistry.size <= 1;
      if (isLastWindow) {
        isQuitting = true;
        app.quit();
      }
      // For non-last windows in test mode: allow the close (don't preventDefault)
      return;
    }

    // ALWAYS prevent the close initially
    event.preventDefault();

    // Check if window is still valid
    if (!win || win.isDestroyed() || !win.webContents) {
      console.error('[Electron] Window destroyed during close, allowing quit');
      isQuitting = true;
      app.quit();
      return;
    }

    // Check for unsaved changes (async)
    win.webContents
      .executeJavaScript('window.currentHasUnsavedChanges')
      .then((hasUnsavedChanges) => {
        if (hasUnsavedChanges) {
          // Debounce rapid close attempts (prevent multiple dialogs within 500ms)
          const now = Date.now();
          if (now - winLastQuitAttempt < 500) {
            if (DEBUG)
              console.log(
                '[Electron] Ignoring rapid close attempt (debounced)'
              );
            return;
          }
          winLastQuitAttempt = now;

          // Show dialog (async)
          return dialog.showMessageBox(win, {
            type: 'warning',
            buttons: ['Cancel', 'Close Without Saving'],
            defaultId: 0, // Cancel is default (safer)
            title: 'Unsaved Changes',
            message: 'You have unsaved changes.',
            detail: 'Do you want to close without saving?',
          });
        } else {
          // No unsaved changes — close this window
          const isLastWindow = windowRegistry.size <= 1;
          if (isLastWindow) {
            isQuitting = true;
            app.quit();
          } else {
            win.destroy();
          }
          return null;
        }
      })
      .then((choice) => {
        if (!choice) return;
        const choiceStr =
          choice.response === 0 ? 'Cancel' : 'Close Without Saving';
        if (DEBUG) console.log('[Electron] Close dialog choice:', choiceStr);

        if (choice.response === 1) {
          // User chose "Close Without Saving"
          const isLastWindow = windowRegistry.size <= 1;
          if (isLastWindow) {
            isQuitting = true;
            app.quit();
          } else {
            win.destroy();
          }
        } else {
          // User chose "Cancel" — reset so next Cmd+Q attempt works again
          winLastQuitAttempt = 0;
          isQuitInitiated = false;
        }
      })
      .catch((error) => {
        console.error('[Electron] Error checking unsaved changes:', error);
        console.error(
          '[Electron] Error type:',
          error.name,
          'Message:',
          error.message
        );

        // Don't auto-close on error - show a dialog asking user what to do
        dialog
          .showMessageBox(win, {
            type: 'error',
            buttons: ['Stay Open', 'Close Anyway'],
            defaultId: 0, // Stay Open is default (safer)
            title: 'Error Checking Changes',
            message: 'Unable to check for unsaved changes.',
            detail:
              'An error occurred while checking if you have unsaved work. What would you like to do?',
          })
          .then((errorChoice) => {
            if (errorChoice.response === 1) {
              if (DEBUG)
                console.log('[Electron] User chose to close despite error');
              const isLastWindow = windowRegistry.size <= 1;
              if (isLastWindow) {
                isQuitting = true;
                app.quit();
              } else {
                win.destroy();
              }
            } else {
              if (DEBUG)
                console.log('[Electron] User chose to stay open after error');
              winLastQuitAttempt = 0;
              isQuitInitiated = false;
            }
          })
          .catch((dialogError) => {
            // If even the error dialog fails, log and stay open (safest option)
            console.error(
              '[Electron] Critical error - cannot show dialogs:',
              dialogError
            );
            winLastQuitAttempt = 0;
            isQuitInitiated = false;
          });
      });
  });
}

// Story 3.4: Setup IPC handlers — called ONCE in app.whenReady()
// Story 16.7: Dialog handlers use event.sender to target the requesting window
function setupIpcHandlers() {
  // IPC handler for file dialogs - Open File
  ipcMain.handle('dialog:openFile', async (event) => {
    if (DEBUG) console.log('[Electron] Open file dialog requested');
    const win = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(win, {
      title: 'Open Spreadsheet',
      filters: [
        { name: 'Spreadsheet Files', extensions: ['sheet'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled) {
      if (DEBUG) console.log('[Electron] Open dialog cancelled');
      return null;
    }

    const filePath = result.filePaths[0];
    if (DEBUG) console.log(`[Electron] File selected: ${filePath}`);
    return filePath;
  });

  // IPC handler for file dialogs - Save File
  ipcMain.handle(
    'dialog:saveFile',
    async (event, defaultName = 'Untitled.sheet') => {
      if (DEBUG)
        console.log(
          `[Electron] Save file dialog requested (default: ${defaultName})`
        );
      const win = BrowserWindow.fromWebContents(event.sender);

      const result = await dialog.showSaveDialog(win, {
        title: 'Save Spreadsheet',
        defaultPath: defaultName,
        filters: [
          { name: 'Spreadsheet Files', extensions: ['sheet'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled) {
        if (DEBUG) console.log('[Electron] Save dialog cancelled');
        return null;
      }

      const filePath = result.filePath;
      if (DEBUG) console.log(`[Electron] Save path selected: ${filePath}`);
      return filePath;
    }
  );

  // IPC handler for CSV file dialogs - Import CSV
  ipcMain.handle('dialog:importCSV', async (event) => {
    if (DEBUG) console.log('[Electron] Import CSV dialog requested');
    const win = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(win, {
      title: 'Import CSV File',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled) {
      if (DEBUG) console.log('[Electron] Import CSV dialog cancelled');
      return null;
    }

    const filePath = result.filePaths[0];
    if (DEBUG) console.log(`[Electron] CSV file selected: ${filePath}`);
    return filePath;
  });

  // IPC handler for CSV file dialogs - Export CSV
  ipcMain.handle(
    'dialog:exportCSV',
    async (event, defaultName = 'Untitled.csv') => {
      if (DEBUG)
        console.log(
          `[Electron] Export CSV dialog requested (default: ${defaultName})`
        );
      const win = BrowserWindow.fromWebContents(event.sender);

      const result = await dialog.showSaveDialog(win, {
        title: 'Export to CSV',
        defaultPath: defaultName,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled) {
        if (DEBUG) console.log('[Electron] Export CSV dialog cancelled');
        return null;
      }

      const filePath = result.filePath;
      if (DEBUG)
        console.log(`[Electron] CSV export path selected: ${filePath}`);
      return filePath;
    }
  );

  // Story 7.1: IPC handler for menu state updates
  ipcMain.on('menu:updateState', (event, state) => {
    if (DEBUG) console.log('[Electron] Menu state update received:', state);
    updateMenuState(state);
  });

  // Story 7.5 & 8.2: Add file to recent documents (custom storage + menu only)
  // Skip app.addRecentDocument - it duplicates recent files in dock menu (macOS adds its own section)
  // Story 16.7: Also track the open file path per-window in the registry
  ipcMain.handle('file:addRecent', async (event, filePath) => {
    if (DEBUG) console.log('[Electron] Adding to recent documents:', filePath);
    addToRecentFiles(filePath);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const state = windowRegistry.get(win);
      if (state) state.currentFilePath = filePath;
    }
    return true;
  });

  // Story 8.2: Get recent files for welcome screen (from custom storage)
  ipcMain.handle('file:getRecent', async () => {
    return loadRecentFiles().slice(0, 5);
  });

  // User Guide: Read docs/USER_GUIDE.md, render with showdown, return HTML
  ipcMain.handle('get-user-guide', async () => {
    const userGuidePath = app.isPackaged
      ? path.join(process.resourcesPath, 'docs', 'USER_GUIDE.md')
      : path.join(app.getAppPath(), 'docs', 'USER_GUIDE.md');
    try {
      const md = fs.readFileSync(userGuidePath, 'utf8');
      const showdown = require('showdown');
      const converter = new showdown.Converter({
        tables: true,
        strikethrough: true,
        ghCompatibleHeaderId: true,
      });
      return converter.makeHtml(md);
    } catch (err) {
      console.error('[Electron] Failed to read/render User Guide:', err);
      return null;
    }
  });

  // Story 8.2: Sync menu when renderer shows welcome screen (keeps menu and welcome in sync)
  ipcMain.on('menu:syncRecentFiles', () => {
    syncRecentFilesMenu();
  });

  // Story 13.3: Sync Format menu with custom styles from API
  ipcMain.on('menu:syncStyles', (event, styles) => {
    updateFormatMenuStyles(styles);
  });

  // Story 13.10: Settings persistence (RTL mode, future settings)
  ipcMain.handle('get-settings', async () => {
    return getSettings();
  });

  ipcMain.handle('set-setting', async (event, key, value) => {
    setSetting(key, value);
    return true;
  });
}

// App lifecycle management
app.whenReady().then(() => {
  console.log('[Electron] App ready, initializing...');

  // Story 7.3: Configure About panel for macOS
  const appPath = app.getAppPath();
  const iconPaths = [
    path.join(appPath, 'assets', 'icon.icns'),
    path.join(appPath, 'assets', 'Icon.png'),
    path.join(process.resourcesPath, 'assets', 'icon.icns'),
    path.join(process.resourcesPath, 'assets', 'Icon.png'),
  ];
  let iconPath = null;
  for (const p of iconPaths) {
    if (fs.existsSync(p)) {
      iconPath = p;
      break;
    }
  }
  const aboutOptions = {
    applicationName: app.getName(), // Uses productName from package.json
    applicationVersion: app.getVersion(),
    copyright: `© ${new Date().getFullYear()} All rights reserved`,
    credits: 'Lightweight, fast spreadsheet for macOS',
  };
  if (iconPath) {
    aboutOptions.iconPath = iconPath;
  }
  app.setAboutPanelOptions(aboutOptions);
  if (DEBUG)
    console.log(
      `[Electron] About panel configured for ${app.getName()} v${app.getVersion()}`
    );

  // Story 3.4: Setup IPC handlers (called ONCE — ipcMain.handle throws on double-registration)
  setupIpcHandlers();

  // Story 7.6: Set dock menu on startup (macOS) so it's available before window loads
  updateDockMenu();

  // Story 16.7: createWindow() is now async and starts its own server
  createWindow().then((win) => {
    if (win) {
      // Story 7.1: Initialize menu system ONCE at app startup (app-level menu, not per-window)
      initializeMenu(win, loadRecentFiles(), {
        onOpenFile: (fp) => createWindow(fp),
      });
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Story 16.7: Second instance forwards its argv here — open the file in a new window
app.on('second-instance', (event, argv) => {
  if (DEBUG) console.log('[Electron] second-instance argv:', argv);
  const secondArgFilePath = argv.find(
    (a) => !a.startsWith('-') && (a.endsWith('.sheet') || a.endsWith('.csv'))
  );
  if (secondArgFilePath && fs.existsSync(secondArgFilePath)) {
    const resolvedPath = path.resolve(secondArgFilePath);
    // Dedup: focus existing window if file already open
    for (const [win, state] of windowRegistry) {
      if (
        state.currentFilePath &&
        path.resolve(state.currentFilePath) === resolvedPath
      ) {
        if (DEBUG)
          console.log(
            '[Electron] second-instance: file already open, focusing window'
          );
        if (!win.isDestroyed()) {
          if (!IS_TEST || SHOW_WINDOW_IN_TEST) win.show();
          win.focus();
        }
        return;
      }
    }
    createWindow(secondArgFilePath);
  } else {
    // No file arg — just focus the most recently used window
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0 && !wins[0].isDestroyed()) {
      if (!IS_TEST || SHOW_WINDOW_IN_TEST) wins[0].show();
      wins[0].focus();
    }
  }
});

// Story 7.5: Handle opening files from Finder or file association
// Story 16.3: Route .csv files to menu-open-csv; .sheet files to menu-open-recent
// Story 16.7: If app ready, open in a new window; otherwise store in pendingFileToOpen
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (DEBUG)
    console.log(
      '[Electron] Open file from Finder or file association:',
      filePath
    );

  if (!app.isReady()) {
    // Too early — initial createWindow() will dispatch via pendingFileToOpen
    if (DEBUG)
      console.log('[Electron] App not ready, storing file to open:', filePath);
    pendingFileToOpen = filePath;
    return;
  }

  // Story 16.7: If this file is already open in a window, focus that window instead
  const resolvedPath = path.resolve(filePath);
  if (DEBUG) {
    console.log(
      '[Electron] open-file dedup check, resolvedPath:',
      resolvedPath
    );
    for (const [_win, state] of windowRegistry) {
      console.log(
        '[Electron]   registry entry currentFilePath:',
        state.currentFilePath,
        '-> resolved:',
        state.currentFilePath ? path.resolve(state.currentFilePath) : null
      );
    }
  }
  for (const [win, state] of windowRegistry) {
    if (
      state.currentFilePath &&
      path.resolve(state.currentFilePath) === resolvedPath
    ) {
      if (DEBUG)
        console.log(
          '[Electron] File already open, focusing existing window:',
          filePath
        );
      if (!win.isDestroyed()) {
        if (!IS_TEST || SHOW_WINDOW_IN_TEST) win.show();
        win.focus();
      }
      return;
    }
  }

  // App ready: open in a new window (spawns its own server)
  createWindow(filePath);
});

// Cleanup on quit
// Story 16.7: Individual server kill moved to win.on('closed'); window-all-closed just quits on non-macOS
app.on('window-all-closed', () => {
  console.log('[Electron] All windows closed');

  // Quit app (except on macOS where apps typically stay open)
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  // Story 7.11: Prevent quit if we haven't shown the dialog yet
  // EXCEPT in test mode where we want clean shutdown without dialogs
  const isTestMode = process.env.NODE_ENV === 'test';

  if (!isQuitting && !isQuitInitiated && !isTestMode) {
    event.preventDefault();
    isQuitInitiated = true;
    // NOTE: do NOT set isQuitting here — the close handler must check unsaved changes first.
    // isQuitting is set only after the user confirms (or there are no unsaved changes).

    // Trigger close on the focused window (unsaved-changes dialog runs per-window)
    const focused = BrowserWindow.getFocusedWindow();
    if (focused && !focused.isDestroyed()) {
      focused.close();
      return;
    }
    // No focused window — close all
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.close();
    });
    return;
  }

  if (isTestMode && DEBUG) {
    console.log(
      '[Electron] Test mode: Allowing immediate quit, cleaning up...'
    );
  }
  if (!isTestMode) {
    console.log('[Electron] App quitting, cleaning up...');
  }

  // Story 8.3: Graceful shutdown - save state and cleanup
  ensureRecentFilesSaved();
  cleanupTempFiles();

  // Safety net: kill any remaining Go servers (normally handled in win.on('closed'))
  windowRegistry.forEach((state) => {
    if (state.goServer) state.goServer.kill('SIGTERM');
  });
});

console.log('[Electron] Main process initialized');
