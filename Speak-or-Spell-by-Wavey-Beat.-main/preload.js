const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('speakSpell', {
  saveProject: (data) => ipcRenderer.invoke('save-project', data),
  openProject: () => ipcRenderer.invoke('open-project'),
  generateLocalAIVocal: (options) => ipcRenderer.invoke('generate-local-ai-vocal', options)
});
