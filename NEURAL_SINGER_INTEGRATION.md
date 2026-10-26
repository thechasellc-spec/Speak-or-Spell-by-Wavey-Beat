# Neural Singing Engine Integration — Speak or Spell by Wavey Beat

## Goal

Replace the current oscillator/formant voice generator with an actual neural singing voice. The user stays inside Speak or Spell: lyrics, notes, tempo, voice selection, expressive controls, choir/harmony, playback, and WAV export all remain in this app. OpenUtau must not be a separate app the user has to operate.

## Current truth

`singer-core.js` is a Web Audio oscillator + formant-filter prototype. It estimates one vowel per word and schedules that sound on notes. It is not AI, does not model consonant articulation or real vocal timbre, and should never be marketed as a human-quality neural singer.

## Engine direction

Evaluate DiffSinger/OpenVPI as the first local inference backend. It is a machine-learning singing synthesis system with pitch and vocal-expression controls, and OpenUtau documents macOS 11+ support for DiffSinger. Reference: https://github.com/openvpi/DiffSinger and https://openutau.com/DiffSinger-support/.

Do not embed or require the OpenUtau GUI. Reuse a supported inference/runtime interface behind Speak or Spell's own UI. Before implementation, verify the exact DiffSinger inference entry point and supported runtime on Intel macOS; do not assume a Windows/Python command or model package works unchanged on macOS.

## Required architecture

1. **Renderer/UI:** existing lyrics, tempo, piano-roll/note timeline, male/female voice selection, expression sliders, choir/harmony controls, render progress, stop/cancel, and audio preview.
2. **Song representation:** lyrics mapped to phonemes and syllables; each syllable aligned to MIDI pitch, note start/end, and optional pitch/energy/breathiness curves. Preserve slurs, rests, consonant timing, and punctuation/breath breaks.
3. **Local inference bridge:** Electron main process launches a bundled or app-managed local worker (not a hosted API). Use a versioned request/response format, temp project directory, cancellation, bounded logs, and clear errors when the model/runtime is missing.
4. **Voice/model manager:** install/download compatible voicebanks and vocoders into the app's user data directory; show model name, language, voice range, size, source, and license. Never silently download several gigabytes.
5. **Audio output:** return rendered WAV/PCM to the app, audition it, mix harmony layers, export WAV, and keep MIDI export separate. The keyboard must trigger the note timeline and not merely play an unrelated synth tone.
6. **Fallback:** keep the procedural voice only as a clearly labelled preview/demo fallback. Never label it “AI singer” or present it as the human voice.

## Licensing and model selection gate

The engine's source-code license does not automatically license pretrained weights, voicebanks, or vocoders. Some community DiffSinger vocoder weights are published under CC BY-NC-SA 4.0, which is not suitable for a commercial product without separate permission. Do not bundle those weights into a distributable installer. For each male and female English voice, verify commercial-use rights for the voicebank, acoustic model, and vocoder independently. Prefer models that permit redistribution and commercial use; otherwise provide an in-app model installer that clearly links to the license and requires the user to accept it.

## Platform constraints

- Target Intel x64 macOS 11+ and macOS 13 first.
- No paid hosted API and no account requirement.
- The app must work offline after runtime, model, and voice assets are installed.
- Keep model/runtime downloads separate from the base DMG if their size is large.
- Never claim real-time performance on an Intel i5 until measured. Offline rendering with a progress indicator is acceptable for the first neural release.

## Acceptance tests before calling it complete

- English lyrics are sung with intelligible consonants and sustained vowels, not spoken by system TTS.
- User can edit note pitches/durations and hear the same lyrics follow those notes.
- At least one license-verified English voice works; male and female are required before claiming both are supported.
- Choir mode renders multiple aligned parts with independent pitch/level/pan and no clipped output.
- WAV export matches preview and has nonzero audio; MIDI export matches the note timeline.
- Stop/cancel works; missing model/runtime produces a useful error and never silently falls back to the robot voice.
- Build and launch on Intel macOS 11+ and macOS 13; record render time and memory use on the target Intel i5 Mac.

## Implementation order

1. Audit current renderer's song/note data and make a stable engine-neutral song schema.
2. Prototype a local DiffSinger inference worker and validate one known, legally usable English voice on Intel macOS.
3. Add model/runtime discovery and a renderer-to-worker bridge.
4. Wire the returned WAV into preview/export and retain the current engine only as explicit fallback.
5. Add a second voice and choir rendering, then package and test on Intel Mac.
6. Only after these pass, describe the product as having an AI human-style singer.

## Do not do

- Do not claim that a slider makes an oscillator sound like a trained singer.
- Do not rely on browser speechSynthesis for sung output.
- Do not bundle model weights with unclear/non-commercial licenses.
- Do not require the user to manually open or learn OpenUtau.
- Do not ship a DMG as the neural-singer release until the app includes a working inference backend and voice assets.
