# Singing engine evaluation — Speak or Spell by Wavey Beat

Status date: 2026-10-27

## Goal

Generate real English sung vocals from user lyrics, with male/female timbres, exportable WAV, and a route for note-accurate MIDI singing. Never treat a demo WAV, speech synthesis, or the procedural preview as a successful AI render.

## Candidate A: ACE-Step 1.5 — full-song mode

- Project: https://github.com/ACE-Step/ACE-Step-1.5
- Project license: MIT; check each downloaded checkpoint/model and adapter license separately.
- Strength: open music-generation model for full songs with vocals; official project supports macOS and CPU inference.
- Weakness: CPU inference can be very slow on an Intel Mac, and full-song generation does not promise exact syllable-to-MIDI-note alignment.
- Integration shape: optional local backend/service, with lyrics, style, and duration sent to the model; import the resulting WAV into the app. Do not claim MIDI-accurate singing for this mode.
- Test required: launch on Intel macOS 13, generate a short English vocal song without cloud APIs, verify WAV duration and that the lyrics are audibly sung. Record actual render time and memory before enabling by default.

## Candidate B: DiffSinger — MIDI singer mode

- Project: https://github.com/openvpi/DiffSinger
- Core project license: Apache-2.0. This does not automatically license a voicebank or vocoder for redistribution.
- Strength: intended for note/lyric-conditioned singing synthesis, so it matches the MIDI workflow better.
- macOS: OpenUtau's DiffSinger documentation says macOS 11+ is supported; that is a renderer reference, not proof that every model runs correctly in our Electron app.
- Weakness: requires a compatible acoustic model, phonemizer/phoneme inventory, and vocoder. Voicebank and vocoder licenses vary; do not bundle assets until commercial-use and redistribution permissions are confirmed.
- Integration shape: keep the OpenUtau-style editor out of the user experience. Use a headless/embedded renderer only after verifying its automation interface and voicebank licensing; otherwise create an adapter contract and report that the engine is not installed.
- Test required: render two English lyric-aligned notes with different pitches/durations; verify audible pitch/duration changes, pronunciation, WAV output, and acceptable render speed on Intel macOS 13.

## Current application status

The app has a generic worker.py contract for an external runner, but no compatible singing model is bundled or verified. Its procedural singer-core.js preview is not a neural singer. A green Electron packaging workflow verifies the app package, not vocal quality.

A bug in main.js response parsing was corrected: the worker's JSON lines are now split on actual newline characters (/\\r?\\n/), not literal backslash sequences.

## Decision / next gates

1. Keep both options in evaluation; do not conflate their roles.
2. Prototype ACE-Step first as a separate full-song mode because it can create vocals without exact MIDI alignment.
3. Prototype DiffSinger separately as the MIDI singer, using a model/voicebank with verified English pronunciation and acceptable redistribution terms.
4. Run real audio acceptance tests on a compatible machine. GitHub CI can test protocol and packaging, but cannot prove a singer sounds human.
5. If the Intel Mac is too slow for ACE-Step, keep it optional and investigate a permitted remote endpoint only if the user explicitly accepts that trade-off. No paid API or surprise cloud upload.
