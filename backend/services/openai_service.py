"""
openai_service.py
Handles topic generation and post-speech feedback analysis using OpenAI.
"""

from openai import OpenAI

class OpenAIService:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    def generate_topics(self, transcript: str):
        """Generate 3 new conversation topics to continue the monologue."""
        prompt = (
            "You are an AI conversation coach. Based on the user's recent monologue, "
            "suggest 3 short, engaging topics to help them keep talking naturally.\n\n"
            f"Transcript: {transcript}"
        )

        completion = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        return [line.strip("-• ") for line in completion.choices[0].message.content.split("\n") if line.strip()]

    def analyze_speech(self, transcript: str):
        """Provide feedback on fluency, filler words, and clarity."""
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
