// Story 3.1: Electron Main Process
// Handles app lifecycle, Go server spawning, and window creation
// Story 10.8: Debug logs - --verbose flag, NODE_ENV=development, or DEBUG=1 (not in test)
const DEBUG =
  process.argv.includes('--verbose') ||
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG === '1';

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeTheme,
  Menu,
} = require('electron');

// Story 7.6: Single instance lock - when user "Keeps in Dock" and clicks, macOS may launch
// raw Electron (no app path) which shows the default splash. We quit that instance and focus ours.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
const { spawn } = require('child_process');
const path = require('node:path');
const fs = require('fs');
const os = require('os');
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
      '[Electron] syncRecentFilesMenu: mainWindow=',
      !!mainWindow,
      'files=',
      files.length
    );
  if (mainWindow) {
    updateRecentFiles(files, { onClear: clearRecentFiles });
  }
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
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.webContents.send('menu-new');
        } else {
          pendingDockAction = 'new';
          if (initialWindowCreated) createWindow();
        }
      },
    },
    {
      label: 'Open...',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.webContents.send('menu-open');
        } else {
          pendingDockAction = 'open';
          if (initialWindowCreated) createWindow();
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
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.webContents.send('menu-open-recent', filePath);
          } else {
            pendingDockAction = { type: 'open', path: filePath };
            if (initialWindowCreated) createWindow();
          }
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

let mainWindow;
let goServer;
let initialWindowCreated = false; // Story 7.6: Avoid double-create when dock clicked during startup
const GO_SERVER_PORT = 3000;

// Story 7.7: Store file path to open when app is launched by double-clicking a file
let pendingFileToOpen = null;

// Support command-line file argument: `npm start -- /path/to/file.sheet`
// Also handles Electron's argv where the app path is argv[1] in packaged mode.
const cliArgs = process.argv.slice(2);

if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
  console.log(`
GoSheet — Lightweight spreadsheet for macOS

Usage:
  gosheet [options] [file.sheet]

Arguments:
  file.sheet        Open the specified spreadsheet file on launch

Options:
  --verbose         Enable verbose debug logging
  --help, -h        Show this help message
`);
  app.quit();
  process.exit(0);
}

const argFilePath = cliArgs.find(
  (a) => !a.startsWith('-') && a.endsWith('.sheet')
);
if (argFilePath && fs.existsSync(argFilePath)) {
  pendingFileToOpen = argFilePath;
  if (DEBUG) console.log('[Electron] CLI file to open:', argFilePath);
}

// Story 7.6: Store dock menu action when app has no window (macOS)
let pendingDockAction = null;

// Story 7.11: Track whether we've decided to quit (for quit warning dialog)
let isQuitting = false;
let quitDialogShown = false;
let lastQuitAttempt = 0;

