from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.deepgram_streaming import DeepgramStreamingService

router = APIRouter(tags=["Realtime"])
_service = None

def _get_streaming_service() -> DeepgramStreamingService:
    global _service
    if _service is None:
        _service = DeepgramStreamingService()
    return _service

@router.websocket("/ws/stream")
async def ws_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        service = _get_streaming_service()
        print("[WS] Client connected")
        await service.proxy(websocket)
    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Error: {e}")
        try:
            await websocket.send_text(f'{{"type":"Error","reason":"{str(e)}"}}')
        finally:
            await websocket.close()
