"""Deepgram-backed transcription that returns word confidences.

Replaces the former AssemblyAI-based AccentTranscriber with the same
public interface so callers (accent.py router) require no changes.
"""

from __future__ import annotations

import os
from typing import List

import httpx


class AccentTranscriptionError(RuntimeError):
    """Exception raised for accent-transcription-related errors."""
    pass


class AccentTranscriber:
    """Transcribe audio bytes via the Deepgram pre-recorded API.

    Returns ``(transcript_text, word_list)`` where each word entry is::

        {"word": str, "confidence": float}

    This is identical to the shape the accent router expects, so no router
    changes are required.
    """

    _LISTEN_URL = "https://api.deepgram.com/v1/listen"

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPGRAM_API_KEY is not configured")

    # ------------------------------------------------------------------
    # Public API (same signature as the old AssemblyAI transcriber)
    # ------------------------------------------------------------------

    def transcribe_with_words(
        self,
        audio_bytes: bytes,
        *,
        timeout: float = 120.0,
    ) -> tuple[str, List[dict]]:
        """Upload *audio_bytes* to Deepgram and return ``(text, words)``."""
        return self._call_deepgram(audio_bytes, timeout=timeout)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _call_deepgram(
        self,
        audio_bytes: bytes,
        *,
        timeout: float,
    ) -> tuple[str, List[dict]]:
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "audio/webm",
        }
        params = {
            "model": "nova-2",
            "punctuate": "true",
            "words": "true",          # include per-word confidence
            "smart_format": "true",
            "filler_words": "true",
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
            raise AccentTranscriptionError("Deepgram request timed out") from exc
        except httpx.RequestError as exc:
            raise AccentTranscriptionError(f"Network error calling Deepgram: {exc}") from exc

        if response.status_code != 200:
            raise AccentTranscriptionError(
                f"Deepgram returned {response.status_code}: {response.text}"
            )

        body = response.json()
        return self._parse_response(body)

    @staticmethod
    def _parse_response(body: dict) -> tuple[str, List[dict]]:
        try:
            alternative = body["results"]["channels"][0]["alternatives"][0]
        except (KeyError, IndexError) as exc:
            raise AccentTranscriptionError(
                f"Unexpected Deepgram response shape: {exc}"
            ) from exc

        transcript = alternative.get("transcript", "")
        raw_words: list[dict] = alternative.get("words", []) or []

        words = [
            {
                "word": entry.get("punctuated_word") or entry.get("word", ""),
                "confidence": float(entry.get("confidence", 0.0)),
            }
            for entry in raw_words
            if entry.get("word")
        ]

        return transcript, words
