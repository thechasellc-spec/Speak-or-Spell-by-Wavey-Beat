const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('speakSpell', {
  saveProject: (data) => ipcRenderer.invoke('save-project', data),
  openProject: () => ipcRenderer.invoke('open-project')
});
