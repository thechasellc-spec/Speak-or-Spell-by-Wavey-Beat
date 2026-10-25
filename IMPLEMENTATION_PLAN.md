# Speak or Spell by Wavey Beat — Development Plan and Execution Log

## Actual current state

The repository is a hybrid project: it keeps the retro Speak & Spell Electron shell and UI, but the actual singing logic is implemented in a Web Audio engine (`Speak-or-Spell-by-Wavey-Beat.-main/singer-core.js`) and orchestrated from the front-end (`Speak-or-Spell-by-Wavey-Beat.-main/renderer.js`). The project is no longer a speech-only placeholder. The real functional blocker is not the app shell; it is keeping the UI and audio logic fully aligned with the build, audio, and packaging expectations.

## First functional blocker

The first major problem was that typed lyrics were still routed through `speechSynthesis`, which is ordinary speech output rather than a sung melodic engine. That made the app feel like a voice demo rather than a lyric-to-singing instrument. The fix is to use a note-scheduled singing engine and keep the project settings wired into the melody playback path.

## Highest-priority fix implemented

The app is now aligned around a melody-driven singing engine:

- Lyrics are parsed into syllables and mapped to note timing.
- Voice styles are distinct for retro, masculine, and feminine timbres.
- Multiple choir voices can be layered in harmony.
- Playback is tied to Web Audio scheduling and tempo rather than browser speech synthesis.
- The app still preserves the interactive retro interface and MIDI/keyboard controls.

## Remaining gaps and honest limitations

- This is a practical browser-synth singing engine, not a neural singing model with external runtime downloads.
- The app exports and saves project state, but packaged DMG generation still needs validation on a proper macOS runner.
- Native AU/VST3 plugin work remains a separate phase and is not included in this repo.

## Priority order and statuses

1. Core singing engine — implemented as a practical Web Audio lyric-to-singing engine.
2. Voice character and preset differences — implemented using distinct waveforms, detune, brightness, and vibrato profiles.
3. Choir mode and harmony layering — implemented in the singing engine timing model.
4. Full-song project serialization — supported by the app save/load flow.
5. MIDI and audio export — supported via the app layer, with export features preserved.
6. Packaging and release automation — present in GitHub Actions, but actual DMG validation still requires a macOS build environment.
7. AU/VST3 plugin phase — intentionally deferred.

## Evidence and files inspected

- `Speak-or-Spell-by-Wavey-Beat.-main/package.json`
- `Speak-or-Spell-by-Wavey-Beat.-main/main.js`
- `Speak-or-Spell-by-Wavey-Beat.-main/preload.js`
- `Speak-or-Spell-by-Wavey-Beat.-main/index.html`
- `Speak-or-Spell-by-Wavey-Beat.-main/renderer.js`
- `Speak-or-Spell-by-Wavey-Beat.-main/singer-core.js`
- `.github/workflows/main.yml`
- `.github/workflows/plugin-mac.yml`

## Completion status

The repo is no longer a pure text-to-speech placeholder. It is centered around a real note-scheduled singing engine and retains the project/workflow structure needed for a playable vocal instrument prototype.

## Required next steps

- Validate the Electron build and packaging on a macOS Intel runner.
- Smoke-test the sung lyric workflow in the packaged app.
- Check the exact DMG/ZIP artifact output in CI.
- Continue with deep musical editing and DAW plugin work only after the standalone app is verified.

## Build note

This repository can prepare and verify the packaging workflow in GitHub Actions, but an actual `.dmg`/`.pkg` must be built on a macOS environment. The API-only session here cannot generate a native macOS installer artifact.
