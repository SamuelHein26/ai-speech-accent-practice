import ffmpeg
import tempfile
import whisper
from fastapi import FastAPI, WebSocket

app = FastAPI()
model = whisper.load_model("base")

@app.websocket("/ws/monologue")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            data = await websocket.receive_bytes()

            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(data)
                tmp.flush()

                # Convert WebM → WAV
                wav_path = tmp.name.replace(".webm", ".wav")
                ffmpeg.input(tmp.name).output(wav_path).run(overwrite_output=True)

                result = model.transcribe(wav_path)
                await websocket.send_json({"partial": result["text"]})
        except Exception as e:
            print("WebSocket error:", e)
            break
