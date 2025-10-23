# routers/streaming.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.streaming_transcription_service import StreamingTranscriptionService

router = APIRouter(tags=["Realtime"])
_service = StreamingTranscriptionService()

@router.websocket("/ws/stream")
async def ws_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        print("[WS] Client connected")
        await _service.proxy(websocket)
    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Error: {e}")
        try:
            await websocket.send_text(f'{{"type":"Error","reason":"{str(e)}"}}')
        finally:
            await websocket.close()
