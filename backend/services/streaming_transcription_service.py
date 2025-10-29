import os
import json
import asyncio
from typing import Optional

import aiohttp                    
from fastapi import WebSocket     
from fastapi import WebSocketDisconnect
from dotenv import load_dotenv

load_dotenv()

ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_STREAMING_API_KEY")


AAI_WS_ENDPOINT = (
    "wss://streaming.assemblyai.com/v3/ws"
    "?sample_rate=16000&format_turns=true"
)


class StreamingTranscriptionService:

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or ASSEMBLYAI_API_KEY
        if not self.api_key:
            raise ValueError("Missing ASSEMBLYAI_API_KEY for streaming")

    async def proxy(self, client_ws: WebSocket) -> None:

        headers = {"Authorization": self.api_key}
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(AAI_WS_ENDPOINT, headers=headers, heartbeat=20) as aai_ws:
                async def aai_to_client() -> None:
                    try:
                        async for msg in aai_ws:
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                await client_ws.send_text(msg.data)
                            elif msg.type == aiohttp.WSMsgType.BINARY:
                          
                                await client_ws.send_text(json.dumps({
                                    "type": "RawBinary",
                                    "bytes_len": len(msg.data),
                                }))
                            elif msg.type == aiohttp.WSMsgType.ERROR:
                             
                                await client_ws.send_text(json.dumps({
                                    "type": "Error",
                                    "reason": "Upstream AAI ws error"
                                }))
                                break
                    except Exception as e:
                        try:
                            await client_ws.send_text(json.dumps({
                                "type": "Error",
                                "reason": f"AAI upstream closed: {str(e)}"
                            }))
                        except Exception:
                            pass

                async def client_to_aai() -> None:

                    try:
                        while True:
                            pkt = await client_ws.receive()
                            if "bytes" in pkt and pkt["bytes"] is not None:
                                await aai_ws.send_bytes(pkt["bytes"])
                            elif "text" in pkt and pkt["text"] is not None:
                                await aai_ws.send_str(pkt["text"])
                            elif pkt.get("type") in ("websocket.disconnect", "websocket.close"):
                                try:
                                    await aai_ws.send_str(json.dumps({"type": "Terminate"}))
                                finally:
                                    break
                    except WebSocketDisconnect:
                        try:
                            await aai_ws.send_str(json.dumps({"type": "Terminate"}))
                        except Exception:
                            pass
                    except Exception:
                        try:
                            await aai_ws.send_str(json.dumps({"type": "Terminate"}))
                        except Exception:
                            pass
                await asyncio.gather(aai_to_client(), client_to_aai())