// Story 3.3: Start Go HTTP Server as child process
function startGoServer() {
  console.log('[Electron] Starting Go HTTP server...');

  // Determine Go server binary path
  // In development: use server/ directory relative to project root
  // In production: use packaged binary in app resources
  const isDev = !app.isPackaged;
  const serverPath = isDev
    ? path.join(__dirname, '..', 'server', 'gosheet-server')
    : path.join(process.resourcesPath, 'server', 'gosheet-server');

  if (DEBUG) {
    console.log(`[Electron] Mode: ${isDev ? 'development' : 'production'}`);
    console.log(`[Electron] Server path: ${serverPath}`);
  }

  // Check if server binary exists
  const fs = require('fs');
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
    return;
  }

  // Spawn Go server process
  // Set cwd to Resources directory so server can find frontend files
  const serverCwd = isDev
    ? path.join(__dirname, '..') // Project root in dev mode
    : process.resourcesPath; // Resources directory in packaged app

  if (DEBUG) console.log(`[Electron] Server working directory: ${serverCwd}`);

  const spawnArgs = ['--port', GO_SERVER_PORT.toString()];
  if (DEBUG) spawnArgs.push('--verbose');
  goServer = spawn(serverPath, spawnArgs, {
    cwd: serverCwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Log server output (always - server controls verbosity via --verbose)
  goServer.stdout.on('data', (data) => {
    console.log(`[Go Server] ${data.toString().trim()}`);
  });

  goServer.stderr.on('data', (data) => {
    console.error(`[Go Server Error] ${data.toString().trim()}`);
  });

  goServer.on('error', (error) => {
    console.error('[Electron] Failed to start Go server:', error);
  });

  goServer.on('close', (code) => {
    console.log(`[Electron] Go server exited with code ${code}`);
  });

  console.log(`[Electron] Go server started with PID: ${goServer.pid}`);
}

// Story 3.1: Create main window
function createWindow() {
  initialWindowCreated = true;
  if (DEBUG) console.log('[Electron] Creating main window...');

  const isTest = process.env.NODE_ENV === 'test';
  const showWindow = process.env.ELECTRON_SHOW_WINDOW === '1';

  mainWindow = new BrowserWindow({
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

  // Load frontend from Go HTTP server (append ?debug=1 for verbose frontend logs)
  const serverUrl = `http://localhost:${GO_SERVER_PORT}${DEBUG ? '?debug=1' : ''}`;
  if (DEBUG) console.log(`[Electron] Loading frontend from: ${serverUrl}`);

  // Grant clipboard permissions in test mode — navigator.clipboard requires
  // explicit permission grant when the window is hidden (NODE_ENV=test).
  if (isTest) {
    mainWindow.webContents.session.setPermissionRequestHandler(
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
    mainWindow.webContents.session.setPermissionCheckHandler(
      (_webContents, permission) => {
        return (
          permission === 'clipboard-read' ||
          permission === 'clipboard-sanitized-write'
        );
      }
    );
  }

  // Clear cache in development mode to ensure latest code is loaded
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.session.clearCache().then(() => {
      if (DEBUG) console.log('[Electron] Cache cleared');
      loadURL();
    });
  } else {
    loadURL();
  }

  function loadURL() {
    mainWindow.loadURL(serverUrl).catch((err) => {
      console.error('[Electron] Failed to load URL:', err);
      // Retry after a short delay if server isn't ready yet
      setTimeout(() => {
        mainWindow.loadURL(serverUrl);
      }, 1000);
    });
  }

  // Open DevTools in development mode
  // Disabled by default - press Cmd+Option+I (Mac) or Ctrl+Shift+I (Windows/Linux) to open manually
  // if (process.env.NODE_ENV !== 'production') {
  //   mainWindow.webContents.openDevTools();
  // }

  // Forward renderer console logs to main process terminal
  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    if (DEBUG) console.log(`[Renderer Console] ${message}`);
  });

  // Story 7.7 & 7.6: Handle pending file/dock action after window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFileToOpen) {
      if (DEBUG)
        console.log(
          '[Electron] Window ready, opening pending file:',
          pendingFileToOpen
        );
      mainWindow.webContents.send('menu-open-recent', pendingFileToOpen);
      pendingFileToOpen = null;
    } else if (pendingDockAction) {
      if (DEBUG)
        console.log(
          '[Electron] Window ready, processing pending dock action:',
          pendingDockAction
        );
      if (
        typeof pendingDockAction === 'object' &&
        pendingDockAction.type === 'open'
      ) {
        if (fs.existsSync(pendingDockAction.path)) {
          mainWindow.webContents.send(
            'menu-open-recent',
            pendingDockAction.path
          );
        } else {
          console.warn(
            '[Electron] Pending dock open: file no longer exists:',
            pendingDockAction.path
          );
        }
      } else if (pendingDockAction === 'new') {
        mainWindow.webContents.send('menu-new');
      } else if (pendingDockAction === 'open') {
        mainWindow.webContents.send('menu-open');
      }
      pendingDockAction = null;
    }

    // Story 8.2: Sync menu again when window is ready (ensures menu matches welcome screen)
    syncRecentFilesMenu();

    // Story 7.10: Send initial theme to renderer
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    if (DEBUG)
      console.log('[Electron] Sending initial theme to renderer:', theme);
    mainWindow.webContents.send('theme-changed', theme);
  });

  // Story 7.10: Listen for system theme changes
  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    if (DEBUG) console.log('[Electron] System theme changed to:', theme);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('theme-changed', theme);
    }
  });

  // Story 7.11: Quit warning dialog - prevent close if there are unsaved changes
  mainWindow.on('close', (event) => {
    // If we've already decided to quit, allow the close
    if (isQuitting) {
      return;
    }

    // In test mode, skip the unsaved changes dialog and quit immediately
    const isTestMode = process.env.NODE_ENV === 'test';
    if (isTestMode) {
      if (DEBUG)
        console.log(
          '[Electron] Test mode: Skipping unsaved changes check, allowing close'
        );
      isQuitting = true;
      app.quit();
      return;
    }

    // ALWAYS prevent the close initially
    event.preventDefault();

    // Check if window is still valid
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
      console.error('[Electron] Window destroyed during close, allowing quit');
      isQuitting = true;
      app.quit();
      return;
    }

    // Check for unsaved changes (async)
    mainWindow.webContents
      .executeJavaScript('window.currentHasUnsavedChanges')
      .then((hasUnsavedChanges) => {
        if (hasUnsavedChanges) {
          // Show dialog (async)
          return dialog.showMessageBox(mainWindow, {
            type: 'warning',
            buttons: ['Cancel', 'Quit Without Saving'],
            defaultId: 0, // Cancel is default (safer)
            title: 'Unsaved Changes',
            message: 'You have unsaved changes.',
            detail: 'Do you want to quit without saving?',
          });
        } else {
          // No unsaved changes, quit immediately
          isQuitting = true;
          app.quit();
          return null;
        }
      })
      .then((choice) => {
        const choiceStr = choice
          ? choice.response === 0
            ? 'Cancel'
            : 'Quit Without Saving'
          : 'null';
        if (DEBUG) console.log('[Electron] Quit dialog choice:', choiceStr);

        if (choice && choice.response === 1) {
          // User chose "Quit Without Saving"
          isQuitting = true;
          app.quit();
        } else if (choice && choice.response === 0) {
          // User chose "Cancel", reset flag so user can try to quit again
          quitDialogShown = false;
        } else {
          // No choice (null), reset flag
          quitDialogShown = false;
        }
        // If choice.response === 0 or choice is null, do nothing
        // Window stays open and remains usable
      })
      .catch((error) => {
        console.error('[Electron] Error checking unsaved changes:', error);
        console.error(
          '[Electron] Error type:',
          error.name,
          'Message:',
          error.message
        );

        // Don't auto-quit on error - show a dialog asking user what to do
        dialog
          .showMessageBox(mainWindow, {
            type: 'error',
            buttons: ['Stay Open', 'Quit Anyway'],
            defaultId: 0, // Stay Open is default (safer)
            title: 'Error Checking Changes',
            message: 'Unable to check for unsaved changes.',
            detail:
              'An error occurred while checking if you have unsaved work. What would you like to do?',
          })
          .then((errorChoice) => {
            if (errorChoice.response === 1) {
              // User chose "Quit Anyway"
              if (DEBUG)
                console.log('[Electron] User chose to quit despite error');
              isQuitting = true;
              app.quit();
            } else {
              // User chose "Stay Open"
              if (DEBUG)
                console.log('[Electron] User chose to stay open after error');
              quitDialogShown = false;
            }
          })
          .catch((dialogError) => {
            // If even the error dialog fails, log and stay open (safest option)
            console.error(
              '[Electron] Critical error - cannot show dialogs:',
              dialogError
            );
            quitDialogShown = false;
          });
      });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Story 7.1: Initialize menu system with recent files
  initializeMenu(mainWindow, loadRecentFiles());

  if (DEBUG) console.log('[Electron] Main window created');
}

