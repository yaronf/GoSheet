/**
 * Story 7.1, 7.2 & 7.3: Electron Menu System
 * Native macOS menu bar with File, Edit, and Help menu integration
 *
 * This module manages the application's native menu system, including:
 * - File menu with New, Open, Save, Save As, Import/Export CSV
 * - Edit menu with Cut, Copy, Paste, Select All
 * - Help menu with About GoSheet
 * - Recent Files submenu
 * - Dynamic menu state management (enable/disable based on app state)
 * - Keyboard shortcuts (Cmd+N, Cmd+O, Cmd+S, Cmd+X, Cmd+C, Cmd+V, Cmd+A, etc.)
 * - IPC communication with renderer process
 *
 * @module electron/menu
 */

const { Menu, app } = require('electron');
const path = require('path');

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
  hasFilePath: false,
};

/**
 * Initialize menu system
 * @param {BrowserWindow} window - Main application window
 * @param {Array<string>} [recentFiles] - Recent file paths for Open Recent submenu
 */
function initializeMenu(window, recentFiles = []) {
  mainWindow = window;
  buildMenu(recentFiles);
  console.log('[Menu] Menu system initialized');
}

/**
 * Build recent files submenu items
 * @param {Array<string>} recentFiles - File paths
 * @param {Function} [onClear] - Callback when Clear Recent is clicked
 */
function buildRecentFilesSubmenu(recentFiles, onClear) {
  const items =
    recentFiles.length > 0
      ? recentFiles.map((filePath) => {
          const filename = path.basename(filePath);
          const parentDir = path.basename(path.dirname(filePath));
          const label =
            parentDir && parentDir !== '.'
              ? `${filename} — ${parentDir}`
              : filename;
          return {
            label,
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.send('menu-open-recent', filePath);
              }
            },
          };
        })
      : [{ label: 'No Recent Files', enabled: false }];
  items.push({ type: 'separator' });
  items.push({ label: 'Clear Recent', click: () => onClear && onClear() });
  return items;
}

/**
 * Build and set application menu
 * On macOS, the menu must be rebuilt and set again for changes to appear.
 * @param {Array<string>} [recentFiles] - Recent file paths for Open Recent submenu
 * @param {Function} [onClearRecent] - Callback when Clear Recent is clicked
 */
function buildMenu(recentFiles = [], onClearRecent) {
  console.log(
    '[Menu] Building menu, platform:',
    process.platform,
    'recentFiles:',
    recentFiles?.length
  );

  const recentSubmenu = buildRecentFilesSubmenu(
    recentFiles || [],
    onClearRecent
  );

  const template = [
    // macOS app menu (automatically added by Electron on macOS)
    ...(process.platform === 'darwin'
      ? [
          {
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
              { role: 'quit' },
            ],
          },
        ]
      : []),

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
          },
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
          },
        },
        { type: 'separator' },
        {
          id: 'recent-files',
          label: 'Open Recent',
          submenu: recentSubmenu,
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
          },
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
              console.error(
                '[Menu] Cannot trigger Save As - mainWindow is null'
              );
            }
          },
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
              console.error(
                '[Menu] Cannot trigger Import CSV - mainWindow is null'
              );
            }
          },
        },
        {
          id: 'export-csv',
          label: 'Export CSV...',
          click: () => {
            console.log('[Menu] Export CSV triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-export-csv');
            } else {
              console.error(
                '[Menu] Cannot trigger Export CSV - mainWindow is null'
              );
            }
          },
        },
        { type: 'separator' },
        {
          id: 'close',
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          role: 'close',
        },
      ],
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
          },
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
          },
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
          },
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
              console.error(
                '[Menu] Cannot trigger Select All - mainWindow is null'
              );
            }
          },
        },
      ],
    },

    // Story 7.3: Help menu | Story 9.6: Formula Reference
    // Note: Don't use role: 'help' - it can prevent custom submenu items from receiving clicks on macOS
    {
      label: 'Help',
      submenu: [
        {
          id: 'formula-reference',
          label: 'Formula Reference',
          click: () => {
            console.log('[Menu] Formula Reference triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-formula-reference');
            }
          },
        },
        {
          id: 'user-guide',
          label: 'User Guide',
          click: () => {
            console.log('[Menu] User Guide triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-user-guide');
            }
          },
        },
        { type: 'separator' },
        {
          id: 'about',
          label: 'About GoSheet',
          click: () => {
            console.log('[Menu] About GoSheet triggered');
            // Use Electron's native About panel (macOS)
            app.showAboutPanel();
          },
        },
      ],
    },
  ];

  // Add Quit to File menu on non-macOS platforms
  if (process.platform !== 'darwin') {
    // On non-macOS, File menu is at index 0 (no app menu)
    template[0].submenu.push(
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CmdOrCtrl+Q',
        role: 'quit',
      }
    );
  }

  console.log('[Menu] Template has', template.length, 'top-level menus');
  const fileMenuIndex = process.platform === 'darwin' ? 1 : 0;
  const editMenuIndex = process.platform === 'darwin' ? 2 : 1;
  const helpMenuIndex = process.platform === 'darwin' ? 3 : 2;
  console.log(
    '[Menu] File menu has',
    template[fileMenuIndex].submenu.length,
    'items'
  );
  console.log(
    '[Menu] Edit menu has',
    template[editMenuIndex].submenu.length,
    'items'
  );
  console.log(
    '[Menu] Help menu has',
    template[helpMenuIndex].submenu.length,
    'items'
  );

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
    console.log(
      `[Menu] Save menu item ${menuState.hasUnsavedChanges ? 'enabled' : 'disabled'}`
    );
  }

  // Save As is always enabled (no state dependency)
  // Import/Export CSV are always enabled
}

/**
 * Update Recent Files - rebuilds entire menu and sets it again.
 * Required on macOS: modifying menu in place has no effect; must call setApplicationMenu.
 * @param {Array<string>} recentFiles - Array of recent file paths
 * @param {Object} [options] - Optional callbacks
 * @param {Function} [options.onClear] - Called when user clicks Clear Recent
 */
function updateRecentFiles(recentFiles, options = {}) {
  console.log(
    '[Menu] updateRecentFiles: rebuilding menu with',
    recentFiles?.length,
    'files'
  );
  buildMenu(recentFiles || [], options.onClear);
  updateMenuState(menuState);
}

module.exports = {
  initializeMenu,
  updateMenuState,
  updateRecentFiles,
};
