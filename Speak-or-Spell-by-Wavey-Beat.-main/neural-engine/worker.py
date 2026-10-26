#!/usr/bin/env python3
"""Local neural singing worker protocol for Speak or Spell.

This worker deliberately fails closed when no real, configured model runner is
installed. It never fabricates a WAV or falls back to the oscillator preview.
"""
import json
import os
import sys
import subprocess
from pathlib import Path

def emit(message):
    print(json.dumps(message, ensure_ascii=False), flush=True)

def main():
    try:
        request = json.load(sys.stdin)
    except Exception as exc:
        emit({"status": "error", "requestId": None, "code": "INVALID_REQUEST",
              "message": f"Could not parse render request: {exc}"})
        return 2

    request_id = request.get("requestId")
    if request.get("schemaVersion") != 1 or not isinstance(request.get("notes"), list):
        emit({"status": "error", "requestId": request_id, "code": "INVALID_REQUEST",
              "message": "Expected schemaVersion 1 and a notes array."})
        return 2
    if not request["notes"]:
        emit({"status": "error", "requestId": request_id, "code": "EMPTY_SONG",
              "message": "Add at least one lyric-aligned note before rendering."})
        return 2

    # The configured runner must accept a request JSON file and write a WAV.
    # It is intentionally an explicit install-time setting; no network API.
    runner = os.environ.get("SPEAKSPELL_NEURAL_RUNNER")
    if not runner or not Path(runner).is_file():
        emit({"status": "error", "requestId": request_id,
              "code": "ENGINE_NOT_INSTALLED",
              "message": "No compatible local neural singing model is installed. The robot preview is not AI singing."})
        return 3

    request_path = None
    output_path = None
    try:
        import tempfile
        with tempfile.TemporaryDirectory(prefix="speakspell-") as temp:
            root = Path(temp)
            request_path = root / "request.json"
            output_path = root / "render.wav"
            request_path.write_text(json.dumps(request, ensure_ascii=False), encoding="utf-8")
            emit({"status": "progress", "requestId": request_id, "progress": 0.05,
                  "message": "Starting local singing model"})
            result = subprocess.run(
                [runner, "--request", str(request_path), "--output", str(output_path)],
                capture_output=True, text=True, timeout=900, check=False
            )
            if result.returncode != 0:
                detail = (result.stderr or result.stdout or "Model runner failed").strip()[-1200:]
                emit({"status": "error", "requestId": request_id, "code": "MODEL_RENDER_FAILED",
                      "message": detail})
                return 4
            if not output_path.is_file() or output_path.stat().st_size < 44:
                emit({"status": "error", "requestId": request_id, "code": "INVALID_MODEL_OUTPUT",
                      "message": "The model runner did not produce a valid WAV file."})
                return 5
            # The worker output is only a validation signal here. A production
            # app integration must copy it to a user-selected persistent path.
            emit({"status": "error", "requestId": request_id, "code": "OUTPUT_HANDOFF_NOT_CONFIGURED",
                  "message": "A model ran, but persistent WAV handoff is not configured in this build."})
            return 6
    except subprocess.TimeoutExpired:
        emit({"status": "error", "requestId": request_id, "code": "RENDER_TIMEOUT",
              "message": "The local singing model exceeded the 15-minute render limit."})
        return 7
    except Exception as exc:
        emit({"status": "error", "requestId": request_id, "code": "WORKER_ERROR",
              "message": str(exc)})
        return 8

if __name__ == "__main__":
    sys.exit(main())
