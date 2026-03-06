// Story 3.2: Electron Preload Script
// Secure IPC bridge between renderer and main process
// Story 10.8: Debug logs when NODE_ENV=development or DEBUG=1 (matches AC)
const DEBUG =
  process.env.NODE_ENV === 'development' || process.env.DEBUG === '1';

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
  onMenuNew: (callback) => {
    ipcRenderer.on('menu-new', callback);
  },
  onMenuOpen: (callback) => {
    ipcRenderer.on('menu-open', callback);
  },
  onMenuSave: (callback) => {
    ipcRenderer.on('menu-save', callback);
  },
  onMenuSaveAs: (callback) => {
    ipcRenderer.on('menu-save-as', callback);
  },
  onMenuImportCSV: (callback) => {
    ipcRenderer.on('menu-import-csv', callback);
  },
  onMenuExportCSV: (callback) => {
    ipcRenderer.on('menu-export-csv', callback);
  },
  onMenuOpenRecent: (callback) => {
    ipcRenderer.on('menu-open-recent', callback);
  },

  // Story 9.6: Formula Reference
  onMenuFormulaReference: (callback) => {
    ipcRenderer.on('menu-formula-reference', callback);
  },

  // User Guide: IPC and markdown rendering
  onMenuUserGuide: (callback) => {
    ipcRenderer.on('menu-user-guide', callback);
  },
  getUserGuideContent: () => ipcRenderer.invoke('get-user-guide'),

  // Story 15.2: Undo/Redo menu event listeners
  onMenuUndo: (callback) => {
    ipcRenderer.on('menu-undo', callback);
  },
  onMenuRedo: (callback) => {
    ipcRenderer.on('menu-redo', callback);
  },

  // Story 7.2: Edit menu event listeners
  onMenuCut: (callback) => {
    ipcRenderer.on('menu-cut', callback);
  },
  onMenuCopy: (callback) => {
    ipcRenderer.on('menu-copy', callback);
  },
  onMenuPaste: (callback) => {
    ipcRenderer.on('menu-paste', callback);
  },
  onMenuSelectAll: (callback) => {
    ipcRenderer.on('menu-select-all', callback);
  },

  // Story 11.5: Format menu (Merge/Unmerge)
  onMenuMergeCells: (callback) => {
    ipcRenderer.on('menu-merge-cells', callback);
  },
  onMenuUnmergeCells: (callback) => {
    ipcRenderer.on('menu-unmerge-cells', callback);
  },

  // Story 12.2: Format menu (Style: Title, Header, Total)
  // Story 13.3: Custom styles - use menu-apply-style with styleId
  onMenuStyleTitle: (callback) => {
    ipcRenderer.on('menu-style-title', callback);
  },
  onMenuStyleHeader: (callback) => {
    ipcRenderer.on('menu-style-header', callback);
  },
  onMenuStyleTotal: (callback) => {
    ipcRenderer.on('menu-style-total', callback);
  },
  onMenuApplyStyle: (callback) => {
    ipcRenderer.on('menu-apply-style', (event, styleId) => callback(styleId));
  },
  syncFormatMenu: (styles) => {
    ipcRenderer.send('menu:syncStyles', styles);
  },

  // Story 12.3: Format Cleanup
  onMenuFormatCleanup: (callback) => {
    ipcRenderer.on('menu-format-cleanup', callback);
  },

  // Story 13.3: Manage Styles
  onMenuManageStyles: (callback) => {
    ipcRenderer.on('menu-manage-styles', callback);
  },

  // Story 13.1: Insert row/column
  onMenuInsertRow: (callback) => {
    ipcRenderer.on('menu-insert-row', callback);
  },
  onMenuInsertColumn: (callback) => {
    ipcRenderer.on('menu-insert-column', callback);
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
    ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
  },

  // View menu: RTL and alignment
  onMenuToggleRTL: (callback) => {
    ipcRenderer.on('menu-toggle-rtl', (event, checked) =>
      callback(event, checked)
    );
  },
  onMenuAlignLeft: (callback) => {
    ipcRenderer.on('menu-align-left', callback);
  },
  onMenuAlignCenter: (callback) => {
    ipcRenderer.on('menu-align-center', callback);
  },
  onMenuAlignRight: (callback) => {
    ipcRenderer.on('menu-align-right', callback);
  },

  // Story 13.10: Settings persistence (RTL mode, future settings)
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
});

if (DEBUG) console.log('[Preload] electronAPI exposed to renderer');
if (DEBUG)
  console.log(
    '[Preload] Context isolation maintained - renderer has no direct Node.js access'
  );
