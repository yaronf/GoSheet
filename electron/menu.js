/**
 * Story 7.1 & 7.2: Electron Menu System
 * Native macOS menu bar with File and Edit menu integration
 * 
 * This module manages the application's native menu system, including:
 * - File menu with New, Open, Save, Save As, Import/Export CSV
 * - Edit menu with Cut, Copy, Paste, Select All
 * - Recent Files submenu
 * - Dynamic menu state management (enable/disable based on app state)
 * - Keyboard shortcuts (Cmd+N, Cmd+O, Cmd+S, Cmd+X, Cmd+C, Cmd+V, Cmd+A, etc.)
 * - IPC communication with renderer process
 * 
 * @module electron/menu
 */

const { Menu, app } = require('electron');

/**
 * Reference to the main application window
 * @type {BrowserWindow|null}
 */
let mainWindow = null;

/**
 * Current menu state tracking
 * @type {Object}
 * @property {boolean} hasUnsavedChanges - Whether there are unsaved changes
 * @property {boolean} hasFilePath - Whether a file is currently open
 */
let menuState = {
  hasUnsavedChanges: false,
  hasFilePath: false
};

/**
 * Initialize menu system
 * @param {BrowserWindow} window - Main application window
 */
function initializeMenu(window) {
  mainWindow = window;
  buildMenu();
  console.log('[Menu] Menu system initialized');
}

/**
 * Build and set application menu
 * Creates the menu structure with File menu items, keyboard shortcuts,
 * and click handlers. Automatically includes macOS app menu on macOS.
 * @private
 */
function buildMenu() {
  console.log('[Menu] Building menu, platform:', process.platform);
  
  const template = [
    // macOS app menu (automatically added by Electron on macOS)
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    
    // File menu
    {
      label: 'File',
      submenu: [
        {
          id: 'new',
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            console.log('[Menu] New file triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-new');
            } else {
              console.error('[Menu] Cannot trigger New - mainWindow is null');
            }
          }
        },
        {
          id: 'open',
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            console.log('[Menu] Open file triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-open');
            } else {
              console.error('[Menu] Cannot trigger Open - mainWindow is null');
            }
          }
        },
        { type: 'separator' },
        {
          id: 'recent-files',
          label: 'Recent Files',
          submenu: [
            {
              label: 'No Recent Files',
              enabled: false
            }
          ]
        },
        { type: 'separator' },
        {
          id: 'save',
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: false, // Dynamically updated based on state
          click: () => {
            console.log('[Menu] Save file triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-save');
            } else {
              console.error('[Menu] Cannot trigger Save - mainWindow is null');
            }
          }
        },
        {
          id: 'save-as',
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            console.log('[Menu] Save As triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-save-as');
            } else {
              console.error('[Menu] Cannot trigger Save As - mainWindow is null');
            }
          }
        },
        { type: 'separator' },
        {
          id: 'import-csv',
          label: 'Import CSV...',
          click: () => {
            console.log('[Menu] Import CSV triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-import-csv');
            } else {
              console.error('[Menu] Cannot trigger Import CSV - mainWindow is null');
            }
          }
        },
        {
          id: 'export-csv',
          label: 'Export CSV...',
          click: () => {
            console.log('[Menu] Export CSV triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-export-csv');
            } else {
              console.error('[Menu] Cannot trigger Export CSV - mainWindow is null');
            }
          }
        },
        { type: 'separator' },
        {
          id: 'close',
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        }
      ]
    },
    
    // Story 7.2: Edit menu
    {
      label: 'Edit',
      submenu: [
        {
          id: 'cut',
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            console.log('[Menu] Cut triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-cut');
            } else {
              console.error('[Menu] Cannot trigger Cut - mainWindow is null');
            }
          }
        },
        {
          id: 'copy',
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            console.log('[Menu] Copy triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-copy');
            } else {
              console.error('[Menu] Cannot trigger Copy - mainWindow is null');
            }
          }
        },
        {
          id: 'paste',
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            console.log('[Menu] Paste triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-paste');
            } else {
              console.error('[Menu] Cannot trigger Paste - mainWindow is null');
            }
          }
        },
        { type: 'separator' },
        {
          id: 'select-all',
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            console.log('[Menu] Select All triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-select-all');
            } else {
              console.error('[Menu] Cannot trigger Select All - mainWindow is null');
            }
          }
        }
      ]
    }
  ];
  
  // Add Quit to File menu on non-macOS platforms
  if (process.platform !== 'darwin') {
    // On non-macOS, File menu is at index 0 (no app menu)
    template[0].submenu.push(
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CmdOrCtrl+Q',
        role: 'quit'
      }
    );
  }
  
  console.log('[Menu] Template has', template.length, 'top-level menus');
  const fileMenuIndex = process.platform === 'darwin' ? 1 : 0;
  const editMenuIndex = process.platform === 'darwin' ? 2 : 1;
  console.log('[Menu] File menu has', template[fileMenuIndex].submenu.length, 'items');
  console.log('[Menu] Edit menu has', template[editMenuIndex].submenu.length, 'items');
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  console.log('[Menu] Application menu built and set');
}

/**
 * Update menu state based on application state
 * @param {Object} state - Application state object
 * @param {boolean} state.hasUnsavedChanges - Whether there are unsaved changes
 * @param {boolean} state.hasFilePath - Whether a file path is set
 */
function updateMenuState(state) {
  // Validate input
  if (!state || typeof state !== 'object') {
    console.error('[Menu] Invalid state object:', state);
    return;
  }
  
  menuState = { ...menuState, ...state };
  
  const menu = Menu.getApplicationMenu();
  if (!menu) {
    console.warn('[Menu] No application menu found');
    return;
  }
  
  // Update Save menu item based on unsaved changes
  const saveItem = menu.getMenuItemById('save');
  if (saveItem) {
    saveItem.enabled = menuState.hasUnsavedChanges;
    console.log(`[Menu] Save menu item ${menuState.hasUnsavedChanges ? 'enabled' : 'disabled'}`);
  }
  
  // Save As is always enabled (no state dependency)
  // Import/Export CSV are always enabled
}

/**
 * Update Recent Files submenu
 * Replaces the Recent Files submenu with a list of recently opened files.
 * If no recent files exist, shows "No Recent Files" (disabled).
 * Each recent file item triggers 'menu-open-recent' IPC event with the file path.
 * 
 * @param {Array<string>} recentFiles - Array of recent file paths (max 10 recommended)
 * @example
 * updateRecentFiles(['/path/to/file1.gsheet', '/path/to/file2.gsheet']);
 */
function updateRecentFiles(recentFiles) {
  const menu = Menu.getApplicationMenu();
  if (!menu) {
    console.warn('[Menu] No application menu found');
    return;
  }
  
  const recentFilesItem = menu.getMenuItemById('recent-files');
  if (!recentFilesItem) {
    console.warn('[Menu] Recent Files menu item not found');
    return;
  }
  
  // Build recent files submenu
  const submenu = recentFiles.length > 0
    ? recentFiles.map(filePath => ({
        label: filePath,
        click: () => {
          console.log(`[Menu] Open recent file: ${filePath}`);
          if (mainWindow) {
            mainWindow.webContents.send('menu-open-recent', filePath);
          }
        }
      }))
    : [{
        label: 'No Recent Files',
        enabled: false
      }];
  
  recentFilesItem.submenu = Menu.buildFromTemplate(submenu);
  console.log(`[Menu] Recent files updated (${recentFiles.length} items)`);
}

module.exports = {
  initializeMenu,
  updateMenuState,
  updateRecentFiles
};
