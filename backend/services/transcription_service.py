"""
transcription_service.py
Handles all speech-to-text interactions with AssemblyAI.
"""

import assemblyai as aai

class TranscriptionService:
    def __init__(self, api_key: str):
        aai.settings.api_key = api_key
        self.transcriber = aai.Transcriber()

    def transcribe_audio(self, file_path: str) -> str:
        """Run a blocking transcription job and return the text."""
        transcript = self.transcriber.transcribe(file_path)
        return transcript.text
