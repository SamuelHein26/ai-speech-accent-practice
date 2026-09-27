import pytest
from unittest.mock import MagicMock, patch
from services.llm_service import (
    _clean_topics,
    _GeminiService,
    _OllamaService,
    _OpenAIService,
    _build_service,
)


def test_clean_topics_strips_bullets_and_numbers():
    raw_topics = (
        "1. Tell me about your favorite travel experience.\n"
        "- What kind of movies do you enjoy watching?\n"
        "* How do you usually handle stressful situations?\n"
        "Here are some ideas:\n"
        "4. Extra topic that should be ignored because max is 3"
    )
    topics = _clean_topics(raw_topics)
    assert len(topics) == 3
    assert topics[0] == "Tell me about your favorite travel experience."
    assert topics[1] == "What kind of movies do you enjoy watching?"
    assert topics[2] == "How do you usually handle stressful situations?"


def test_build_service_gemini(monkeypatch):
    monkeypatch.setenv("LLM_BACKEND", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "fake-test-key")
    with patch("google.genai.Client") as mock_client:
        service = _build_service()
        assert isinstance(service, _GeminiService)


def test_build_service_ollama(monkeypatch):
    monkeypatch.setenv("LLM_BACKEND", "ollama")
    with patch("openai.OpenAI") as mock_client:
        service = _build_service()
        assert isinstance(service, _OllamaService)


def test_build_service_openai(monkeypatch):
    monkeypatch.setenv("LLM_BACKEND", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "fake-test-key")
    with patch("openai.OpenAI") as mock_client:
        service = _build_service()
        assert isinstance(service, _OpenAIService)


def test_gemini_service_generate_content(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    with patch("google.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_client_cls.return_value = mock_instance
        mock_response = MagicMock()
        mock_response.text = "Mocked speech feedback analysis"
        mock_instance.models.generate_content.return_value = mock_response

        service = _GeminiService()
        result = service._complete("Test prompt")

        assert result == "Mocked speech feedback analysis"
        mock_instance.models.generate_content.assert_called_once_with(
            model="gemini-2.5-flash",
            contents="Test prompt",
        )
