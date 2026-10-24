const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 680,
    minHeight: 560,
    title: 'Speak or Spell by Wavey Beat',
    backgroundColor: '#151d20',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
ipcMain.handle('save-project', async (_event, data) => {
  const result = await dialog.showSaveDialog({
    title: 'Save Speak or Spell Project',
    defaultPath: 'My Song.sos.json',
    filters: [{ name: 'Speak or Spell Project', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
  return { canceled: false, filePath: result.filePath };
});
ipcMain.handle('open-project', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Speak or Spell Project',
    properties: ['openFile'],
    filters: [{ name: 'Speak or Spell Project', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  try {
    return { canceled: false, data: JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')) };
  } catch (_error) {
    return { canceled: false, error: 'That project file could not be read as valid JSON.' };
  }
});
