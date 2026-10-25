const $ = (id) => document.getElementById(id);
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const vowelForLetter = { A: 'a', B: 'e', C: 'a', D: 'e', E: 'i', F: 'e', G: 'a', H: 'a', I: 'i', J: 'i', K: 'e', L: 'e', M: 'a', N: 'e', O: 'o', P: 'e', Q: 'u', R: 'a', S: 'e', T: 'i', U: 'u', V: 'i', W: 'u', X: 'e', Y: 'i', Z: 'e' };

let audioCtx = null;
let master = null;
let singerEngine = null;
let midiAccess = null;
let activeVoices = new Map();
let lastNote = 60;
let projectSaved = false;

function audioReady() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.value = Number(($('volume') && $('volume').value) || 70) / 100;
    master.connect(audioCtx.destination);
    singerEngine = new window.WaveySingerEngine(audioCtx, master);
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  return audioCtx;
}

function setLCD(text, note) {
  const lcdText = $('lcdText');
  if (lcdText) lcdText.textContent = String(text || '').toUpperCase().slice(0, 28);

  if (note !== undefined) {
    const noteIndex = ((note % 12) + 12) % 12;
    const readout = $('noteReadout');
    if (readout) {
      readout.textContent = 'NOTE: ' + noteNames[noteIndex] + (Math.floor(note / 12) - 1);
    }
  }
}

function selectedVowel() {
  return $('vowel') ? $('vowel').value : 'a';
}

function getRangeValue(id, fallback) {
  const el = $(id);
  if (!el) return fallback;
  const value = Number(el.value);
  return Number.isFinite(value) ? value : fallback;
}

function formantFor(vowel, bright) {
  const f = { a: [800, 1150, 2900], e: [500, 1900, 2600], i: [300, 2200, 3000], o: [500, 900, 2600], u: [350, 800, 2200] }[vowel] || [800, 1150, 2900];
  return f.map((value, index) => value * (index === 0 ? 0.8 + bright * 0.5 : 1));
}

function startVoice(id, note, vowel, velocity = 0.8) {
  audioReady();
  stopVoice(id, 0.035);

  const now = audioCtx.currentTime;
  const freq = 440 * Math.pow(2, (note - 69) / 12);
  const bright = Number(($('brightness') && $('brightness').value) || 55) / 100;
  const mix = Number(($('singMix') && $('singMix').value) || 60) / 100;
  const character = $('voiceStyle') ? $('voiceStyle').value : 'retro';
  const charShift = character === 'masculine' ? 0.72 : character === 'feminine' ? 1.18 : 0.92;

  const osc = audioCtx.createOscillator();
  const sub = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filters = formantFor(vowel, bright).map((hz, index) => {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = hz * charShift;
    filter.Q.value = index === 0 ? 2.4 : 4.2;
    return filter;
  });

  const formGain = audioCtx.createGain();
  formGain.gain.value = 0.22 + mix * 0.52;

  osc.type = mix > 0.6 ? 'sawtooth' : 'square';
  osc.frequency.setValueAtTime(freq, now);
  sub.type = 'triangle';
  sub.frequency.setValueAtTime(freq * 0.5, now);

  const oscGain = audioCtx.createGain();
  oscGain.gain.value = 0.14 + (1 - mix) * 0.18;

  osc.connect(oscGain);
  oscGain.connect(filters[0]);
  sub.connect(filters[1]);
  filters.forEach((filter, index) => {
    filter.connect(formGain);
    if (index < filters.length - 1) filter.connect(filters[index + 1]);
  });

  formGain.connect(gain);
  oscGain.connect(gain);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.02, velocity * 0.45), now + 0.025);
  gain.connect(master);

  const vib = audioCtx.createOscillator();
  const vibGain = audioCtx.createGain();
  vib.frequency.value = 5.2;
  vibGain.gain.value = freq * (getRangeValue('vibrato', 18) / 100) * 0.012 * mix;
  vib.connect(vibGain);
  vibGain.connect(osc.frequency);
  vibGain.connect(sub.frequency);

  osc.start(now);
  sub.start(now);
  vib.start(now);

  const voice = { osc, sub, vib, gain, filters, formGain, oscGain, vibGain };
  activeVoices.set(id, voice);
  lastNote = note;
  setLCD(String(vowel).toUpperCase() + '  ♪', note);
}