// Story 3.4: Setup IPC handlers
function setupIpcHandlers() {
  // IPC handler for file dialogs - Open File
  ipcMain.handle('dialog:openFile', async () => {
    if (DEBUG) console.log('[Electron] Open file dialog requested');

    const result = await dialog.showOpenDialog(mainWindow, {
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

      const result = await dialog.showSaveDialog(mainWindow, {
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
  ipcMain.handle('dialog:importCSV', async () => {
    if (DEBUG) console.log('[Electron] Import CSV dialog requested');

    const result = await dialog.showOpenDialog(mainWindow, {
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

      const result = await dialog.showSaveDialog(mainWindow, {
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
  ipcMain.handle('file:addRecent', async (event, filePath) => {
    if (DEBUG) console.log('[Electron] Adding to recent documents:', filePath);
    addToRecentFiles(filePath);
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

  // Story 3.4: Setup IPC handlers
  setupIpcHandlers();

  // Story 3.3: Start Go server first
  startGoServer();

  // Story 7.6: Set dock menu on startup (macOS) so it's available before window loads
  updateDockMenu();

  // Wait for server to be ready before creating window
  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Story 7.5: Handle opening files from recent documents menu
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (DEBUG)
    console.log(
      '[Electron] Open file from recent documents or file association:',
      path
    );

  // If window exists, send the file path to renderer to load it
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('menu-open-recent', path);
  } else {
    // Window not ready yet, store the path to open after window is created
    // This can happen if app is launched by double-clicking a file
    if (DEBUG)
      console.log(
        '[Electron] Window not ready, storing file to open after window creation'
      );
    pendingFileToOpen = path;
  }
});

// Cleanup on quit
app.on('window-all-closed', () => {
  console.log('[Electron] All windows closed');

  // Kill Go server process
  if (goServer) {
    console.log('[Electron] Terminating Go server...');
    goServer.kill();
  }

  // Quit app (except on macOS where apps typically stay open)
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  // Story 7.11: Prevent quit if we haven't shown the dialog yet
  // EXCEPT in test mode where we want clean shutdown without dialogs
  const isTestMode = process.env.NODE_ENV === 'test';

  if (!isQuitting && !quitDialogShown && !isTestMode) {
    // Debounce rapid quit attempts (prevent multiple dialogs within 500ms)
    const now = Date.now();
    if (now - lastQuitAttempt < 500) {
      if (DEBUG)
        console.log('[Electron] Ignoring rapid quit attempt (debounced)');
      event.preventDefault();
      return;
    }
    lastQuitAttempt = now;

    event.preventDefault();
    quitDialogShown = true;

    // Trigger the close event on the main window, which will handle the dialog
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
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

  // Ensure Go server is terminated
  if (goServer) {
    goServer.kill('SIGTERM');
  }
});

console.log('[Electron] Main process initialized');
