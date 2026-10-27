#!/usr/bin/env python3
"""Local neural singing worker. Requires a separately installed, licensed model runner."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

def emit(message):
    print(json.dumps(message, ensure_ascii=False), flush=True)

def main():
    try:
        request = json.load(sys.stdin)
    except Exception as exc:
        emit({"status":"error","requestId":None,"code":"INVALID_REQUEST","message":f"Could not parse render request: {exc}"})
        return 2

    request_id = request.get("requestId")
    if request.get("schemaVersion") != 1 or not isinstance(request.get("notes"), list):
        emit({"status":"error","requestId":request_id,"code":"INVALID_REQUEST","message":"Expected schemaVersion 1 and a notes array."})
        return 2
    if not request["notes"]:
        emit({"status":"error","requestId":request_id,"code":"EMPTY_SONG","message":"Add at least one lyric-aligned note before rendering."})
        return 2

    destination = request.get("outputPath")
    if not isinstance(destination, str) or not destination.strip():
        emit({"status":"error","requestId":request_id,"code":"OUTPUT_PATH_REQUIRED","message":"Choose a destination WAV path before rendering."})
        return 2
    destination = Path(destination).expanduser().resolve()

    runner = os.environ.get("SPEAKSPELL_NEURAL_RUNNER")
    if not runner or not Path(runner).is_file():
        emit({"status":"error","requestId":request_id,"code":"ENGINE_NOT_INSTALLED","message":"No compatible local neural singing model is installed. The robot preview is not AI singing."})
        return 3

    try:
        with tempfile.TemporaryDirectory(prefix="speakspell-") as temp:
            root = Path(temp)
            request_path = root / "request.json"
            output_path = root / "render.wav"
            # Keep the user-facing destination out of the runner's input unless
            # needed by a backend; the worker owns final persistence and validation.
            model_request = {k:v for k,v in request.items() if k != "outputPath"}
            request_path.write_text(json.dumps(model_request, ensure_ascii=False), encoding="utf-8")
            emit({"status":"progress","requestId":request_id,"progress":0.05,"message":"Starting local singing model"})
            result = subprocess.run([runner,"--request",str(request_path),"--output",str(output_path)],
                capture_output=True,text=True,timeout=900,check=False)
            if result.returncode != 0:
                detail = (result.stderr or result.stdout or "Model runner failed").strip()[-1200:]
                emit({"status":"error","requestId":request_id,"code":"MODEL_RENDER_FAILED","message":detail})
                return 4
            if not output_path.is_file() or output_path.stat().st_size < 44:
                emit({"status":"error","requestId":request_id,"code":"INVALID_MODEL_OUTPUT","message":"The model runner did not produce a valid WAV file."})
                return 5
            # Ensure the result is a WAV container, not just an arbitrary file.
            with output_path.open("rb") as wav:
                if wav.read(4) != b"RIFF":
                    emit({"status":"error","requestId":request_id,"code":"INVALID_MODEL_OUTPUT","message":"Model output is not a RIFF WAV file."})
                    return 5
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(output_path, destination)
            emit({"status":"complete","requestId":request_id,"wavPath":str(destination),
                  "bytes":destination.stat().st_size,"sampleRate":request.get("sampleRate",44100)})
            return 0
    except subprocess.TimeoutExpired:
        emit({"status":"error","requestId":request_id,"code":"RENDER_TIMEOUT","message":"The local singing model exceeded the 15-minute render limit."})
        return 7
    except Exception as exc:
        emit({"status":"error","requestId":request_id,"code":"WORKER_ERROR","message":str(exc)})
        return 8

if __name__ == "__main__":
    sys.exit(main())
