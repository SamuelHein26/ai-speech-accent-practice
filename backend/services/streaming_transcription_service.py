"""Deepgram real-time streaming proxy.

Replaces the former AssemblyAI streaming proxy.  The FastAPI WebSocket
at /ws/stream is unchanged; this service:

  1. Opens a Deepgram streaming WebSocket (nova-2, 16 kHz PCM).
  2. Forwards raw PCM bytes from the browser to Deepgram.
  3. Translates Deepgram's response JSON into the frontend's expected
     envelope so the frontend (monologue/page.tsx) needs no changes:

     Frontend expects:
       {"type": "Turn", "transcript": "...", "is_final": bool}
       {"type": "Begin"}   — sent once on connect
       {"type": "Error", "reason": "..."}

     Deepgram sends:
       {"type": "Results", "channel": {"alternatives": [{"transcript": "..."}]},
        "is_final": bool, "speech_final": bool}
       {"type": "Metadata"}   — ignored
       {"type": "UtteranceEnd"}  — maps to a final Turn flush
"""

from __future__ import annotations

import json
import os
import asyncio
from typing import Optional

import aiohttp
from fastapi import WebSocket, WebSocketDisconnect


class StreamingTranscriptionService:

    _DG_WS_URL = (
        "wss://api.deepgram.com/v1/listen"
        "?model=nova-2"
        "&encoding=linear16"
        "&sample_rate=16000"
        "&channels=1"
        "&interim_results=true"
        "&utterance_end_ms=1000"
        "&punctuate=true"
        "&smart_format=true"
    )

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPGRAM_API_KEY is not configured")

    # ------------------------------------------------------------------
    # Public entry point — called by the /ws/stream router
    # ------------------------------------------------------------------

    async def proxy(self, client_ws: WebSocket) -> None:
        headers = {"Authorization": f"Token {self.api_key}"}

        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(
                self._DG_WS_URL, headers=headers, heartbeat=20
            ) as dg_ws:
                # Tell the browser the connection is live
                await client_ws.send_text(json.dumps({"type": "Begin"}))

                await asyncio.gather(
                    self._dg_to_client(dg_ws, client_ws),
                    self._client_to_dg(client_ws, dg_ws),
                )

    # ------------------------------------------------------------------
    # Internal coroutines
    # ------------------------------------------------------------------

    @staticmethod
    async def _dg_to_client(
        dg_ws: aiohttp.ClientWebSocketResponse,
        client_ws: WebSocket,
    ) -> None:
        """Forward and translate Deepgram messages → frontend envelope."""
        try:
            async for msg in dg_ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    translated = StreamingTranscriptionService._translate(msg.data)
                    if translated:
                        await client_ws.send_text(translated)
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    await client_ws.send_text(
                        json.dumps({"type": "Error", "reason": "Deepgram upstream error"})
                    )
                    break
        except Exception as exc:
            try:
                await client_ws.send_text(
                    json.dumps({"type": "Error", "reason": f"Upstream closed: {exc}"})
                )
            except Exception:
                pass

    @staticmethod
    async def _client_to_dg(
        client_ws: WebSocket,
        dg_ws: aiohttp.ClientWebSocketResponse,
    ) -> None:
        """Forward browser audio bytes → Deepgram."""
        try:
            while True:
                pkt = await client_ws.receive()
                if pkt.get("bytes") is not None:
                    await dg_ws.send_bytes(pkt["bytes"])
                elif pkt.get("text") is not None:
                    # Forward control messages (e.g. {"type": "CloseStream"})
                    await dg_ws.send_str(pkt["text"])
                elif pkt.get("type") in ("websocket.disconnect", "websocket.close"):
                    # Ask Deepgram to flush and close
                    try:
                        await dg_ws.send_str(json.dumps({"type": "CloseStream"}))
                    finally:
                        break
        except WebSocketDisconnect:
            try:
                await dg_ws.send_str(json.dumps({"type": "CloseStream"}))
            except Exception:
                pass
        except Exception:
            try:
                await dg_ws.send_str(json.dumps({"type": "CloseStream"}))
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Message translation
    # ------------------------------------------------------------------

    @staticmethod
    def _translate(raw: str) -> Optional[str]:
        """Translate a Deepgram JSON message into the frontend envelope.

        Returns ``None`` for messages the frontend doesn't need.
        """
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return None

        msg_type = msg.get("type", "")

        # --- Real-time transcript results ---
        if msg_type == "Results":
            try:
                transcript: str = (
                    msg["channel"]["alternatives"][0]["transcript"] or ""
                ).strip()
            except (KeyError, IndexError):
                return None

            if not transcript:
                return None

            is_final: bool = bool(msg.get("is_final", False))
            return json.dumps({
                "type": "Turn",
                "transcript": transcript,
                "is_final": is_final,
            })

        # --- Utterance end: flush any pending partial as final ---
        if msg_type == "UtteranceEnd":
            # The browser side will treat the next Results(is_final=True)
            # as the boundary; no extra message needed.
            return None

        # Ignore Metadata and anything else
        return None
