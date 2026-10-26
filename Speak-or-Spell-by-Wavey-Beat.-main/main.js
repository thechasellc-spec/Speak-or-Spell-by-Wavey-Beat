const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const AI_BASE = 'http://127.0.0.1:8001';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function aiRequest(route, options = {}) {
  const response = await fetch(new URL(route, AI_BASE), {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: { ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  if (!response.ok) throw new Error(`Local singing engine returned HTTP ${response.status}.`);
  return response;
}

async function createLocalAIVocal({ lyrics, style = 'upbeat pop', duration = 30, bpm = 100 }) {
  if (typeof lyrics !== 'string' || !lyrics.trim()) throw new Error('Enter lyrics before generating a vocal.');
  if (lyrics.length > 12000) throw new Error('Please keep lyrics under 12,000 characters for this test.');
  // Deliberately loopback-only: no paid API, account, or remote endpoint.
  try {
    await aiRequest('/health');
  } catch (_error) {
    throw new Error('The free local AI singer is not running. Install and start ACE-Step 1.5 locally, then retry. No paid API is used.');
  }

  const submitted = await aiRequest('/release_task', {
    method: 'POST',
    body: JSON.stringify({
      prompt: `${style}, clear lead vocal, sung lyrics, catchy hook, studio mix`,
      lyrics: lyrics.trim(),
      vocal_language: 'en',
      audio_format: 'mp3',
      audio_duration: Math.max(15, Math.min(120, Number(duration) || 30)),
      bpm: Math.max(60, Math.min(180, Number(bpm) || 100)),
      batch_size: 1,
      thinking: true
    })
  });
  const submitJson = await submitted.json();
  const taskId = submitJson?.data?.task_id || submitJson?.task_id;
  if (!taskId) throw new Error(submitJson?.error || 'The local AI engine did not return a task ID.');

  let completed = null;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    await wait(2000);
    const statusResponse = await aiRequest('/query_result', {
      method: 'POST',
      body: JSON.stringify({ task_id_list: [taskId] })
    });
    const statusJson = await statusResponse.json();
    const rows = Array.isArray(statusJson?.data) ? statusJson.data : [];
    const row = rows.find((item) => item.task_id === taskId) || rows[0];
    if (!row) continue;
    let result = row.result;
    if (typeof result === 'string') {
      try { result = JSON.parse(result); } catch (_error) { result = []; }
    }
    const item = Array.isArray(result) ? result[0] : result;
    if (row.status === 2 || item?.status === 2) throw new Error('The local AI engine reported that vocal generation failed.');
    if (row.status === 1 || item?.status === 1) {
      completed = item;
      break;
    }
  }
  if (!completed?.file) throw new Error('Vocal generation is taking too long. Check the local ACE-Step window and try again.');

  let audioUrl;
  if (/^https?:\/\//i.test(completed.file)) {
    const parsed = new URL(completed.file);
    if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname)) {
      throw new Error('The local engine returned a non-local audio URL; it was blocked for privacy.');
    }
    audioUrl = parsed.toString();
  } else {
    audioUrl = new URL('/v1/audio?path=' + encodeURIComponent(completed.file), AI_BASE).toString();
  }
  const audioResponse = await fetch(audioUrl, { signal: AbortSignal.timeout(60000) });
  if (!audioResponse.ok) throw new Error('The AI finished, but its audio file could not be retrieved.');
  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  return {
    audioDataUrl: 'data:audio/mpeg;base64,' + audioBuffer.toString('base64'),
    fileName: 'speak-or-spell-ai-vocal.mp3',
    bytes: audioBuffer.length
  };
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
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
ipcMain.handle('generate-local-ai-vocal', async (_event, options) => {
  try { return { ok: true, ...(await createLocalAIVocal(options || {})) }; }
  catch (error) { return { ok: false, error: error.message || 'Local AI vocal generation failed.' }; }
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
