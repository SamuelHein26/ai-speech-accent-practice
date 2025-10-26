"""AssemblyAI-backed transcription that returns word confidences."""

from __future__ import annotations

import os
import time
from typing import Iterable, List

import requests


class AccentTranscriptionError(RuntimeError):
    """Raised when transcription fails."""


class AccentTranscriber:
    UPLOAD_URL = "https://api.assemblyai.com/v2/upload"
    TRANSCRIPT_URL = "https://api.assemblyai.com/v2/transcript"

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("ASSEMBLYAI_API_KEY")
        if not self.api_key:
            raise ValueError("ASSEMBLYAI_API_KEY is not configured")

    def transcribe_with_words(
        self,
        audio_bytes: bytes,
        *,
        poll_interval: float = 2.0,
        timeout_seconds: float = 120.0,
    ) -> tuple[str, List[dict]]:
        """Upload audio bytes and return the transcript text and words."""

        upload_url = self._upload_audio(audio_bytes)
        transcript_id = self._start_transcription(upload_url)
        return self._poll_transcript(transcript_id, poll_interval, timeout_seconds)

    def _upload_audio(self, audio_bytes: bytes) -> str:
        headers = {"authorization": self.api_key, "content-type": "application/octet-stream"}

        def _chunked() -> Iterable[bytes]:
            chunk_size = 5 * 1024 * 1024
            for index in range(0, len(audio_bytes), chunk_size):
                yield audio_bytes[index : index + chunk_size]

        response = requests.post(self.UPLOAD_URL, headers=headers, data=_chunked())
        if response.status_code != 200:
            raise AccentTranscriptionError(
                f"Failed to upload audio: {response.status_code} {response.text}"
            )

        data = response.json()
        upload_url = data.get("upload_url")
        if not upload_url:
            raise AccentTranscriptionError("AssemblyAI upload did not return a URL")
        return upload_url

    def _start_transcription(self, upload_url: str) -> str:
        payload = {
            "audio_url": upload_url,
            "punctuate": True,
            "format_text": True,
            "word_boost": [],
            "speaker_labels": False,
        }
        headers = {
            "authorization": self.api_key,
            "content-type": "application/json",
        }

        response = requests.post(self.TRANSCRIPT_URL, json=payload, headers=headers)
        if response.status_code != 200:
            raise AccentTranscriptionError(
                f"Failed to create transcript: {response.status_code} {response.text}"
            )

        data = response.json()
        transcript_id = data.get("id")
        if not transcript_id:
            raise AccentTranscriptionError("AssemblyAI transcription did not return an ID")
        return transcript_id

    def _poll_transcript(
        self,
        transcript_id: str,
        poll_interval: float,
        timeout_seconds: float,
    ) -> tuple[str, List[dict]]:
        headers = {"authorization": self.api_key}
        status_url = f"{self.TRANSCRIPT_URL}/{transcript_id}"

        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            response = requests.get(status_url, headers=headers)
            if response.status_code != 200:
                raise AccentTranscriptionError(
                    f"Polling failed: {response.status_code} {response.text}"
                )

            body = response.json()
            status = body.get("status")

            if status == "completed":
                text = body.get("text", "")
                words = body.get("words", []) or []
                cleaned_words = [
                    {
                        "word": entry.get("text", ""),
                        "confidence": float(entry.get("confidence", 0.0)),
                    }
                    for entry in words
                ]
                return text, cleaned_words

            if status == "error":
                raise AccentTranscriptionError(body.get("error", "Transcription failed"))

            time.sleep(poll_interval)

        raise AccentTranscriptionError("Transcription timed out")
