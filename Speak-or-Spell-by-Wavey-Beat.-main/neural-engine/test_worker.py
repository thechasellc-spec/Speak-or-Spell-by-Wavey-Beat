#!/usr/bin/env python3
"""Smoke tests for the local neural singer worker's fail-closed behavior."""
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

WORKER = Path(__file__).with_name("worker.py")

class WorkerProtocolTests(unittest.TestCase):
    def run_worker(self, payload, runner=None):
        env = dict(os.environ)
        env.pop("SPEAKSPELL_NEURAL_RUNNER", None)
        if runner is not None:
            env["SPEAKSPELL_NEURAL_RUNNER"] = runner
        proc = subprocess.run(
            [sys.executable, str(WORKER)],
            input=json.dumps(payload), text=True, capture_output=True, env=env, timeout=10
        )
        lines = [line for line in proc.stdout.splitlines() if line.strip()]
        self.assertTrue(lines, msg=f"No protocol response. stderr={proc.stderr}")
        return proc.returncode, json.loads(lines[-1])

    def test_missing_engine_reports_clear_error(self):
        code, response = self.run_worker({
            "schemaVersion": 1, "requestId": "test-1", "notes": [{"lyric": "hello"}]
        })
        self.assertEqual(code, 3)
        self.assertEqual(response["code"], "ENGINE_NOT_INSTALLED")
        self.assertEqual(response["requestId"], "test-1")

    def test_invalid_schema_is_rejected(self):
        code, response = self.run_worker({"schemaVersion": 99, "requestId": "test-2", "notes": []})
        self.assertEqual(code, 2)
        self.assertEqual(response["code"], "INVALID_REQUEST")

    def test_empty_song_is_rejected(self):
        code, response = self.run_worker({"schemaVersion": 1, "requestId": "test-3", "notes": []})
        self.assertEqual(code, 2)
        self.assertEqual(response["code"], "EMPTY_SONG")

if __name__ == "__main__":
    unittest.main()
