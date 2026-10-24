(() => {
  const FORMANTS = {
    a: [800, 1150, 2900],
    e: [500, 1900, 2600],
    i: [300, 2200, 3000],
    o: [500, 900, 2600],
    u: [350, 800, 2200]
  };

  const VOWEL_MAP = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u' };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function syllableForWord(word) {
    const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!normalized) return 'a';
    let best = 'a';
    let bestScore = Infinity;
    for (const vowel of Object.keys(FORMANTS)) {
      let score = 0;
      for (const ch of normalized) {
        if (ch === vowel) score += 1;
      }
      if (score < bestScore) {
        best = vowel;
        bestScore = score;
      }
    }
    return VOWEL_MAP[best] || 'a';
  }

  class WaveySingerEngine {
    constructor(audioContext, masterGain) {
      this.audioContext = audioContext;
      this.masterGain = masterGain;
      this.voiceStyle = 'retro';
      this.activeTasks = [];
    }

    setVoiceStyle(style) {
      this.voiceStyle = style || 'retro';
    }

    getVoiceProfile() {
      switch (this.voiceStyle) {
        case 'masculine':
          return { detune: 0.82, brightness: 0.35, gain: 0.42, waveform: 'triangle', vibrato: 0.018, spread: 1.5 };
        case 'feminine':
          return { detune: 1.22, brightness: 0.7, gain: 0.48, waveform: 'sawtooth', vibrato: 0.025, spread: 1.9 };
        default:
          return { detune: 0.96, brightness: 0.58, gain: 0.4, waveform: 'square', vibrato: 0.021, spread: 1.7 };
      }
    }

    parseSyllables(text) {
      const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
      return words.map((word, index) => ({
        index,
        text: word,
        vowel: syllableForWord(word),
        wordLength: word.length,
        duration: 0.36 + Math.min(0.35, word.length * 0.02)
      }));
    }

    buildMelody(text, options = {}) {
      const syllables = this.parseSyllables(text);
      if (!syllables.length) return [];

      const tempo = clamp(Number(options.tempo || 96), 60, 180);
      const beat = 60 / tempo;
      const baseNote = Number(options.baseNote || 60);
      const spread = options.spread || 0;
      const pattern = [0, 2, 4, 7, 9, 12, 7, 5, 4, 2, 0, -2];

      return syllables.map((syllable, index) => {
        const offset = pattern[index % pattern.length] + spread;
        const octaveJumps = Math.floor(index / 8) * 12;
        const note = baseNote + offset + octaveJumps;
        return {
          ...syllable,
          note,
          duration: syllable.duration * (beat * 1.25),
          start: index * beat * 0.85,
          vowel: syllable.vowel
        };
      });
    }

    stop() {
      for (const task of this.activeTasks) {
        try {
          if (task && typeof task.stop === 'function') task.stop();
        } catch (error) {
          // no-op
        }
      }
      this.activeTasks = [];
    }

    renderSong(text, options = {}) {
      this.stop();
      const melody = this.buildMelody(text, options);
      if (!melody.length) return [];

      const startAt = this.audioContext.currentTime + 0.05;
      const profile = this.getVoiceProfile();
      const choirVoices = Math.max(1, Number(options.choirVoices || 1));

      melody.forEach((syllable, index) => {
        const baseTime = startAt + syllable.start;
        const leadNote = syllable.note;
        const harmonyOffsets = [0, 4, 7, 12];

        for (let choirIndex = 0; choirIndex < choirVoices; choirIndex += 1) {
          const offset = harmonyOffsets[choirIndex % harmonyOffsets.length] + (choirIndex > 0 ? 0.5 * choirIndex : 0);
          const note = leadNote + offset;
          const voiceGain = Math.max(0.12, profile.gain / Math.max(1, choirVoices - 1 || 1));
          const duration = syllable.duration * (choirIndex === 0 ? 1 : 0.85);
          const scheduled = this.scheduleSyllable({
            ...syllable,
            note,
            duration,
            vowel: syllable.vowel,
            detune: profile.detune,
            brightness: profile.brightness,
            waveform: profile.waveform,
            vibrato: profile.vibrato,
            gain: voiceGain,
            pan: choirIndex === 0 ? 0 : (choirIndex % 2 === 0 ? -0.25 : 0.25),
            startTime: baseTime,
            choirIndex
          });
          this.activeTasks.push(scheduled);
        }
      });

      return melody;
    }

    scheduleSyllable({ note, vowel, duration, startTime, detune, brightness, waveform, vibrato, gain, pan, choirIndex }) {
      const ctx = this.audioContext;
      const now = startTime || ctx.currentTime;
      const frequency = midiToFrequency(note) * detune;
      const formant = FORMANTS[vowel] || FORMANTS.a;
      const attack = Math.min(0.06, duration * 0.2);
      const release = Math.min(0.28, duration * 0.4);

      const carrier = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const vibratoOsc = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      const gainNode = ctx.createGain();
      const panner = ctx.createStereoPanner();

      carrier.type = waveform || 'triangle';
      sub.type = 'sine';
      carrier.frequency.setValueAtTime(frequency, now);
      sub.frequency.setValueAtTime(frequency * 0.5, now);

      const filterBank = formant.map((hz, index) => {
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(hz, now);
        filter.Q.value = index === 0 ? 2.6 : 4.2;
        return filter;
      });

      const preMix = ctx.createGain();
      preMix.gain.value = 0.3 + brightness * 0.6;
      const finalGain = ctx.createGain();
      finalGain.gain.setValueAtTime(0.0001, now);
      finalGain.gain.linearRampToValueAtTime(Math.max(0.03, gain), now + attack);
      finalGain.gain.setTargetAtTime(0.0001, now + duration, Math.max(0.08, release));

      carrier.connect(preMix);
      sub.connect(preMix);
      preMix.connect(filterBank[0]);
      filterBank.forEach((filter, index) => {
        if (index < filterBank.length - 1) {
          filter.connect(filterBank[index + 1]);
        }
      });
      filterBank[filterBank.length - 1].connect(finalGain);
      finalGain.connect(panner);
      panner.connect(this.masterGain);

      vibratoOsc.type = 'sine';
      vibratoOsc.frequency.value = 5.5 + choirIndex * 0.8;
      vibratoGain.gain.value = frequency * (vibrato || 0.02) * 0.016;
      vibratoOsc.connect(vibratoGain);
      vibratoGain.connect(carrier.frequency);
      vibratoGain.connect(sub.frequency);

      panner.pan.value = clamp(pan || 0, -1, 1);

      carrier.start(now);
      sub.start(now);
      vibratoOsc.start(now);

      const stop = () => {
        try { carrier.stop(now + duration + release + 0.05); } catch (error) { /* no-op */ }
        try { sub.stop(now + duration + release + 0.05); } catch (error) { /* no-op */ }
        try { vibratoOsc.stop(now + duration + release + 0.05); } catch (error) { /* no-op */ }
      };

      return { stop };
    }
  }

  window.WaveySingerEngine = WaveySingerEngine;
})();
