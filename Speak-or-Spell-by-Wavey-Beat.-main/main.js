const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

function speakWelcomeOnLaunch() {
  // Use the built-in macOS voice for a spoken greeting at launch.
  // This is system text-to-speech, not the separate AI singing model.
  if (process.platform === 'darwin') {
    try {
      const greeting = 'Speak or Spell by Wavey Beat is ready. Open Lyrics, enter your words, then choose Sing Text.';
      const child = spawn('say', [greeting], { stdio: 'ignore' });
      child.on('error', () => {});
    } catch (_) {}
  }
}

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
app.whenReady().then(() => {\n  speakWelcomeOnLaunch();
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


// Local neural-worker bridge. A compatible model runner must be installed separately.
ipcMain.handle('render-neural-song', async (_event, song) => {
  if (!song || !Array.isArray(song.notes) || song.notes.length === 0) return { ok: false, code: 'EMPTY_SONG', message: 'Enter lyrics first so the app can prepare a song.' };
  const result = await dialog.showSaveDialog({ title: 'Export AI Singing WAV', defaultPath: path.join(app.getPath('documents'), 'Speak-or-Spell-Vocal.wav'), filters: [{ name: 'WAV Audio', extensions: ['wav'] }] });
  if (result.canceled || !result.filePath) return { canceled: true };
  const appRoot = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked') : __dirname;
  const worker = path.join(appRoot, 'neural-engine', 'worker.py');
  const configPath = path.join(app.getPath('userData'), 'neural-engine.json');
  let savedConfig = {};
  try { savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (_) {}
  const configuredRunner = savedConfig.runnerPath;
  // ACE-Step full-song mode can be connected to a local API without a paid hosted service.
  // It generates whole-song vocals and does not promise exact MIDI note alignment.
  const aceStepUrl = savedConfig.aceStepUrl || 'http://127.0.0.1:8001';
  const python = process.env.SPEAKSPELL_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  if (!fs.existsSync(worker)) return { ok: false, code: 'WORKER_MISSING', message: 'The local singing worker is missing from this installation.' };
  return await new Promise(resolve => {
    const workerEnv = { ...process.env, SPEAKSPELL_ACE_STEP_URL: aceStepUrl };
    if (configuredRunner && fs.existsSync(configuredRunner)) workerEnv.SPEAKSPELL_NEURAL_RUNNER = configuredRunner;
    else delete workerEnv.SPEAKSPELL_NEURAL_RUNNER;
    const child = spawn(python, [worker], { env: workerEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', err => resolve({ ok: false, code: 'PYTHON_UNAVAILABLE', message: 'Could not start Python 3. Install Python 3, then try again. ' + err.message }));
    child.on('close', code => {
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean); let response = null;
      for (const line of lines.reverse()) { try { response = JSON.parse(line); break; } catch (_) {} }
      if (code === 0 && response && response.status === 'complete') resolve({ ok: true, wavPath: response.wavPath });
      else resolve({ ok: false, code: response && response.code || 'WORKER_FAILED', message: response && response.message || stderr.trim() || 'The local singing worker failed.' });
    });
    child.stdin.end(JSON.stringify({ ...song, schemaVersion: 1, outputPath: result.filePath }));
  });
});


ipcMain.handle('choose-neural-runner', async () => {
  const result = await dialog.showOpenDialog({ title: 'Choose a compatible local singing model runner', properties: ['openFile'] });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const selected = result.filePaths[0];
  const configPath = path.join(app.getPath('userData'), 'neural-engine.json');
  let config = {}; try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (_) {}
  config.runnerPath = selected;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  return { canceled: false, runnerPath: selected };
});