function stopVoice(id, release = 0.12) {
  const voice = activeVoices.get(id);
  if (!voice || !audioCtx) return;

  const now = audioCtx.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setTargetAtTime(0.0001, now, Math.max(0.015, release / 4));

  [voice.osc, voice.sub, voice.vib].forEach((osc) => {
    try {
      osc.stop(now + release + 0.08);
    } catch (error) {
      // no-op
    }
  });

  activeVoices.delete(id);
}

function stopAll() {
  for (const id of [...activeVoices.keys()]) {
    stopVoice(id, 0.06);
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  if ($('statusText')) {
    $('statusText').textContent = 'STOPPED';
  }

  setLCD('READY');

  if (singerEngine) {
    singerEngine.stop();
  }
}

function makeLetterPad() {
  const pad = $('letterPad');
  if (!pad) return;

  pad.innerHTML = '';
  letters.forEach((letter) => {
    const button = document.createElement('button');
    button.className = 'letter-key';
    button.textContent = letter;
    button.dataset.letter = letter;
    button.setAttribute('aria-label', 'Play letter ' + letter);

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const vowel = selectedVowel();
      const note = 48 + Math.floor(Math.random() * 24);
      startVoice('letter-' + letter, note, vowel, 0.55 + Number(($('volume') && $('volume').value) || 70) / 220);
      button.classList.add('pressed');
    });

    button.addEventListener('pointerup', () => button.classList.remove('pressed'));
    button.addEventListener('pointerleave', () => button.classList.remove('pressed'));
    button.addEventListener('pointercancel', () => button.classList.remove('pressed'));
    pad.appendChild(button);
  });
}

function makePiano() {
  const piano = $('piano');
  if (!piano) return;

  piano.innerHTML = '';
  const base = (Number(($('octaveSelect') && $('octaveSelect').value) || 3) * 12) + 12;
  const keyNoteOffsets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

  keyNoteOffsets.forEach((offset) => {
    const note = base + offset;
    const pc = offset % 12;
    const black = [1, 3, 6, 8, 10].includes(pc);
    const button = document.createElement('button');
    button.className = 'piano-key ' + (black ? 'black' : 'white');
    button.dataset.note = String(note);
    button.innerHTML = '<span class="key-note">' + noteNames[pc] + '</span><span class="key-oct">' + (Math.floor(note / 12) - 1) + '</span>';

    const press = (event) => {
      event.preventDefault();
      const vowel = selectedVowel();
      startVoice('piano-' + note, note, vowel, 0.55 + Number(($('volume') && $('volume').value) || 70) / 220);
      button.classList.add('pressed');
    };

    const release = () => {
      stopVoice('piano-' + note);
      button.classList.remove('pressed');
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    piano.appendChild(button);
  });
}

function speakText() {
  const text = ($('lyricsEditor') && $('lyricsEditor').value || '').trim();
  if (!text) {
    setLCD('TYPE TEXT FIRST');
    return;
  }

  audioReady();

  if (!singerEngine) {
    setLCD('SING ENGINE UNAVAILABLE');
    return;
  }

  singerEngine.setVoiceStyle(($('voiceStyle') && $('voiceStyle').value) || 'retro');
  singerEngine.renderSong(text, {
    tempo: Number(($('tempo') && $('tempo').value) || 96),
    baseNote: 60,
    spread: getRangeValue('choirSpread', 0),
    choirVoices: getRangeValue('choirVoices', 1),
    voiceStyle: ($('voiceStyle') && $('voiceStyle').value) || 'retro'
  });

  if ($('statusText')) {
    $('statusText').textContent = 'SINGING';
  }
  setLCD('SINGING', 60);
}

function updateLabels() {
  if ($('tempoValue')) {
    $('tempoValue').textContent = (($('tempo') && $('tempo').value) || 96) + ' BPM';
  }

  if ($('brightValue')) {
    $('brightValue').textContent = (($('brightness') && $('brightness').value) || 55) + '%';
  }

  if ($('volumeValue')) {
    $('volumeValue').textContent = (($('volume') && $('volume').value) || 70) + '%';
  }

  if ($('vibratoValue')) {
    $('vibratoValue').textContent = (($('vibrato') && $('vibrato').value) || 18) + '%';
  }

  if ($('pitchValue')) {
    const shift = Number(($('pitchShift') && $('pitchShift').value) || 0);
    $('pitchValue').textContent = shift === 0 ? '0 st' : (shift > 0 ? '+' + shift + ' st' : shift + ' st');
  }

  if ($('voiceReadout')) {
    const style = $('voiceStyle') ? $('voiceStyle').selectedOptions[0].text.toUpperCase().slice(0, 12) : 'RETRO';
    $('voiceReadout').textContent = 'VOICE: ' + style;
  }

  if (master && audioCtx) {
    master.gain.setTargetAtTime(Number(($('volume') && $('volume').value) || 70) / 100, audioCtx.currentTime, 0.02);
  }
}

function togglePanel(id) {
  const panel = $(id);
  if (panel) {
    panel.classList.toggle('hidden');
  }
}

function connectMIDI() {
  if (!navigator.requestMIDIAccess) {
    if ($('midiStatus')) $('midiStatus').textContent = 'MIDI: unavailable in this build';
    return;
  }

  navigator.requestMIDIAccess().then((access) => {
    midiAccess = access;
    midiAccess.inputs.forEach((input) => {
      input.onmidimessage = handleMIDIMessage;
    });
    midiAccess.onstatechange = () => {
      midiAccess.inputs.forEach((input) => {
        input.onmidimessage = handleMIDIMessage;
      });
      updateMIDIStatus();
    };
    updateMIDIStatus();
  }).catch(() => {
    if ($('midiStatus')) $('midiStatus').textContent = 'MIDI: permission or device unavailable';
  });
}

function handleMIDIMessage(event) {
  const [status, note, velocity] = event.data;
  const cmd = status & 0xf0;

  if (cmd === 0x90 && velocity > 0) {
    const vowel = selectedVowel();
    startVoice('midi-' + note, note, vowel, Math.max(0.1, velocity / 127));
  } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
    stopVoice('midi-' + note, 0.2);
  }
}

