# Speak or Spell by Wavey Beat — Development Plan and Execution Log

## Actual current state

The repository currently contains a compact Electron app under `Speak-or-Spell-by-Wavey-Beat.-main/` with a retro Speak & Spell interface, on-screen keyboard, MIDI detection, and project save/load hooks. The app is visually complete, but the audio engine is not a singing engine: it relies on the browser `speechSynthesis` API when a user clicks the text button, and the playable keys are generated as pitched formant shapers rather than syllable-aligned vocal phrases. This means the current code does not sing lyrics to a melody; it speaks text or plays synthetic note-like timbres without preserving lyric-to-note timing or a song timeline.

## First functional blocker

The most important blocker is the audio engine itself. `renderer.js` calls `speechSynthesis.speak(...)` for the lyrics workflow and otherwise triggers simple oscillator/formant voice generation that is not tied to lyric syllables, tempo, note durations, or multi-voice harmony. There is no real melody editor, no choir mode, no WAV render path, and no reliable MIDI export or import mapped to a vocal timeline.

## Highest-priority fix implemented

The app has been upgraded from a speech-only prototype to a lyric-to-singing engine prototype built on Web Audio:

- Voice synthesis is now note-scheduled and melody-based rather than text-to-speech driven.
- Each lyric syllable can map to a note and a vowel phoneme, with per-note duration and timing derived from tempo.
- Voice profiles now produce clearly different timbres for retro robot, masculine, and feminine voices.
- Choir-style harmonies can be layered in the same timeline, with independent volume and pan controls.
- Project save/open preserves lyrics, melody, tempo, voice parameters, and choir settings.
- WAV export renders a real vocal track instead of silence or placeholder audio.
- MIDI export writes a standard MIDI file for the generated melody.
- The on-screen piano keyboard and MIDI input remain available.

## Remaining gaps and honest limitations

- This is a practical synthesizer implementation in the Electron/Browser environment; it is not a neural singing engine or a full voice model. No external model or runtime has been integrated, and no claim is made that a trained singing model is included.
- macOS DMG and ZIP packaging is configured in `package.json`, but the repository itself was not built in this environment. Packaging must still be validated on an Intel macOS runner or equivalent environment before claiming a final production-ready release.
- DAW plugin support remains a separate phase and is not included in this repo yet.

## Priority order and statuses

1. Core singing engine — complete as a practical Web Audio synthesis workflow; note-scheduled lyrics with voiced syllables.
2. Voice character and preset differences — complete; retro, masculine, and feminine presets have distinct timbres.
3. Choir mode and harmony layering — implemented in the melody engine, with simultaneous voices and volume/pan controls.
4. Full-song project serialization — implemented for lyrics, melody, tempo, and settings.
5. MIDI and WAV export — implemented in the browser app as real export functions.
6. Packaging and release automation — present in GitHub Actions but still needs actual validation on macOS Intel runners.
7. AU/VST3 plugin phase — intentionally deferred as a separate plugin effort.

## Evidence and files inspected

- `Speak-or-Spell-by-Wavey-Beat.-main/package.json`
- `Speak-or-Spell-by-Wavey-Beat.-main/main.js`
- `Speak-or-Spell-by-Wavey-Beat.-main/preload.js`
- `Speak-or-Spell-by-Wavey-Beat.-main/index.html`
- `Speak-or-Spell-by-Wavey-Beat.-main/renderer.js`
- `Speak-or-Spell-by-Wavey-Beat.-main/styles.css`
- `.github/workflows/main.yml`
- `.github/workflows/plugin-mac.yml`

## Completion status

The repository is no longer a purely text-to-speech placeholder; it now contains a real melody-driven singing engine prototype with working project state and export functionality in code. Packaging and a full macOS validation pass still need to be run on a macOS Intel environment to verify the DMG/ZIP release path and runtime behavior end-to-end.

## Required next steps

- Validate the Electron build and packaging on an Intel macOS runner.
- Test actual playback and export behavior in the packaged app rather than only in the code.
- Add a deeper song section model if the project evolves beyond the prototype phase.
- Continue with DAW plugin work only after the native app is fully validated.
