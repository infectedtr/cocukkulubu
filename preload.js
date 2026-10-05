const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script
 * Securely exposes only necessary IPC channels to the renderer process.
 */

contextBridge.exposeInMainWorld('electronAPI', {
    // Bulk Import API
    startImport: (filePath, type, options = {}) => ipcRenderer.send('import:start', { filePath, type, options }),
    
    // Listeners
    onImportProgress: (callback) => ipcRenderer.on('import:progress', (event, data) => callback(data)),
    onImportStatus: (callback) => ipcRenderer.on('import:status', (event, data) => callback(data)),
    onImportDone: (callback) => ipcRenderer.on('import:done', (event, data) => callback(data)),
    onImportError: (callback) => ipcRenderer.on('import:error', (event, data) => callback(data)),
    
    // General Utilities
    selectFile: () => ipcRenderer.invoke('dialog:openFile'),
});
