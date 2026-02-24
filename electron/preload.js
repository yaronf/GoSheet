// Story 3.2: Electron Preload Script
// Secure IPC bridge between renderer and main process

const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Initializing secure IPC bridge...');

// Story 3.2: Expose file dialog APIs to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // Story 3.4: Open file dialog
  openFileDialog: () => {
    console.log('[Preload] openFileDialog called');
    return ipcRenderer.invoke('dialog:openFile');
  },

  // Story 3.4: Save file dialog
  saveFileDialog: (defaultName) => {
    console.log(`[Preload] saveFileDialog called (default: ${defaultName})`);
    return ipcRenderer.invoke('dialog:saveFile', defaultName);
  },

  // Story 6.1: Import CSV dialog
  importCSVDialog: () => {
    console.log('[Preload] importCSVDialog called');
    return ipcRenderer.invoke('dialog:importCSV');
  },

  // Story 6.3: Export CSV dialog
  exportCSVDialog: (defaultName) => {
    console.log(`[Preload] exportCSVDialog called (default: ${defaultName})`);
    return ipcRenderer.invoke('dialog:exportCSV', defaultName);
  },

  // Story 7.1: Menu state management
  updateMenuState: (state) => {
    console.log('[Preload] updateMenuState called:', state);
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

  // Story 7.5: Recent files management
  addRecentFile: (filePath) => {
    console.log('[Preload] addRecentFile called:', filePath);
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
});

console.log('[Preload] electronAPI exposed to renderer');
console.log(
  '[Preload] Context isolation maintained - renderer has no direct Node.js access'
);
