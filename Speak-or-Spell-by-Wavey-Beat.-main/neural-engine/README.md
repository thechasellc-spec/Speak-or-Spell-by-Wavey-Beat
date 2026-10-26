# Neural singer bridge contract

This directory defines the boundary between Speak or Spell and a local neural singing backend. It intentionally does not claim that a model is bundled or ready: the current singer-core.js remains a procedural preview until a licensed model + vocoder is installed and verified.

## Song request schema (v1)

A render request is UTF-8 JSON with schemaVersion=1, a unique requestId, language, sampleRate, tempoBpm, voice, render options, and a notes array. Each note has id, lyric, optional phonemes, midiNote, startBeat, durationBeats, velocity, and expressions (pitchCents, energy, breathiness).

Example:

    {
      "schemaVersion": 1,
      "requestId": "unique-id",
      "language": "en",
      "sampleRate": 44100,
      "tempoBpm": 96,
      "voice": { "voiceId": "installed-voice-id", "style": "neutral" },
      "render": { "format": "wav", "choir": { "enabled": false, "parts": [] } },
      "notes": [{ "id": "n1", "lyric": "hello", "phonemes": null, "midiNote": 60, "startBeat": 0, "durationBeats": 1, "velocity": 0.8, "expressions": { "pitchCents": 0, "energy": 0.5, "breathiness": 0.2 } }]
    }

Notes are ordered by start time. startBeat and durationBeats are beat-relative, not seconds, so tempo changes do not destroy the melody. phonemes=null means the backend's licensed English G2P/phonemizer must resolve the lyric; the application must not pretend a render succeeded if alignment fails.

## Worker protocol

- The app sends one JSON request per render.
- Worker responses are JSON with the same requestId and status (progress, complete, or error).
- complete must include a real WAV path or bytes and measured sample rate/duration.
- error must include a stable error code and human-readable message.
- Cancellation must stop the active render and clean temporary files.
- A missing backend/model must return ENGINE_NOT_INSTALLED. Never silently substitute oscillator audio and label it AI.

## Model and licensing requirements

A usable voice needs a compatible acoustic model, phonemizer/phoneme inventory, and vocoder. Track each asset's source, checksum, version, license, redistribution permission, and commercial-use permission separately. Do not bundle community weights until all licenses are verified.

## Acceptance test

The bridge is not considered complete until a real, licensed English model produces a non-empty WAV from at least two lyric-aligned notes, note pitch/duration changes audibly affect the result, and the WAV can be auditioned/exported by the app. Male/female and choir are separate acceptance tests; do not advertise them before each passes.