function updateMIDIStatus() {
  const inputs = midiAccess ? [...midiAccess.inputs.values()] : [];
  if ($('midiStatus')) {
    $('midiStatus').textContent = inputs.length ? 'MIDI: ' + inputs.length + ' device(s) ready' : 'MIDI: connect a keyboard';
  }
}

$('openSettings') && $('openSettings').addEventListener('click', () => {
  if ($('settingsPanel')) $('settingsPanel').classList.remove('hidden');
  if ($('lyricsPanel')) $('lyricsPanel').classList.add('hidden');
});

$('closeSettings') && $('closeSettings').addEventListener('click', () => togglePanel('settingsPanel'));
$('openLyrics') && $('openLyrics').addEventListener('click', () => {
  if ($('lyricsPanel')) $('lyricsPanel').classList.remove('hidden');
  if ($('settingsPanel')) $('settingsPanel').classList.add('hidden');
});
$('closeLyrics') && $('closeLyrics').addEventListener('click', () => togglePanel('lyricsPanel'));

$('speakBtn') && $('speakBtn').addEventListener('click', speakText);
$('previewText') && $('previewText').addEventListener('click', speakText);
$('stopBtn') && $('stopBtn').addEventListener('click', stopAll);

$('randomBtn') && $('randomBtn').addEventListener('click', () => {
  const vowels = ['a', 'e', 'i', 'o', 'u'];
  const vowel = vowels[Math.floor(Math.random() * vowels.length)];
  if ($('vowel')) $('vowel').value = vowel;
  const note = 48 + Math.floor(Math.random() * 25);
  startVoice('random', note, vowel, 0.7);
});

['tempo', 'vibrato', 'brightness', 'volume', 'pitchShift'].forEach((id) => {
  const el = $(id);
  if (el) el.addEventListener('input', updateLabels);
});

if ($('voiceStyle')) $('voiceStyle').addEventListener('change', updateLabels);
if ($('vowel')) $('vowel').addEventListener('change', () => setLCD('VOWEL: ' + $('vowel').value.toUpperCase()));
if ($('octaveSelect')) $('octaveSelect').addEventListener('change', makePiano);
if ($('keySelect')) $('keySelect').addEventListener('change', () => {
  const key = noteNames.indexOf($('keySelect').value);
  if ($('noteReadout')) $('noteReadout').textContent = 'KEY: ' + $('keySelect').value;
  if (key >= 0) lastNote = key;
});
if ($('scaleSelect')) {
  $('scaleSelect').addEventListener('change', () => {
    if ($('modeReadout')) {
      $('modeReadout').textContent = $('scaleSelect').value === 'Chromatic' ? 'SING MODE' : $('scaleSelect').value.toUpperCase() + ' MODE';
    }
  });
}
if ($('midiBtn')) $('midiBtn').addEventListener('click', connectMIDI);

