# routers/streaming.py
# Purpose: Expose /ws/stream endpoint that browsers connect to.
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.streaming_transcription_service import StreamingTranscriptionService

router = APIRouter(tags=["Realtime"])

streaming_service = StreamingTranscriptionService()

@router.websocket("/ws/stream")
async def ws_stream(websocket: WebSocket):
    # Accept the browser WS connection
    await websocket.accept(subprotocol="json")
    try:
        # Bridge to AAI RT service until either side closes.
        await streaming_service.proxy(websocket)
    except WebSocketDisconnect:
        # Client disconnected; graceful cleanup handled by service
        pass
    except Exception as e:
        # Best-effort error message back to client, then close
        try:
            await websocket.send_text(f'{{"error":"{str(e)}"}}')
        except Exception:
            pass
        finally:
            await websocket.close()
