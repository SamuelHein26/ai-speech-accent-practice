import os
import json
import asyncio
import websockets  # pip install websockets
import aiohttp     # pip install aiohttp

AAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
AAI_TOKEN_URL = "https://api.assemblyai.com/v2/realtime/token"
AAI_WS_URL = "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000"

class StreamingTranscriptionService:
    """Handles real-time token issuance and proxying WS frames to/from AAI."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or AAI_API_KEY
        if not self.api_key:
            raise ValueError("Missing AssemblyAI API key for streaming.")

    async def create_realtime_token(self) -> str:
        """Obtain a short-lived token for AAI realtime WS."""
        headers = {"authorization": self.api_key}
        async with aiohttp.ClientSession() as session:
            async with session.post(AAI_TOKEN_URL, headers=headers) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise RuntimeError(f"AAI token request failed: {resp.status} {text}")
                data = await resp.json()
                return data["token"]

    async def proxy(self, client_ws, on_close_cb=None):
        """
        Bridge between browser WS (client_ws) and AAI WS.
        - Receives base64 PCM16 frames from browser.
        - Sends them to AAI as JSON {audio_data: base64_str}.
        - Forwards AAI messages (partial/final transcripts) back to browser as JSON.
        """
        token = await self.create_realtime_token()
        aai_uri = f"{AAI_WS_URL}&token={token}"

        # Connect to AAI upstream WebSocket
        async with websockets.connect(
            aai_uri,
            ping_interval=5,
            ping_timeout=20,
            max_size=5 * 1024 * 1024,
        ) as aai_ws:

            async def aai_to_client():
                """Forward messages from AAI to browser safely as JSON."""
                try:
                    async for msg in aai_ws:
                        try:
                            parsed = json.loads(msg)
                            # Always send JSON-encoded string to frontend
                            await client_ws.send_text(json.dumps(parsed))
                        except json.JSONDecodeError:
                            # Wrap non-JSON messages in a structured payload
                            await client_ws.send_text(json.dumps({
                                "message_type": "RawMessage",
                                "text": str(msg)
                            }))
                except Exception as e:
                    await client_ws.send_text(json.dumps({
                        "message_type": "Error",
                        "text": f"AAI upstream closed: {e}"
                    }))

            async def client_to_aai():
                """Forward messages from browser to AAI."""
                try:
                    while True:
                        message = await client_ws.receive_text()
                        if message.strip().lower() in {"ping", "keepalive"}:
                            continue
                        await aai_ws.send(message)
                except Exception:
                    try:
                        await aai_ws.send(json.dumps({"terminate_session": True}))
                    except Exception:
                        pass

            await asyncio.gather(aai_to_client(), client_to_aai(), return_exceptions=True)

        if on_close_cb:
            await on_close_cb()
