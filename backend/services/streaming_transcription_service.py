# services/streaming_transcription_service.py
# Purpose: FastAPI WS <-> AssemblyAI Universal Streaming (v3) bridge using aiohttp WS client.
# Proto: Browser sends binary PCM16 @ 16kHz frames; AAI replies JSON text frames ("Begin" | "Turn" | "Termination").
# Sec:   Authorization header is sent directly to AAI WS per official sample.

import os
import json
import asyncio
from typing import Optional

import aiohttp                    # WS client to AAI
from fastapi import WebSocket     # WS server to browser
from fastapi import WebSocketDisconnect
from dotenv import load_dotenv

load_dotenv()

# --- Config: resolved at import time ---
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_STREAMING_API_KEY")

# Universal Streaming v3 endpoint; match official sample querystring
AAI_WS_ENDPOINT = (
    "wss://streaming.assemblyai.com/v3/ws"
    "?sample_rate=16000&format_turns=true"
)


class StreamingTranscriptionService:
    """Minimal duplex proxy between browser WS and AAI Universal Streaming via aiohttp."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or ASSEMBLYAI_API_KEY
        if not self.api_key:
            raise ValueError("Missing ASSEMBLYAI_API_KEY for streaming")

    async def proxy(self, client_ws: WebSocket) -> None:
        """
        Bridge traffic:
          - client_ws.receive() -> send_bytes/send_str -> AAI ws
          - AAI ws frames       -> client_ws.send_text(JSON)
        """
        # Build headers for AAI WS handshake (per official sample)
        headers = {"Authorization": self.api_key}

        # Create a session to manage the WS connection lifecycle
        async with aiohttp.ClientSession() as session:
            # Connect to AAI Universal Streaming WS
            async with session.ws_connect(AAI_WS_ENDPOINT, headers=headers, heartbeat=20) as aai_ws:

                # --- Task: AAI -> Client ---
                async def aai_to_client() -> None:
                    """
                    Forward frames from AAI to browser.
                    AAI emits TEXT frames containing JSON payloads for Begin/Turn/Termination.
                    """
                    try:
                        async for msg in aai_ws:
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                # Forward JSON text as-is to client
                                await client_ws.send_text(msg.data)
                            elif msg.type == aiohttp.WSMsgType.BINARY:
                                # Not expected from AAI in this flow; wrap defensively
                                await client_ws.send_text(json.dumps({
                                    "type": "RawBinary",
                                    "bytes_len": len(msg.data),
                                }))
                            elif msg.type == aiohttp.WSMsgType.ERROR:
                                # Propagate an error marker downstream
                                await client_ws.send_text(json.dumps({
                                    "type": "Error",
                                    "reason": "Upstream AAI ws error"
                                }))
                                break
                    except Exception as e:
                        # Best-effort error report to client
                        try:
                            await client_ws.send_text(json.dumps({
                                "type": "Error",
                                "reason": f"AAI upstream closed: {str(e)}"
                            }))
                        except Exception:
                            pass

                # --- Task: Client -> AAI ---
                async def client_to_aai() -> None:
                    """
                    Forward frames from browser to AAI.
                    Browser sends:
                      - audio as binary PCM16 frames (ArrayBuffer)
                      - optional control as JSON text, e.g., {"type":"Terminate"}
                    """
                    try:
                        while True:
                            pkt = await client_ws.receive()
                            # Binary audio payload (PCM16 @ 16kHz)
                            if "bytes" in pkt and pkt["bytes"] is not None:
                                await aai_ws.send_bytes(pkt["bytes"])
                            # Text control payload (JSON)
                            elif "text" in pkt and pkt["text"] is not None:
                                await aai_ws.send_str(pkt["text"])
                            # Close from client (disconnect path)
                            elif pkt.get("type") in ("websocket.disconnect", "websocket.close"):
                                # Attempt graceful termination upstream
                                try:
                                    await aai_ws.send_str(json.dumps({"type": "Terminate"}))
                                finally:
                                    break
                    except WebSocketDisconnect:
                        # Client vanished; try to terminate upstream politely
                        try:
                            await aai_ws.send_str(json.dumps({"type": "Terminate"}))
                        except Exception:
                            pass
                    except Exception:
                        # Unexpected; still attempt to terminate upstream politely
                        try:
                            await aai_ws.send_str(json.dumps({"type": "Terminate"}))
                        except Exception:
                            pass

                # Run both directions concurrently
                await asyncio.gather(aai_to_client(), client_to_aai())
