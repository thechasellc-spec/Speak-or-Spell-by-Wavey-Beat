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

    const vowels = Object.keys(FORMANTS);
    let best = 'a';
    let bestScore = Infinity;

    for (const vowel of vowels) {
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

  function buildVowelMapForWord(word) {
    const letters = word.toLowerCase().replace(/[^a-z]/g, '').split('');
    let strongest = 'a';
    let highest = -1;
    for (const vowel of Object.keys(FORMANTS)) {
      const score = letters.filter((ch) => ch === vowel).length;
      if (score > highest) {
        highest = score;
        strongest = vowel;
      }
    }
    return strongest;
  }

  function splitIntoSyllables(word) {
    const letters = word.toLowerCase().replace(/[^a-z]/g, '').split('');
    if (!letters.length) return ['a'];

    const vowels = ['a', 'e', 'i', 'o', 'u'];
    const groups = [];
    let current = '';

    for (const ch of letters) {
      current += ch;
      if (vowels.includes(ch)) {
        groups.push(current);
        current = '';
      }
    }

    if (current) {
      groups.push(current);
    }

    return groups.length ? groups.filter(Boolean) : ['a'];
  }

  class WaveySingerEngine {
    constructor(audioContext, masterGain) {
      this.audioContext = audioContext;
      this.masterGain = masterGain;
      this.voiceStyle = 'retro';
      this.activeTasks = [];
      this.noiseBuffer = this.createNoiseBuffer();
    }

    createNoiseBuffer() {
      const length = this.audioContext.sampleRate * 1;
      const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.18;
      }
      return buffer;
    }

    setVoiceStyle(style) {
      this.voiceStyle = style || 'retro';
    }

    getVoiceProfile() {
      switch (this.voiceStyle) {
        case 'masculine':
          return {
            detune: 0.82,
            brightness: 0.35,
            gain: 0.52,
            waveform: 'triangle',
            vibrato: 0.018,
            spread: 1.5,
            attack: 0.045,
            release: 0.21,
            formantBias: 0.88,
            shimmer: 0.12,
            breath: 0.2
          };
        case 'feminine':
          return {
            detune: 1.22,
            brightness: 0.7,
            gain: 0.58,
            waveform: 'sawtooth',
            vibrato: 0.028,
            spread: 1.9,
            attack: 0.03,
            release: 0.26,
            formantBias: 1.12,
            shimmer: 0.22,
            breath: 0.28
          };
        default:
          return {
            detune: 0.96,
            brightness: 0.58,
            gain: 0.48,
            waveform: 'square',
            vibrato: 0.021,
            spread: 1.7,
            attack: 0.038,
            release: 0.24,
            formantBias: 1.0,
            shimmer: 0.18,
            breath: 0.24
          };
      }
    }

    parseSyllables(text) {
      const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
      const baseWords = words.map((word, index) => {
        const syllables = splitIntoSyllables(word);
        const vowel = buildVowelMapForWord(word) || syllableForWord(word);
        return {
          index,
          text: word,
          vowel,
          syllables,
          wordLength: word.length,
          duration: 0.34 + Math.min(0.45, word.length * 0.02)
        };
      });

      const result = [];
      let timeOffset = 0;
      for (const wordInfo of baseWords) {
        const parts = wordInfo.syllables.length ? wordInfo.syllables : [wordInfo.vowel];
        const syllableDuration = wordInfo.duration / Math.max(1, parts.length);

        for (let i = 0; i < parts.length; i += 1) {
          result.push({
            index: result.length,
            text: wordInfo.text,
            word: wordInfo.text,
            vowel: parts[i].includes('a') || parts[i].includes('e') || parts[i].includes('i') || parts[i].includes('o') || parts[i].includes('u')
              ? wordInfo.vowel
              : wordInfo.vowel,
            duration: syllableDuration * (0.8 + (i / Math.max(1, parts.length)) * 0.4),
            start: timeOffset,
            wordIndex: wordInfo.index,
            syllableIndex: i,
            isLastInWord: i === parts.length - 1
          });
        }

        timeOffset += wordInfo.duration * 0.82;
      }

      return result;
    }

    buildMelody(text, options = {}) {
      const syllables = this.parseSyllables(text);
      if (!syllables.length) return [];

      const tempo = clamp(Number(options.tempo || 96), 60, 180);
      const beat = 60 / tempo;
      const baseNote = Number(options.baseNote || 60);
      const spread = Number(options.spread || 0);
      const phrase = [0, 2, 4, 7, 9, 12, 7, 5, 4, 2, 0, -2];

      return syllables.map((syllable, index) => {
        const offset = phrase[index % phrase.length] + spread + Math.floor(index / 8) * 2;
        const note = baseNote + offset;
        const duration = Math.max(0.18, syllable.duration * (beat * 1.2));
        const start = syllable.start * beat * 0.9;

        return {
          ...syllable,
          note,
          duration,
          start,
          glide: 0.05 + ((index % 5) * 0.01),
          vowel: syllable.vowel || 'a'
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

      melody.forEach((syllable) => {
        const baseTime = startAt + syllable.start;
        const leadNote = syllable.note;
        const harmonyOffsets = [0, 4, 7, 12];

        for (let choirIndex = 0; choirIndex < choirVoices; choirIndex += 1) {
          const offset = harmonyOffsets[choirIndex % harmonyOffsets.length] + (choirIndex > 0 ? 0.5 * choirIndex : 0);
          const note = leadNote + offset;
          const voiceGain = Math.max(0.12, profile.gain / Math.max(1, choirVoices - 1 || 1));
          const duration = syllable.duration * (choirIndex === 0 ? 1 : 0.9);

          const scheduled = this.scheduleSyllable({
            ...syllable,
            note,
            duration,
            detune: profile.detune,
            brightness: profile.brightness,
            waveform: profile.waveform,
            vibrato: profile.vibrato,
            gain: voiceGain,
            startTime: baseTime,
            choirIndex,
            pan: choirIndex === 0 ? 0 : (choirIndex % 2 === 0 ? -0.25 : 0.25),
            release: profile.release,
            attack: profile.attack,
            breath: profile.breath,
            shimmer: profile.shimmer,
            formantBias: profile.formantBias
          });

          this.activeTasks.push(scheduled);
        }
      });

      return melody;
    }

    scheduleSyllable({
      note,
      vowel,
      duration,
      startTime,
      detune,
      brightness,
      waveform,
      vibrato,
      gain,
      pan,
      choirIndex,
      attack,
      release,
      breath,
      shimmer,
      formantBias,
      glide
    }) {
      const ctx = this.audioContext;
      const now = startTime || ctx.currentTime;
      const startFrequency = midiToFrequency(note) * detune;
      const endFrequency = midiToFrequency(note + (Math.random() > 0.5 ? 1 : 0)) * detune;
      const formant = FORMANTS[vowel] || FORMANTS.a;
      const syllableDuration = duration || 0.24;
      const realAttack = Math.min(0.06, attack || 0.04);
      const realRelease = Math.min(0.28, release || 0.22);

      const carrier = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const upper = ctx.createOscillator();
      const vibratoOsc = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      const gainNode = ctx.createGain();
      const panner = ctx.createStereoPanner();
      const formantGain = ctx.createGain();

      carrier.type = waveform || 'triangle';
      sub.type = 'sine';
      upper.type = waveform === 'sawtooth' ? 'sawtooth' : 'triangle';

      carrier.frequency.setValueAtTime(startFrequency, now);
      carrier.frequency.linearRampToValueAtTime(endFrequency, now + Math.max(0.02, (glide || 0.05) * 2));

      sub.frequency.setValueAtTime(startFrequency * 0.5, now);
      upper.frequency.setValueAtTime(startFrequency * 2.0, now);

      const filterBank = formant.map((hz, index) => {
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(hz * formantBias, now);
        filter.Q.value = index === 0 ? 3.2 : 4.6;
        filter.gain.value = 2.0 + brightness * 6.0;
        return filter;
      });

      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      const noiseGain = ctx.createGain();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 900 + brightness * 2000;
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(Math.max(0.01, breath || 0.24) * 0.3, now + realAttack);
      noiseGain.gain.setTargetAtTime(0.0001, now + syllableDuration, 0.1);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);

      const preMix = ctx.createGain();
      preMix.gain.value = 0.35 + brightness * 0.8;

      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = shimmer || 0.12;

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(Math.max(0.08, gain * 0.5), now + realAttack);
      gainNode.gain.setTargetAtTime(0.0001, now + syllableDuration, Math.max(0.02, realRelease * 0.3));

      formantGain.gain.value = 0.75 + brightness * 0.8;
      panner.pan.value = clamp(pan || 0, -1, 1);

      carrier.connect(preMix);
      sub.connect(preMix);
      upper.connect(preMix);
      preMix.connect(filterBank[0]);
      filterBank.forEach((filter, index) => {
        if (index < filterBank.length - 1) {
          filter.connect(filterBank[index + 1]);
        }
      });
      filterBank[filterBank.length - 1].connect(formantGain);
      formantGain.connect(gainNode);
      noiseGain.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(this.masterGain);

      const shimmerOsc = ctx.createOscillator();
      shimmerOsc.type = 'triangle';
      shimmerOsc.frequency.setValueAtTime(startFrequency * 2.5, now);
      shimmerOsc.connect(shimmerGain);
      shimmerGain.connect(gainNode);

      vibratoOsc.type = 'sine';
      vibratoOsc.frequency.value = 5.2 + choirIndex * 0.7;
      vibratoGain.gain.value = (startFrequency || 220) * (vibrato || 0.02) * 0.012;
      vibratoOsc.connect(vibratoGain);
      vibratoGain.connect(carrier.frequency);
      vibratoGain.connect(sub.frequency);
      vibratoGain.connect(upper.frequency);

      carrier.start(now);
      sub.start(now);
      upper.start(now);
      shimmerOsc.start(now);
      vibratoOsc.start(now);
      noise.start(now);

      const stop = () => {
        try { carrier.stop(now + syllableDuration + realRelease + 0.08); } catch (error) { /* no-op */ }
        try { sub.stop(now + syllableDuration + realRelease + 0.08); } catch (error) { /* no-op */ }
        try { upper.stop(now + syllableDuration + realRelease + 0.08); } catch (error) { /* no-op */ }
        try { shimmerOsc.stop(now + syllableDuration + realRelease + 0.08); } catch (error) { /* no-op */ }
        try { vibratoOsc.stop(now + syllableDuration + realRelease + 0.08); } catch (error) { /* no-op */ }
        try { noise.stop(now + syllableDuration + realRelease + 0.08); } catch (error) { /* no-op */ }
      };

      return { stop };
    }
  }

  window.WaveySingerEngine = WaveySingerEngine;
})();
