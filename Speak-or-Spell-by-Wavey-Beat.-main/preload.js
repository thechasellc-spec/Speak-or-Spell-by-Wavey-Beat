const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('speakSpell', {
  saveProject: (data) => ipcRenderer.invoke('save-project', data),
  openProject: () => ipcRenderer.invoke('open-project'),
  renderNeuralSong: (song) => ipcRenderer.invoke('render-neural-song', song),
  chooseNeuralRunner: () => ipcRenderer.invoke('choose-neural-runner')
});
