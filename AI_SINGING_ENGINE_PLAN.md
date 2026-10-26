# AI Singing Engine Integration Plan

## Product target

Speak or Spell by Wavey Beat must generate intelligible, expressive sung vocals from user lyrics and musical intent. The existing Web Audio oscillator/formant engine is only a fallback sound effect and must never be presented as realistic AI singing.

## Two separate experiences

1. **Vocal instrument mode**: user enters lyrics, sets notes through the on-screen/MIDI keyboard, and renders a sung vocal that follows those notes. Export the rendered vocal as WAV. Preserve MIDI note-on/note-off and note/lyric alignment.
2. **Song-generation mode**: user enters lyrics plus genre/mood/arrangement prompts and requests a complete song with vocals and backing music. This is a larger Suno-like generation task and must be treated as a separate asynchronous workflow, not as the same thing as a note-by-note singer.

## Candidate research

- **SoulX-Singer** (Apache-2.0 code/model according to its official repository): promising for realistic score-/melody-conditioned vocal synthesis and English support. Official repository: https://github.com/Soul-AILab/SoulX-Singer . It requires Python/PyTorch and separately downloaded model checkpoints and preprocessing models. Its inference pipeline and hardware performance must be validated before promising it works on the user's Intel Mac.
- **DiffSinger / OpenVPI DiffSinger**: mature score-conditioned singing synthesis with expressive controls; requires a compatible voicebank/model and ONNX or Python deployment. Official repository: https://github.com/openvpi/DiffSinger . Voicebank/model licenses must be checked individually.
- **Full-song generation models** such as YuE2/OpenSuno are a different category: they can generate a whole track from lyrics/style, but they are not drop-in low-latency vocal instruments. Local execution on an Intel i5 Mac should not be promised without performance testing.

## Integration requirements

- Add a real engine adapter with explicit states: unavailable, loading, ready, rendering, error.
- Engine requests should include lyric text, aligned MIDI pitches/note durations, tempo, language, selected permitted voice/reference, and supported expression controls.
- Render asynchronously with progress and cancellation; do not block Electron's UI thread.
- Return audio buffers/files, report useful errors, and provide a clearly labeled offline fallback. Never silently substitute the oscillator engine while claiming a realistic singer was generated.
- Keep the current red retro Speak & Spell-inspired UI and product name. The robotic-to-natural slider should control a documented processing/voice-style parameter supported by the selected engine; it must not pretend to create a natural voice if the backend cannot do so.
- Voice references must be user-owned or used with permission. Do not ship voicebanks or model weights until their individual licenses and redistribution terms are verified.
- Keep the installer compatible with the requested Intel Mac target and macOS 11+ only after the actual build and launch are tested on supported systems.

## Acceptance tests before calling it done

1. Generate a short English lyric phrase using an actual neural singing checkpoint, not Web Audio oscillators.
2. Confirm words are intelligible and notes follow the supplied MIDI melody.
3. Confirm held keyboard notes trigger/release vocal notes correctly where supported; if generation is offline/batched, show that behavior honestly rather than faking live singing.
4. Test WAV export and cancellation/error states.
5. Package the engine adapter and all required app scripts; verify the app launches from the DMG on an Intel Mac.
6. Publish the exact source revision alongside the matching installer.

## Current status

Research and integration planning only. The existing `singer-core.js` uses Web Audio oscillators/formant filters and is not a neural singing model. No AI singing backend or compatible checkpoint has been integrated or verified yet.
