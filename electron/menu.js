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
 * Story 10.8: Debug logs only when NODE_ENV=development or DEBUG=1
 */
const DEBUG =
  process.env.NODE_ENV === 'development' || process.env.DEBUG === '1';

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
  canMerge: false,
  canUnmerge: false,
  canInsertRow: false,
  canInsertColumn: false,
  isRTL: false,
};

// Cache for rebuild when syncing Format menu styles
let cachedRecentFiles = [];
let cachedOnClearRecent = null;

/**
 * Initialize menu system
 * @param {BrowserWindow} window - Main application window
 * @param {Array<string>} [recentFiles] - Recent file paths for Open Recent submenu
 */
function initializeMenu(window, recentFiles = []) {
  mainWindow = window;
  buildMenu(recentFiles);
  if (DEBUG) console.log('[Menu] Menu system initialized');
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
function buildMenu(recentFiles = [], onClearRecent, styles = null) {
  if (DEBUG)
    console.log(
      '[Menu] Building menu, platform:',
      process.platform,
      'recentFiles:',
      recentFiles?.length,
      'styles:',
      styles?.length ?? 'default'
    );

  cachedRecentFiles = recentFiles || [];
  cachedOnClearRecent = onClearRecent;

  const recentSubmenu = buildRecentFilesSubmenu(
    cachedRecentFiles,
    cachedOnClearRecent
  );

  // Build Format style items: Title, Header, Total + custom styles (Story 13.3)
  const styleItems =
    styles && styles.length > 0
      ? styles.map((s) => {
          const item = {
            id: `style-${s.id}`,
            label: s.name || 'Style ' + s.id,
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.send('menu-apply-style', s.id);
              }
            },
          };
          if (s.id === 1) item.accelerator = 'CmdOrCtrl+Shift+1';
          if (s.id === 2) item.accelerator = 'CmdOrCtrl+Shift+2';
          if (s.id === 3) item.accelerator = 'CmdOrCtrl+Shift+3';
          return item;
        })
      : [
          {
            id: 'style-title',
            label: 'Title',
            accelerator: 'CmdOrCtrl+Shift+1',
            click: () => mainWindow?.webContents.send('menu-apply-style', 1),
          },
          {
            id: 'style-header',
            label: 'Header',
            accelerator: 'CmdOrCtrl+Shift+2',
            click: () => mainWindow?.webContents.send('menu-apply-style', 2),
          },
          {
            id: 'style-total',
            label: 'Total',
            accelerator: 'CmdOrCtrl+Shift+3',
            click: () => mainWindow?.webContents.send('menu-apply-style', 3),
          },
        ];

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
            if (DEBUG) console.log('[Menu] New file triggered');
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
            if (DEBUG) console.log('[Menu] Open file triggered');
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
            if (DEBUG) console.log('[Menu] Save file triggered');
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
            if (DEBUG) console.log('[Menu] Save As triggered');
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
            if (DEBUG) console.log('[Menu] Import CSV triggered');
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
            if (DEBUG) console.log('[Menu] Export CSV triggered');
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
            if (DEBUG) console.log('[Menu] Cut triggered');
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
            if (DEBUG) console.log('[Menu] Copy triggered');
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
            if (DEBUG) console.log('[Menu] Paste triggered');
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
            if (DEBUG) console.log('[Menu] Select All triggered');
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

    // Story 11.5: Format menu (Merge cells, Unmerge)
    {
      label: 'Format',
      submenu: [
        {
          id: 'merge-cells',
          label: 'Merge Cells',
          accelerator: 'CmdOrCtrl+Shift+M',
          enabled: false,
          click: () => {
            if (DEBUG) console.log('[Menu] Merge Cells triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-merge-cells');
            }
          },
        },
        {
          id: 'unmerge-cells',
          label: 'Unmerge',
          enabled: false,
          click: () => {
            if (DEBUG) console.log('[Menu] Unmerge triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-unmerge-cells');
            }
          },
        },
        { type: 'separator' },
        ...styleItems,
        { type: 'separator' },
        {
          id: 'format-cleanup',
          label: 'Format Cleanup',
          click: () => {
            if (DEBUG) console.log('[Menu] Format Cleanup triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-format-cleanup');
            }
          },
        },
        { type: 'separator' },
        {
          id: 'manage-styles',
          label: 'Manage Styles...',
          click: () => {
            if (DEBUG) console.log('[Menu] Manage Styles triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-manage-styles');
            }
          },
        },
      ],
    },

    // View menu: alignment and RTL
    {
      label: 'View',
      submenu: [
        {
          id: 'toggle-rtl',
          label: 'RTL Mode',
          type: 'checkbox',
          checked: menuState.isRTL,
          click: (menuItem) => {
            if (DEBUG)
              console.log(
                '[Menu] RTL Mode clicked, checked:',
                menuItem.checked
              );
            if (mainWindow)
              mainWindow.webContents.send('menu-toggle-rtl', menuItem.checked);
          },
        },
        { type: 'separator' },
        {
          id: 'align-left',
          label: 'Align Left',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-align-left');
          },
        },
        {
          id: 'align-center',
          label: 'Align Center',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-align-center');
          },
        },
        {
          id: 'align-right',
          label: 'Align Right',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-align-right');
          },
        },
      ],
    },

    // Story 13.1: Insert menu (row/column)
    {
      label: 'Insert',
      submenu: [
        {
          id: 'insert-row',
          label: 'Insert Row Above',
          enabled: false,
          click: () => {
            if (DEBUG) console.log('[Menu] Insert Row triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-insert-row');
            }
          },
        },
        {
          id: 'insert-column',
          label: 'Insert Column Before',
          enabled: false,
          click: () => {
            if (DEBUG) console.log('[Menu] Insert Column triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-insert-column');
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
            if (DEBUG) console.log('[Menu] Formula Reference triggered');
            if (mainWindow) {
              mainWindow.webContents.send('menu-formula-reference');
            }
          },
        },
        {
          id: 'user-guide',
          label: 'User Guide',
          click: () => {
            if (DEBUG) console.log('[Menu] User Guide triggered');
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
            if (DEBUG) console.log('[Menu] About GoSheet triggered');
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

  if (DEBUG)
    console.log('[Menu] Template has', template.length, 'top-level menus');
  const fileMenuIndex = process.platform === 'darwin' ? 1 : 0;
  const editMenuIndex = process.platform === 'darwin' ? 2 : 1;
  const helpMenuIndex = process.platform === 'darwin' ? 6 : 5; // View + Insert added
  if (DEBUG)
    console.log(
      '[Menu] File menu has',
      template[fileMenuIndex].submenu.length,
      'items'
    );
  if (DEBUG)
    console.log(
      '[Menu] Edit menu has',
      template[editMenuIndex].submenu.length,
      'items'
    );
  if (DEBUG)
    console.log(
      '[Menu] Help menu has',
      template[helpMenuIndex].submenu.length,
      'items'
    );

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  if (DEBUG) console.log('[Menu] Application menu built and set');
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
    if (DEBUG)
      console.log(
        `[Menu] Save menu item ${menuState.hasUnsavedChanges ? 'enabled' : 'disabled'}`
      );
  }

  // Story 11.5: Update Format menu Merge/Unmerge based on selection
  const mergeItem = menu.getMenuItemById('merge-cells');
  if (mergeItem && menuState.canMerge !== undefined) {
    mergeItem.enabled = menuState.canMerge;
  }
  const unmergeItem = menu.getMenuItemById('unmerge-cells');
  if (unmergeItem && menuState.canUnmerge !== undefined) {
    unmergeItem.enabled = menuState.canUnmerge;
  }

  // Story 13.1: Update Insert menu based on selection mode
  const insertRowItem = menu.getMenuItemById('insert-row');
  if (insertRowItem && menuState.canInsertRow !== undefined) {
    insertRowItem.enabled = menuState.canInsertRow;
  }
  const insertColItem = menu.getMenuItemById('insert-column');
  if (insertColItem && menuState.canInsertColumn !== undefined) {
    insertColItem.enabled = menuState.canInsertColumn;
  }

  // RTL mode checkbox
  const rtlItem = menu.getMenuItemById('toggle-rtl');
  if (rtlItem && menuState.isRTL !== undefined) {
    rtlItem.checked = menuState.isRTL;
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
  if (DEBUG)
    console.log(
      '[Menu] updateRecentFiles: rebuilding menu with',
      recentFiles?.length,
      'files'
    );
  buildMenu(recentFiles || [], options.onClear);
  updateMenuState(menuState);
}

/**
 * Story 13.3: Sync Format menu with custom styles from API.
 * Rebuilds Format submenu with Title, Header, Total + any custom styles.
 * @param {Array<{id: number, name: string}>} styles - From GET /api/styles
 */
function updateFormatMenuStyles(styles) {
  if (DEBUG)
    console.log('[Menu] Syncing Format menu with', styles?.length, 'styles');
  buildMenu(cachedRecentFiles, cachedOnClearRecent, styles || []);
  updateMenuState(menuState);
}

module.exports = {
  initializeMenu,
  updateMenuState,
  updateRecentFiles,
  updateFormatMenuStyles,
};
