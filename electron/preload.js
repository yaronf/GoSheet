// Story 3.2: Electron Preload Script
// Secure IPC bridge between renderer and main process
// Story 10.8 / 16.8: Debug logs when NODE_ENV=development.
//   DEBUG=1 env var is intentionally NOT supported; use --verbose flag instead
//   (main.js appends ?debug=1 to the server URL when --verbose is active, which
//   sets window.__DEBUG__ in the renderer via index.html).
const DEBUG = process.env.NODE_ENV === 'development';

const { contextBridge, ipcRenderer } = require('electron');

if (DEBUG) console.log('[Preload] Initializing secure IPC bridge...');

// Story 10.8: Expose debug flag to frontend for gating console.log
contextBridge.exposeInMainWorld('__DEBUG__', DEBUG);

// Story 3.2: Expose file dialog APIs to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // Story 3.4: Open file dialog
  openFileDialog: () => {
    if (DEBUG) console.log('[Preload] openFileDialog called');
    return ipcRenderer.invoke('dialog:openFile');
  },

  // Story 3.4: Save file dialog
  saveFileDialog: (defaultName) => {
    if (DEBUG)
      console.log(`[Preload] saveFileDialog called (default: ${defaultName})`);
    return ipcRenderer.invoke('dialog:saveFile', defaultName);
  },

  // Story 6.1: Import CSV dialog
  importCSVDialog: () => {
    if (DEBUG) console.log('[Preload] importCSVDialog called');
    return ipcRenderer.invoke('dialog:importCSV');
  },

  // Story 6.3: Export CSV dialog
  exportCSVDialog: (defaultName) => {
    if (DEBUG)
      console.log(`[Preload] exportCSVDialog called (default: ${defaultName})`);
    return ipcRenderer.invoke('dialog:exportCSV', defaultName);
  },

  // Story 7.1: Menu state management
  updateMenuState: (state) => {
    if (DEBUG) console.log('[Preload] updateMenuState called:', state);
    ipcRenderer.send('menu:updateState', state);
  },

  // Story 7.1: Menu event listeners
  // Story 16.7 bug fix: removeAllListeners before registering to prevent
  // listener accumulation across hot reloads or multiple registrations.
  onMenuNew: (callback) => {
    ipcRenderer.removeAllListeners('menu-new');
    ipcRenderer.on('menu-new', callback);
  },
  onMenuOpen: (callback) => {
    ipcRenderer.removeAllListeners('menu-open');
    ipcRenderer.on('menu-open', callback);
  },
  onMenuSave: (callback) => {
    ipcRenderer.removeAllListeners('menu-save');
    ipcRenderer.on('menu-save', callback);
  },
  onMenuSaveAs: (callback) => {
    ipcRenderer.removeAllListeners('menu-save-as');
    ipcRenderer.on('menu-save-as', callback);
  },
  onMenuImportCSV: (callback) => {
    ipcRenderer.removeAllListeners('menu-import-csv');
    ipcRenderer.on('menu-import-csv', callback);
  },
  onMenuExportCSV: (callback) => {
    ipcRenderer.removeAllListeners('menu-export-csv');
    ipcRenderer.on('menu-export-csv', callback);
  },
  onMenuOpenRecent: (callback) => {
    ipcRenderer.removeAllListeners('menu-open-recent');
    ipcRenderer.on('menu-open-recent', callback);
  },

  // Story 16.3: Open CSV file from CLI or Finder "Open With"
  onMenuOpenCSV: (callback) => {
    ipcRenderer.removeAllListeners('menu-open-csv');
    ipcRenderer.on('menu-open-csv', (event, filePath) => callback(filePath));
  },

  // Story 16.4: Open file in read-only mode
  onMenuOpenReadOnly: (callback) => {
    ipcRenderer.removeAllListeners('menu-open-readonly');
    ipcRenderer.on('menu-open-readonly', (_event) => callback());
  },

  // Story 16.3: File-not-found error when pending file is gone at launch
  onOpenFileError: (callback) => {
    ipcRenderer.removeAllListeners('open-file-error');
    ipcRenderer.on('open-file-error', (event, filePath) => callback(filePath));
  },

  // Story 9.6: Formula Reference
  onMenuFormulaReference: (callback) => {
    ipcRenderer.removeAllListeners('menu-formula-reference');
    ipcRenderer.on('menu-formula-reference', callback);
  },

  // User Guide: IPC and markdown rendering
  onMenuUserGuide: (callback) => {
    ipcRenderer.removeAllListeners('menu-user-guide');
    ipcRenderer.on('menu-user-guide', callback);
  },
  getUserGuideContent: () => ipcRenderer.invoke('get-user-guide'),

  // Story 15.2: Undo/Redo menu event listeners
  onMenuUndo: (callback) => {
    ipcRenderer.removeAllListeners('menu-undo');
    ipcRenderer.on('menu-undo', callback);
  },
  onMenuRedo: (callback) => {
    ipcRenderer.removeAllListeners('menu-redo');
    ipcRenderer.on('menu-redo', callback);
  },

  // Story 7.2: Edit menu event listeners
  onMenuCut: (callback) => {
    ipcRenderer.removeAllListeners('menu-cut');
    ipcRenderer.on('menu-cut', callback);
  },
  onMenuCopy: (callback) => {
    ipcRenderer.removeAllListeners('menu-copy');
    ipcRenderer.on('menu-copy', callback);
  },
  onMenuPaste: (callback) => {
    ipcRenderer.removeAllListeners('menu-paste');
    ipcRenderer.on('menu-paste', callback);
  },
  onMenuSelectAll: (callback) => {
    ipcRenderer.removeAllListeners('menu-select-all');
    ipcRenderer.on('menu-select-all', callback);
  },

  // Story 11.5: Format menu (Merge/Unmerge)
  onMenuMergeCells: (callback) => {
    ipcRenderer.removeAllListeners('menu-merge-cells');
    ipcRenderer.on('menu-merge-cells', callback);
  },
  onMenuUnmergeCells: (callback) => {
    ipcRenderer.removeAllListeners('menu-unmerge-cells');
    ipcRenderer.on('menu-unmerge-cells', callback);
  },

  // Story 12.2: Format menu (Style: Title, Header, Total)
  // Story 13.3: Custom styles - use menu-apply-style with styleId
  onMenuStyleTitle: (callback) => {
    ipcRenderer.removeAllListeners('menu-style-title');
    ipcRenderer.on('menu-style-title', callback);
  },
  onMenuStyleHeader: (callback) => {
    ipcRenderer.removeAllListeners('menu-style-header');
    ipcRenderer.on('menu-style-header', callback);
  },
  onMenuStyleTotal: (callback) => {
    ipcRenderer.removeAllListeners('menu-style-total');
    ipcRenderer.on('menu-style-total', callback);
  },
  onMenuApplyStyle: (callback) => {
    ipcRenderer.removeAllListeners('menu-apply-style');
    ipcRenderer.on('menu-apply-style', (event, styleId) => callback(styleId));
  },
  syncFormatMenu: (styles) => {
    ipcRenderer.send('menu:syncStyles', styles);
  },

  // Story 21.1: Clear Formatting
  onMenuClearFormatting: (callback) => {
    ipcRenderer.removeAllListeners('menu-clear-formatting');
    ipcRenderer.on('menu-clear-formatting', callback);
  },

  // Story 12.3: Format Cleanup
  onMenuFormatCleanup: (callback) => {
    ipcRenderer.removeAllListeners('menu-format-cleanup');
    ipcRenderer.on('menu-format-cleanup', callback);
  },

  // Story 13.3: Manage Styles
  onMenuManageStyles: (callback) => {
    ipcRenderer.removeAllListeners('menu-manage-styles');
    ipcRenderer.on('menu-manage-styles', callback);
  },

  // Story 13.1: Insert row/column
  onMenuInsertRow: (callback) => {
    ipcRenderer.removeAllListeners('menu-insert-row');
    ipcRenderer.on('menu-insert-row', callback);
  },
  onMenuInsertColumn: (callback) => {
    ipcRenderer.removeAllListeners('menu-insert-column');
    ipcRenderer.on('menu-insert-column', callback);
  },
  onMenuDeleteRow: (callback) => {
    ipcRenderer.removeAllListeners('menu-delete-row');
    ipcRenderer.on('menu-delete-row', callback);
  },
  onMenuDeleteColumn: (callback) => {
    ipcRenderer.removeAllListeners('menu-delete-column');
    ipcRenderer.on('menu-delete-column', callback);
  },

  // Story 7.5: Recent files management
  addRecentFile: (filePath) => {
    if (DEBUG) console.log('[Preload] addRecentFile called:', filePath);
    return ipcRenderer.invoke('file:addRecent', filePath);
  },

  // Story 8.2: Get recent files for welcome screen
  getRecentFiles: () => ipcRenderer.invoke('file:getRecent'),

  // Story 8.2: Sync menu when welcome screen is shown
  syncRecentFilesMenu: () => ipcRenderer.send('menu:syncRecentFiles'),

  // Story 7.10: Theme change listener
  onThemeChanged: (callback) => {
    ipcRenderer.removeAllListeners('theme-changed');
    ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
  },

  // View menu: RTL and alignment
  onMenuToggleRTL: (callback) => {
    ipcRenderer.removeAllListeners('menu-toggle-rtl');
    ipcRenderer.on('menu-toggle-rtl', (event, checked) =>
      callback(event, checked)
    );
  },
  onMenuAlignLeft: (callback) => {
    ipcRenderer.removeAllListeners('menu-align-left');
    ipcRenderer.on('menu-align-left', callback);
  },
  onMenuAlignCenter: (callback) => {
    ipcRenderer.removeAllListeners('menu-align-center');
    ipcRenderer.on('menu-align-center', callback);
  },
  onMenuAlignRight: (callback) => {
    ipcRenderer.removeAllListeners('menu-align-right');
    ipcRenderer.on('menu-align-right', callback);
  },

  // Story 13.10: Settings persistence (RTL mode, future settings)
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Story 20.6: Go server push events (e.g. cells_changed after agent patch)
  onGoEvent: (callback) => {
    ipcRenderer.removeAllListeners('go:event');
    ipcRenderer.on('go:event', (_event, eventName) => callback(eventName));
  },
});

if (DEBUG) console.log('[Preload] electronAPI exposed to renderer');
if (DEBUG)
  console.log(
    '[Preload] Context isolation maintained - renderer has no direct Node.js access'
  );
