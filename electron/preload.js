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
  }
});

console.log('[Preload] electronAPI exposed to renderer');
console.log('[Preload] Context isolation maintained - renderer has no direct Node.js access');
