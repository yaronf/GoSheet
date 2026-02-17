// Story 3.1: Electron Main Process
// Handles app lifecycle, Go server spawning, and window creation

const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const { spawn } = require('child_process');
const path = require('node:path');
const { initializeMenu, updateMenuState } = require('./menu');

let mainWindow;
let goServer;
const GO_SERVER_PORT = 3000;

// Story 7.7: Store file path to open when app is launched by double-clicking a file
let pendingFileToOpen = null;

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
  
  console.log(`[Electron] Mode: ${isDev ? 'development' : 'production'}`);
  console.log(`[Electron] Server path: ${serverPath}`);
  
  // Check if server binary exists
  const fs = require('fs');
  if (!fs.existsSync(serverPath)) {
    console.error(`[Electron] ERROR: Go server binary not found at: ${serverPath}`);
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
    ? path.join(__dirname, '..')  // Project root in dev mode
    : process.resourcesPath;       // Resources directory in packaged app
  
  console.log(`[Electron] Server working directory: ${serverCwd}`);
  
  goServer = spawn(serverPath, ['--port', GO_SERVER_PORT.toString()], {
    cwd: serverCwd,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Log server output
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
  console.log('[Electron] Creating main window...');
  
  const isTest = process.env.NODE_ENV === 'test';
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'GoSheet',
    show: !isTest, // Hide window in test mode
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  
  // Load frontend from Go HTTP server
  const serverUrl = `http://localhost:${GO_SERVER_PORT}`;
  console.log(`[Electron] Loading frontend from: ${serverUrl}`);
  
  // Clear cache in development mode to ensure latest code is loaded
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.session.clearCache().then(() => {
      console.log('[Electron] Cache cleared');
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
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message}`);
  });
  
  // Story 7.7: Handle pending file to open after window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFileToOpen) {
      console.log('[Electron] Window ready, opening pending file:', pendingFileToOpen);
      mainWindow.webContents.send('menu-open-recent', pendingFileToOpen);
      pendingFileToOpen = null;
    }
    
    // Story 7.10: Send initial theme to renderer
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    console.log('[Electron] Sending initial theme to renderer:', theme);
    mainWindow.webContents.send('theme-changed', theme);
  });
  
  // Story 7.10: Listen for system theme changes
  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    console.log('[Electron] System theme changed to:', theme);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('theme-changed', theme);
    }
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Story 7.1: Initialize menu system
  initializeMenu(mainWindow);
  
  console.log('[Electron] Main window created');
}

// Story 3.4: Setup IPC handlers
function setupIpcHandlers() {
  // IPC handler for file dialogs - Open File
  ipcMain.handle('dialog:openFile', async () => {
    console.log('[Electron] Open file dialog requested');
    
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Spreadsheet',
      filters: [
        { name: 'Spreadsheet Files', extensions: ['sheet'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (result.canceled) {
      console.log('[Electron] Open dialog cancelled');
      return null;
    }
    
    const filePath = result.filePaths[0];
    console.log(`[Electron] File selected: ${filePath}`);
    return filePath;
  });

  // IPC handler for file dialogs - Save File
  ipcMain.handle('dialog:saveFile', async (event, defaultName = 'Untitled.sheet') => {
    console.log(`[Electron] Save file dialog requested (default: ${defaultName})`);
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Spreadsheet',
      defaultPath: defaultName,
      filters: [
        { name: 'Spreadsheet Files', extensions: ['sheet'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      console.log('[Electron] Save dialog cancelled');
      return null;
    }
    
    const filePath = result.filePath;
    console.log(`[Electron] Save path selected: ${filePath}`);
    return filePath;
  });

  // IPC handler for CSV file dialogs - Import CSV
  ipcMain.handle('dialog:importCSV', async () => {
    console.log('[Electron] Import CSV dialog requested');
    
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import CSV File',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (result.canceled) {
      console.log('[Electron] Import CSV dialog cancelled');
      return null;
    }
    
    const filePath = result.filePaths[0];
    console.log(`[Electron] CSV file selected: ${filePath}`);
    return filePath;
  });

  // IPC handler for CSV file dialogs - Export CSV
  ipcMain.handle('dialog:exportCSV', async (event, defaultName = 'Untitled.csv') => {
    console.log(`[Electron] Export CSV dialog requested (default: ${defaultName})`);
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export to CSV',
      defaultPath: defaultName,
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      console.log('[Electron] Export CSV dialog cancelled');
      return null;
    }
    
    const filePath = result.filePath;
    console.log(`[Electron] CSV export path selected: ${filePath}`);
    return filePath;
  });

  // Story 7.1: IPC handler for menu state updates
  ipcMain.on('menu:updateState', (event, state) => {
    console.log('[Electron] Menu state update received:', state);
    updateMenuState(state);
  });

  // Story 7.5: IPC handler to add file to recent documents
  ipcMain.handle('file:addRecent', async (event, filePath) => {
    console.log('[Electron] Adding to recent documents:', filePath);
    app.addRecentDocument(filePath);
    return true;
  });
}

// App lifecycle management
app.whenReady().then(() => {
  console.log('[Electron] App ready, initializing...');
  
  // Story 7.3: Configure About panel for macOS
  app.setAboutPanelOptions({
    applicationName: app.getName(), // Uses productName from package.json
    applicationVersion: app.getVersion(),
    copyright: `© ${new Date().getFullYear()} All rights reserved`,
    credits: 'Lightweight, fast spreadsheet for macOS'
  });
  console.log(`[Electron] About panel configured for ${app.getName()} v${app.getVersion()}`);
  
  // Story 3.4: Setup IPC handlers
  setupIpcHandlers();
  
  // Story 3.3: Start Go server first
  startGoServer();
  
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
  console.log('[Electron] Open file from recent documents or file association:', path);
  
  // If window exists, send the file path to renderer to load it
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('menu-open-recent', path);
  } else {
    // Window not ready yet, store the path to open after window is created
    // This can happen if app is launched by double-clicking a file
    console.log('[Electron] Window not ready, storing file to open after window creation');
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

app.on('before-quit', () => {
  console.log('[Electron] App quitting, cleaning up...');
  
  // Ensure Go server is terminated
  if (goServer) {
    goServer.kill('SIGTERM');
  }
});

console.log('[Electron] Main process initialized');
