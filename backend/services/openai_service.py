import os
import re
from typing import Optional
from openai import OpenAI

class OpenAIService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            if not self.api_key:
                raise ValueError("OPENAI_API_KEY is not configured")
            self._client = OpenAI(api_key=self.api_key)
        return self._client

    def generate_topics(self, transcript: str):
        prompt = (
            "You are an AI conversation coach. Based on the user's recent monologue, "
            "suggest exactly 3 short, engaging follow-up topic ideas (each under 15 words) "
            "to help them keep speaking naturally.\n"
            "Output ONLY the 3 topics, one per line, with no introductory text, no numbering, and no bullet points.\n\n"
            f"Transcript: {transcript}"
        )

        completion = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = completion.choices[0].message.content or ""
        topics: list[str] = []
        for line in raw_text.split("\n"):
            cleaned = re.sub(r"^[\d\.\-\•\*\s]+", "", line).strip()
            if cleaned and not cleaned.lower().startswith("here are") and not cleaned.lower().startswith("sure"):
                topics.append(cleaned)
        return topics[:3]

    def analyze_speech(self, transcript: str):

        prompt = (
            "You are a speech evaluator. Analyze this transcript and return structured feedback "
            "on clarity, fluency, and filler-word usage.\n\n"
            f"Transcript:\n{transcript}"
        )

        completion = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        return completion.choices[0].message.content
