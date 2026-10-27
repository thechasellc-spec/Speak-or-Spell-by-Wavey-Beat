#!/usr/bin/env python3
"""Speak or Spell neural audio worker.

Supports a compatible command-line singing runner, or the optional local ACE-Step
HTTP API for full-song generation. ACE-Step is a full-song mode and does NOT promise
note-by-note MIDI alignment.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen


def emit(message):
    print(json.dumps(message, ensure_ascii=False), flush=True)


def http_json(url, payload=None, timeout=30):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method="GET" if data is None else "POST")
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def ace_step_render(base_url, request, output_path, request_id):
    """Call a locally running ACE-Step API, poll it, then download the generated WAV."""
    base_url = base_url.rstrip("/") + "/"
    notes = request["notes"]
    lyrics = request.get("lyricsText") or "\n".join(
        str(note.get("lyric", "")).strip() for note in notes if str(note.get("lyric", "")).strip()
    )
    if not lyrics.strip():
        raise ValueError("Add lyrics before generating an ACE-Step song.")
    tempo = request.get("tempoBpm", 100)
    try:
        duration = sum(max(0.05, float(n.get("durationBeats", 1))) for n in notes) * 60.0 / max(30, float(tempo))
    except (TypeError, ValueError):
        duration = 30.0
    duration = min(180.0, max(10.0, duration))
    voice = request.get("voice", {})
    voice_id = str(voice.get("voiceId", "")).lower()
    vocal_style = "male vocal" if "male" in voice_id else "female vocal" if "female" in voice_id else "lead vocal"
    render = request.get("render", {})
    settings = request.get("songSettings") or {}
    genre = str(settings.get("genre") or "Pop")
    mood = str(settings.get("mood") or "emotional and heartfelt")
    delivery = str(settings.get("vocalDelivery") or "natural expressive lead vocals")
    key_scale = str(request.get("keyScale") or settings.get("keyScale") or "").strip()
    style = request.get("stylePrompt") or f"{genre}, {mood}, {delivery}"
    control_text = f", target key/scale {key_scale}" if key_scale else ""
    prompt = f"{style}{control_text}, {vocal_style}, expressive sung vocals, clear English lyrics, coherent melody, complete song arrangement"
    payload = {
        "prompt": prompt,
        "lyrics": lyrics,
        "vocal_language": request.get("language", "en"),
        "audio_format": "wav",
        "audio_duration": duration,
        "thinking": True,
    }
    # Send target metadata where supported; keep key/tempo in the prompt too.
    try:
        payload["bpm"] = max(30, min(240, int(float(request.get("tempoBpm", 100)))))
    except (TypeError, ValueError):
        pass
    if key_scale:
        payload["key_scale"] = key_scale
    payload["time_signature"] = "4/4"
    emit({"status": "progress", "requestId": request_id, "progress": 0.05,
          "message": "Submitting lyrics to local ACE-Step full-song model"})
    submitted = http_json(urljoin(base_url, "release_task"), payload, timeout=60)
    data = submitted.get("data", {})
    task_id = data.get("task_id") or data.get("taskId")
    if not task_id:
        raise RuntimeError("ACE-Step did not return a task ID. Check that its local API is ready.")
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        time.sleep(2)
        result = http_json(urljoin(base_url, "query_result"), {"task_id_list": [task_id]}, timeout=30)
        tasks = result.get("data", [])
        task = tasks[0] if tasks else {}
        status = task.get("status", 0)
        if status == 2:
            raise RuntimeError("ACE-Step reported that song generation failed.")
        if status == 1:
            raw = task.get("result", [])
            if isinstance(raw, str):
                raw = json.loads(raw)
            items = raw if isinstance(raw, list) else [raw]
            audio_item = next((item for item in items if item.get("file") or item.get("url")), None)
            if not audio_item:
                raise RuntimeError("ACE-Step finished but returned no audio file.")
            audio_url = audio_item.get("url") or audio_item.get("file")
            if audio_url.startswith("/"):
                audio_url = urljoin(base_url, audio_url.lstrip("/"))
            elif not audio_url.startswith(("http://", "https://")):
                audio_url = urljoin(base_url, audio_url)
            req = Request(audio_url, headers={"Accept": "audio/wav"})
            with urlopen(req, timeout=120) as response, open(output_path, "wb") as target:
                shutil.copyfileobj(response, target)
            return
        emit({"status": "progress", "requestId": request_id, "progress": 0.15,
              "message": "ACE-Step is generating the vocal song locally"})
    raise TimeoutError("ACE-Step took longer than 15 minutes to generate audio.")


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
    destination = request.get("outputPath")
    if not isinstance(destination, str) or not destination.strip():
        emit({"status": "error", "requestId": request_id, "code": "OUTPUT_PATH_REQUIRED",
              "message": "Choose a destination WAV path before rendering."})
        return 2
    destination = Path(destination).expanduser().resolve()

    runner = os.environ.get("SPEAKSPELL_NEURAL_RUNNER")
    ace_url = os.environ.get("SPEAKSPELL_ACE_STEP_URL", "").strip()
    if (not runner or not Path(runner).is_file()) and not ace_url:
        emit({"status": "error", "requestId": request_id, "code": "ENGINE_NOT_INSTALLED",
              "message": "No singing model is connected. Configure a local DiffSinger-compatible runner or start the optional ACE-Step API. The robot preview is not AI singing."})
        return 3

    try:
        with tempfile.TemporaryDirectory(prefix="speakspell-") as temp:
            output_path = Path(temp) / "render.wav"
            if runner and Path(runner).is_file():
                request_path = Path(temp) / "request.json"
                model_request = {k: v for k, v in request.items() if k != "outputPath"}
                request_path.write_text(json.dumps(model_request, ensure_ascii=False), encoding="utf-8")
                emit({"status": "progress", "requestId": request_id, "progress": 0.05,
                      "message": "Starting configured local singing model"})
                runner_command = [runner, "--request", str(request_path), "--output", str(output_path)]
                if Path(runner).suffix.lower() == ".py":
                    runner_command.insert(0, sys.executable)
                result = subprocess.run(runner_command, capture_output=True, text=True, timeout=900, check=False)
                if result.returncode != 0:
                    detail = (result.stderr or result.stdout or "Model runner failed").strip()[-1200:]
                    emit({"status": "error", "requestId": request_id, "code": "MODEL_RENDER_FAILED", "message": detail})
                    return 4
            else:
                ace_step_render(ace_url, request, output_path, request_id)

            if not output_path.is_file() or output_path.stat().st_size < 44:
                emit({"status": "error", "requestId": request_id, "code": "INVALID_MODEL_OUTPUT",
                      "message": "The singing model did not produce a valid WAV file."})
                return 5
            with output_path.open("rb") as wav:
                header = wav.read(12)
                if header[:4] != b"RIFF" or header[8:12] != b"WAVE":
                    emit({"status": "error", "requestId": request_id, "code": "INVALID_MODEL_OUTPUT",
                          "message": "Model output is not a valid RIFF/WAVE file. Ensure the backend is configured to return WAV."})
                    return 5
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(output_path, destination)
            emit({"status": "complete", "requestId": request_id, "wavPath": str(destination),
                  "bytes": destination.stat().st_size, "sampleRate": request.get("sampleRate", 44100),
                  "engine": "ace-step" if not runner else "configured-runner"})
            return 0
    except (HTTPError, URLError) as exc:
        emit({"status": "error", "requestId": request_id, "code": "ACE_STEP_UNREACHABLE",
              "message": f"Could not reach the local singing API at {ace_url or 'configured runner'}: {exc}. No paid cloud API was contacted."})
        return 6
    except TimeoutError as exc:
        emit({"status": "error", "requestId": request_id, "code": "RENDER_TIMEOUT", "message": str(exc)})
        return 7
    except Exception as exc:
        emit({"status": "error", "requestId": request_id, "code": "WORKER_ERROR", "message": str(exc)})
        return 8


if __name__ == "__main__":
    sys.exit(main())
