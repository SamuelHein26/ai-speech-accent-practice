"""Deepgram-backed transcription service for monologue sessions.

Transcribes audio with full support for:
- Filler words ("um", "uh", "ah", "erm", etc.)
- Word-level timestamps and pause / pacing metrics detection
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Tuple

import httpx


class TranscriptionService:
    """Transcribe audio files via Deepgram's pre-recorded API with pause analysis."""

    _LISTEN_URL = "https://api.deepgram.com/v1/listen"
    PAUSE_THRESHOLD_SECONDS = 1.2  # Silences >= 1.2s are classified as noticeable pauses

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPGRAM_API_KEY is not configured")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def transcribe_audio(
        self,
        file_path: str,
        *,
        timeout: float = 120.0,
    ) -> str:
        """Read *file_path* and return the plain transcript string with filler words."""
        transcript, _ = self.transcribe_audio_with_timing(file_path, timeout=timeout)
        return transcript

    def transcribe_audio_with_timing(
        self,
        file_path: str,
        *,
        timeout: float = 120.0,
    ) -> Tuple[str, Dict[str, Any]]:
        """Read *file_path* and return (transcript, timing_analysis).

        ``timing_analysis`` includes:
          - ``annotated_transcript``: text with ``[pause X.Xs]`` markers
          - ``pause_count``: number of pauses >= PAUSE_THRESHOLD_SECONDS
          - ``longest_pause_seconds``: duration of longest pause
          - ``total_pause_duration_seconds``: sum of all pauses
          - ``word_count``: total recognized words
        """
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
    ) -> Tuple[str, Dict[str, Any]]:
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": content_type,
        }
        params = {
            "model": "nova-2",
            "punctuate": "true",
            "smart_format": "true",
            "filler_words": "true",  # Include ums, uhs, etc.
            "words": "true",         # Include word-level timestamps
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
            alternative = body["results"]["channels"][0]["alternatives"][0]
        except (KeyError, IndexError) as exc:
            raise Exception(f"Unexpected Deepgram response shape: {exc}") from exc

        raw_transcript = alternative.get("transcript", "") or ""
        words: List[Dict[str, Any]] = alternative.get("words", []) or []

        timing_analysis = self._compute_pause_metrics(words, raw_transcript)
        return raw_transcript, timing_analysis

    def _compute_pause_metrics(
        self,
        words: List[Dict[str, Any]],
        raw_transcript: str,
    ) -> Dict[str, Any]:
        if not words:
            return {
                "annotated_transcript": raw_transcript,
                "pause_count": 0,
                "longest_pause_seconds": 0.0,
                "total_pause_duration_seconds": 0.0,
                "word_count": 0,
            }

        annotated_tokens: List[str] = []
        pauses: List[float] = []

        for i, w in enumerate(words):
            token = w.get("punctuated_word") or w.get("word") or ""
            annotated_tokens.append(token)

            if i < len(words) - 1:
                curr_end = float(w.get("end", 0.0))
                next_start = float(words[i + 1].get("start", 0.0))
                gap = round(next_start - curr_end, 1)

                if gap >= self.PAUSE_THRESHOLD_SECONDS:
                    pauses.append(gap)
                    annotated_tokens.append(f"[pause {gap}s]")

        annotated_transcript = " ".join(annotated_tokens)
        total_pause_sec = round(sum(pauses), 1)
        longest_pause = max(pauses) if pauses else 0.0

        return {
            "annotated_transcript": annotated_transcript,
            "pause_count": len(pauses),
            "longest_pause_seconds": longest_pause,
            "total_pause_duration_seconds": total_pause_sec,
            "word_count": len(words),
        }