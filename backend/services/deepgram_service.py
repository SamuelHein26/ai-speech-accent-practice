"""Deepgram transcription service.

Provides two classes:

  DeepgramService
      Transcribes a local audio file via the Deepgram pre-recorded API.
      Used by the monologue session router to produce full transcripts with
      pause/timing annotations.

  DeepgramAccentService
      Transcribes raw audio bytes and returns per-word confidence scores.
      Used by the accent training router to power the phoneme heuristic engine.

Both classes hit the same Deepgram endpoint (nova-2 pre-recorded) and share
a single API key read from the DEEPGRAM_API_KEY environment variable.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Tuple

import httpx

_LISTEN_URL = "https://api.deepgram.com/v1/listen"
_PAUSE_THRESHOLD_SECONDS = 1.2  # Silences >= 1.2 s are classified as noticeable pauses


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _resolve_api_key(api_key: str | None) -> str:
    key = api_key or os.getenv("DEEPGRAM_API_KEY")
    if not key:
        raise ValueError("DEEPGRAM_API_KEY is not configured")
    return key


def _post(
    api_key: str,
    audio_bytes: bytes,
    *,
    content_type: str,
    extra_params: dict | None = None,
    timeout: float = 120.0,
) -> dict:
    """POST audio bytes to the Deepgram pre-recorded endpoint and return the JSON body."""
    params = {
        "model": "nova-2",
        "punctuate": "true",
        "smart_format": "true",
        "filler_words": "true",
        "words": "true",
        **(extra_params or {}),
    }
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": content_type,
    }
    try:
        response = httpx.post(
            _LISTEN_URL,
            headers=headers,
            params=params,
            content=audio_bytes,
            timeout=timeout,
        )
    except httpx.TimeoutException as exc:
        raise DeepgramError("Deepgram request timed out") from exc
    except httpx.RequestError as exc:
        raise DeepgramError(f"Network error calling Deepgram: {exc}") from exc

    if response.status_code != 200:
        raise DeepgramError(
            f"Deepgram returned {response.status_code}: {response.text}"
        )
    return response.json()


def _parse_alternative(body: dict) -> dict:
    try:
        return body["results"]["channels"][0]["alternatives"][0]
    except (KeyError, IndexError) as exc:
        raise DeepgramError(f"Unexpected Deepgram response shape: {exc}") from exc


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class DeepgramError(RuntimeError):
    """Raised for any Deepgram API or network error."""


# ---------------------------------------------------------------------------
# Monologue transcription  (file-based, with pause metrics)
# ---------------------------------------------------------------------------

class DeepgramService:
    """Transcribe a local audio file via Deepgram and return pause-annotated text.

    Usage::

        svc = DeepgramService()
        transcript, timing = svc.transcribe_with_timing("/tmp/session.wav")
        annotated = timing["annotated_transcript"]
    """

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = _resolve_api_key(api_key)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def transcribe(self, file_path: str, *, timeout: float = 120.0) -> str:
        """Return the plain transcript for *file_path*."""
        transcript, _ = self.transcribe_with_timing(file_path, timeout=timeout)
        return transcript

    def transcribe_with_timing(
        self,
        file_path: str,
        *,
        timeout: float = 120.0,
    ) -> Tuple[str, Dict[str, Any]]:
        """Return ``(transcript, timing_analysis)`` for *file_path*.

        ``timing_analysis`` keys:
          - ``annotated_transcript``: text with ``[pause X.Xs]`` markers
          - ``pause_count``: number of pauses >= 1.2 s
          - ``longest_pause_seconds``
          - ``total_pause_duration_seconds``
          - ``word_count``
        """
        content_type = "audio/wav" if file_path.lower().endswith(".wav") else "audio/webm"
        with open(file_path, "rb") as fh:
            audio_bytes = fh.read()

        body = _post(self.api_key, audio_bytes, content_type=content_type, timeout=timeout)
        alt = _parse_alternative(body)

        raw_transcript: str = alt.get("transcript", "") or ""
        words: List[Dict[str, Any]] = alt.get("words", []) or []

        timing = _compute_pause_metrics(words, raw_transcript)
        return raw_transcript, timing


# ---------------------------------------------------------------------------
# Accent transcription  (bytes-based, per-word confidence)
# ---------------------------------------------------------------------------

class DeepgramAccentService:
    """Transcribe audio bytes and return per-word confidence scores.

    Used by the accent training router to feed the phoneme heuristic engine.

    Usage::

        svc = DeepgramAccentService()
        transcript, words = svc.transcribe_with_words(audio_bytes)
        # words = [{"word": "hello", "confidence": 0.97}, ...]
    """

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = _resolve_api_key(api_key)

    def transcribe_with_words(
        self,
        audio_bytes: bytes,
        *,
        timeout: float = 120.0,
    ) -> Tuple[str, List[dict]]:
        """Return ``(transcript, words)`` where each word has ``confidence``."""
        body = _post(
            self.api_key,
            audio_bytes,
            content_type="audio/webm",
            timeout=timeout,
        )
        alt = _parse_alternative(body)

        transcript: str = alt.get("transcript", "") or ""
        raw_words: List[dict] = alt.get("words", []) or []

        words = [
            {
                "word": entry.get("punctuated_word") or entry.get("word", ""),
                "confidence": float(entry.get("confidence", 0.0)),
            }
            for entry in raw_words
            if entry.get("word")
        ]
        return transcript, words


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _compute_pause_metrics(
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

            if gap >= _PAUSE_THRESHOLD_SECONDS:
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
