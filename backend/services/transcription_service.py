"""Deepgram-backed transcription service for monologue sessions.

Replaces the former AssemblyAI-based TranscriptionService.  Only the
plain transcript string is needed here (no word-level data), so this is
simpler than AccentTranscriber.
"""

from __future__ import annotations

import os

import httpx


class TranscriptionService:
    """Transcribe an audio file via Deepgram's pre-recorded API.

    Accepts a *file path* (kept for drop-in compatibility with the
    sessions router which passes a WAV path).
    """

    _LISTEN_URL = "https://api.deepgram.com/v1/listen"

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPGRAM_API_KEY is not configured")

    # ------------------------------------------------------------------
    # Public API (same signature as the old AssemblyAI service)
    # ------------------------------------------------------------------

    def transcribe_audio(
        self,
        file_path: str,
        *,
        timeout: float = 120.0,
    ) -> str:
        """Read *file_path* and return the transcript as a plain string."""
        with open(file_path, "rb") as f:
            audio_bytes = f.read()

        content_type = "audio/wav" if file_path.lower().endswith(".wav") else "audio/webm"
        return self._call_deepgram(audio_bytes, content_type=content_type, timeout=timeout)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _call_deepgram(
        self,
        audio_bytes: bytes,
        *,
        content_type: str = "audio/wav",
        timeout: float,
    ) -> str:
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": content_type,
        }
        params = {
            "model": "nova-2",
            "punctuate": "true",
            "smart_format": "true",
        }

        try:
            response = httpx.post(
                self._LISTEN_URL,
                headers=headers,
                params=params,
                content=audio_bytes,
                timeout=timeout,
            )
        except httpx.TimeoutException as exc:
            raise Exception("Deepgram request timed out") from exc
        except httpx.RequestError as exc:
            raise Exception(f"Network error calling Deepgram: {exc}") from exc

        if response.status_code != 200:
            raise Exception(
                f"Deepgram returned {response.status_code}: {response.text}"
            )

        try:
            body = response.json()
            transcript = (
                body["results"]["channels"][0]["alternatives"][0]["transcript"]
            )
        except (KeyError, IndexError) as exc:
            raise Exception(f"Unexpected Deepgram response shape: {exc}") from exc

        return transcript or ""