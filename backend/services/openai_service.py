"""LLM service for topic suggestions and speech feedback.

Supports three backends, selected via the ``LLM_BACKEND`` environment
variable:

  LLM_BACKEND=gemini  (default / production)
      Uses the google-genai SDK with ``gemini-3.5-flash-lite``.
      Requires GEMINI_API_KEY.

  LLM_BACKEND=ollama  (local development)
      Uses the OpenAI SDK pointed at a local Ollama server.
      Requires OLLAMA_BASE_URL (default: http://localhost:11434/v1).
      Model is set via OLLAMA_MODEL (default: llama3.2:3b).

  LLM_BACKEND=openai  (legacy fallback)
      Uses the OpenAI SDK with OPENAI_API_KEY (original behaviour).

The public interface — generate_topics() and analyze_speech() — is
unchanged so main.py requires only a one-line update.
"""

from __future__ import annotations

import os
import re
from typing import Optional


def _build_service() -> "LLMService":
    """Factory: read LLM_BACKEND and return the right implementation."""
    backend = os.getenv("LLM_BACKEND", "gemini").lower()

    if backend == "gemini":
        return _GeminiService()
    if backend == "ollama":
        return _OllamaService()
    # Legacy / explicit openai
    return _OpenAIService()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _clean_topics(raw_text: str) -> list[str]:
    """Strip numbering/bullets and return up to 3 non-empty topic lines."""
    topics: list[str] = []
    for line in raw_text.split("\n"):
        cleaned = re.sub(r"^[\d\.\-\•\*\s]+", "", line).strip()
        if (
            cleaned
            and not cleaned.lower().startswith("here are")
            and not cleaned.lower().startswith("sure")
        ):
            topics.append(cleaned)
    return topics[:3]


_TOPIC_PROMPT_TEMPLATE = (
    "You are an AI conversation coach. Based on the user's recent monologue, "
    "suggest exactly 3 short, engaging follow-up topic ideas (each under 15 words) "
    "to help them keep speaking naturally.\n"
    "Output ONLY the 3 topics, one per line, with no introductory text, no numbering, "
    "and no bullet points.\n\n"
    "Transcript: {transcript}"
)

_FEEDBACK_PROMPT_TEMPLATE = (
    "You are a speech evaluator. Analyze this transcript and return structured feedback "
    "on clarity, fluency, and filler-word usage.\n\n"
    "Transcript:\n{transcript}"
)


# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------

class LLMService:
    """Abstract base — subclasses implement _complete(prompt) -> str."""

    def generate_topics(self, transcript: str) -> list[str]:
        prompt = _TOPIC_PROMPT_TEMPLATE.format(transcript=transcript)
        raw = self._complete(prompt)
        return _clean_topics(raw)

    def analyze_speech(self, transcript: str) -> str:
        prompt = _FEEDBACK_PROMPT_TEMPLATE.format(transcript=transcript)
        return self._complete(prompt)

    def _complete(self, prompt: str) -> str:  # pragma: no cover
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Gemini backend  (production)
# ---------------------------------------------------------------------------

class _GeminiService(LLMService):
    """Uses google-genai SDK with gemini-3.5-flash-lite."""

    def __init__(self) -> None:
        from google import genai  # type: ignore[import-untyped]

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured")
        self._client = genai.Client(api_key=api_key)

    def _complete(self, prompt: str) -> str:
        interaction = self._client.interactions.create(
            model="gemini-3.5-flash-lite",
            input=prompt,
            store=False,
        )
        return (interaction.output_text or "").strip()


# ---------------------------------------------------------------------------
# Ollama backend  (local dev)
# ---------------------------------------------------------------------------

class _OllamaService(LLMService):
    """Uses the OpenAI SDK pointed at a local Ollama instance."""

    def __init__(self) -> None:
        from openai import OpenAI  # type: ignore[import-untyped]

        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        self._model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
        self._client = OpenAI(base_url=base_url, api_key="ollama")

    def _complete(self, prompt: str) -> str:
        completion = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
        )
        return (completion.choices[0].message.content or "").strip()


# ---------------------------------------------------------------------------
# OpenAI backend  (legacy / fallback)
# ---------------------------------------------------------------------------

class _OpenAIService(LLMService):
    """Original OpenAI gpt-4o-mini implementation kept as fallback."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        from openai import OpenAI  # type: ignore[import-untyped]

        key = api_key or os.getenv("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY is not configured")
        self._client = OpenAI(api_key=key)

    def _complete(self, prompt: str) -> str:
        completion = self._client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        return (completion.choices[0].message.content or "").strip()


# ---------------------------------------------------------------------------
# Public alias kept for backwards-compat with main.py import
# ---------------------------------------------------------------------------

#: Alias so ``from services.openai_service import OpenAIService`` still works.
OpenAIService = LLMService