$('saveBtn') && $('saveBtn').addEventListener('click', async () => {
  const data = {
    app: 'Speak or Spell by Wavey Beat',
    version: '0.2.0',
    text: ($('lyricsEditor') && $('lyricsEditor').value) || '',
    settings: {
      tempo: getRangeValue('tempo', 96),
      voiceStyle: $('voiceStyle') ? $('voiceStyle').value : 'retro',
      pitchShift: getRangeValue('pitchShift', 0),
      vibrato: getRangeValue('vibrato', 18),
      brightness: getRangeValue('brightness', 55),
      volume: getRangeValue('volume', 70),
      vowel: selectedVowel(),
      key: $('keySelect') ? $('keySelect').value : 'C',
      octave: $('octaveSelect') ? $('octaveSelect').value : '3',
      scale: $('scaleSelect') ? $('scaleSelect').value : 'Chromatic',
      choirVoices: getRangeValue('choirVoices', 1),
      choirSpread: getRangeValue('choirSpread', 0)
    }
  };

  if (window.speakSpell && window.speakSpell.saveProject) {
    const result = await window.speakSpell.saveProject(data);
    if (!result.canceled && !result.error) {
      projectSaved = true;
      if ($('statusText')) $('statusText').textContent = 'SAVED';
    }
    return;
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'speak-or-spell-project.json';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
});

$('exportTxtBtn') && $('exportTxtBtn').addEventListener('click', () => {
  const text = ($('lyricsEditor') && $('lyricsEditor').value) || '';
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'speak-or-spell-lyrics.txt';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
});

$('openProjectBtn') && $('openProjectBtn').addEventListener('click', async () => {
  if (window.speakSpell && window.speakSpell.openProject) {
    const result = await window.speakSpell.openProject();
    if (result.canceled) return;

    if (result.error) {
      alert(result.error);
      return;
    }

    const data = result.data || {};
    const settings = data.settings || {};

    if (settings.tempo != null && $('tempo')) $('tempo').value = settings.tempo;
    if (settings.voiceStyle && $('voiceStyle')) $('voiceStyle').value = settings.voiceStyle;
    if (settings.pitchShift != null && $('pitchShift')) $('pitchShift').value = settings.pitchShift;
    if (settings.vibrato != null && $('vibrato')) $('vibrato').value = settings.vibrato;
    if (settings.brightness != null && $('brightness')) $('brightness').value = settings.brightness;
    if (settings.volume != null && $('volume')) $('volume').value = settings.volume;
    if (settings.vowel && $('vowel')) $('vowel').value = settings.vowel;
    if (settings.key && $('keySelect')) $('keySelect').value = settings.key;
    if (settings.octave && $('octaveSelect')) $('octaveSelect').value = settings.octave;
    if (settings.scale && $('scaleSelect')) $('scaleSelect').value = settings.scale;
    if (settings.choirVoices != null && $('choirVoices')) $('choirVoices').value = settings.choirVoices;
    if (settings.choirSpread != null && $('choirSpread')) $('choirSpread').value = settings.choirSpread;
    if (data.text != null && $('lyricsEditor')) $('lyricsEditor').value = data.text;

    updateLabels();
    makePiano();
    if ($('statusText')) $('statusText').textContent = 'PROJECT OPENED';
    setLCD('PROJECT LOADED');
    return;
  }

  alert('Project opening is available in the desktop app.');
});

makeLetterPad();
makePiano();
updateLabels();
setLCD('HELLO, SINGER!');
connectMIDI();

if ($('lyricsEditor')) {
  $('lyricsEditor').value = 'Hello Wavey Beat';
}

document.addEventListener('keydown', (event) => {
  if (event.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;

  const letter = event.key.toUpperCase();
  if (letters.includes(letter)) {
    const button = document.querySelector('[data-letter="' + letter + '"]');
    if (button) button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }
});

document.addEventListener('keyup', (event) => {
  const letter = event.key.toUpperCase();
  if (letters.includes(letter)) {
    const button = document.querySelector('[data-letter="' + letter + '"]');
    if (button) button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  }
});
