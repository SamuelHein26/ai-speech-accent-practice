import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from database import SessionLocal
from services.auth_service import user_for_token
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
        token = await asyncio.wait_for(websocket.receive_text(), timeout=5)
        async with SessionLocal() as db:
            user = await user_for_token(token, db)
        if user is None:
            await websocket.close(code=1008, reason="Sign in to practise.")
            return

        service = _get_streaming_service()
        print("[WS] Client connected")
        await service.proxy(websocket)
    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except (TimeoutError, KeyError):
        await websocket.close(code=1008)
    except Exception:
        try:
            await websocket.send_text(json.dumps({"type": "Error", "reason": "Live transcription is unavailable."}))
        finally:
            await websocket.close()
