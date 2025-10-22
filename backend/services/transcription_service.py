# services/transcription_service.py
import requests
import time
import os

ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

class TranscriptionService:
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("Missing AssemblyAI API key.")
        self.api_key = api_key
        self.headers = {"authorization": self.api_key, "content-type": "application/json"}

    def transcribe_audio(self, file_path: str) -> str:
        """
        Uploads the file to AssemblyAI and polls until transcription completes.
        """
        print(f"Uploading {file_path} to AssemblyAI...")

        # Step 1 — Upload
        with open(file_path, "rb") as f:
            upload_res = requests.post(
                "https://api.assemblyai.com/v2/upload",
                headers={"authorization": self.api_key},
                data=f,
            )
        if upload_res.status_code != 200:
            raise Exception(f"Upload failed: {upload_res.text}")

        upload_url = upload_res.json().get("upload_url")
        print(f"Uploaded → {upload_url}")

        # Step 2 — Create transcription job
        transcript_req = {"audio_url": upload_url}
        trans_res = requests.post(
            "https://api.assemblyai.com/v2/transcript",
            json=transcript_req,
            headers=self.headers,
        )
        if trans_res.status_code != 200:
            raise Exception(f"Transcription request failed: {trans_res.text}")

        transcript_id = trans_res.json()["id"]
        print(f"Transcription job created: {transcript_id}")

        # Step 3 — Poll for completion
        status_url = f"https://api.assemblyai.com/v2/transcript/{transcript_id}"
        while True:
            poll = requests.get(status_url, headers=self.headers)
            status_data = poll.json()
            status = status_data["status"]

            if status == "completed":
                print("Transcription completed.")
                return status_data["text"]

            if status == "error":
                raise Exception(f"Transcription failed: {status_data['error']}")

            print(f"Status: {status} (waiting 3s...)")
            time.sleep(3)
