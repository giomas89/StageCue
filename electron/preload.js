const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getProcessStats: () => ipcRenderer.invoke('get-process-stats')
});