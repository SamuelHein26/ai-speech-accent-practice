// app/monologue/page.tsx
// Purpose: Monologue page with RT streaming → live transcript + finalization.
// Notes:
// - Uses env: NEXT_PUBLIC_API_BASE_URL (e.g., https://your-api.onrender.com)
// - Auto-selects ws:// or wss:// based on window.location.protocol
// - Sends PCM16 binary frames; expects backend /ws/stream proxy to accept binary
// - No layout/visual changes versus your current version.

"use client";

import Header from "../components/Header";
import { useEffect, useRef, useState } from "react";
import LiveWaveform from "../components/LiveWaveform";

// ---- API response types (strict typing; no any) ----
type StartSessionResponse = { session_id: string; is_guest: boolean };
type FinalizeResponse = { final: string; audio_url?: string };

// ---- Helpers: build base API + WS URLs safely ----
const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) || "http://127.0.0.1:8000";

const wsURL = (): string => {
  // If API_BASE is absolute (https://api...), derive matching ws scheme
  try {
    const u = new URL(API_BASE);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/ws/stream";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    // Fallback from current origin
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    return `${isHttps ? "wss" : "ws"}://${window.location.host}/ws/stream`;
  }
};

export default function MonologuePage() {
  /** === UI/State === */
  const [mounted, setMounted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live render text: committed final turns + replaceable partial
  const [liveCommitted, setLiveCommitted] = useState("");
  const [livePartial, setLivePartial] = useState("");

  // Display text assembled from committed + partial
  const displayText = [liveCommitted, livePartial].filter(Boolean).join(" ");

  /** === Session & Media Refs === */
  const sessionRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  /** === Streaming Refs (WS + WebAudio) === */
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  /** === Dedup guards === */
  const lastFinalRef = useRef<string>("");   // last finalized string
  const lastPartialRef = useRef<string>(""); // last partial to avoid UI churn

  /** === Mount bootstrap === */
  useEffect(() => {
    setMounted(true);
    const existing = sessionStorage.getItem("guest_session_id");
    if (existing) sessionRef.current = existing;

    // Cleanup on unmount in case user navigates away mid-stream
    return () => {
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "Terminate" }));
          wsRef.current.close();
        }
      } catch {}
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") {
        mr.stop();
      }
    };
  }, []);

  /** === PCM Conversion Utilities === */
  // Convert Float32 samples [-1..1] → Int16 little-endian PCM
  const floatTo16BitPCM = (input: Float32Array): Int16Array => {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let s = input[i];
      if (s > 1) s = 1;
      if (s < -1) s = -1;
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  // Downsample Float32 @ inputRate → Int16 @ 16kHz (mono)
  const downsampleTo16k = (buffer: Float32Array, inputRate: number): Int16Array => {
    const targetRate = 16000;
    if (inputRate === targetRate) return floatTo16BitPCM(buffer);
    const ratio = inputRate / targetRate;
    const newLen = Math.round(buffer.length / ratio);
    const down = new Float32Array(newLen);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < newLen) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      down[offsetResult] = accum / (count || 1);
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return floatTo16BitPCM(down);
  };

  /** === Start Recording (Streaming) === */
  const startRecording = async (): Promise<void> => {
    setError(null);
    setFinalTranscript("");
    setLiveCommitted("");
    setLivePartial("");
    lastFinalRef.current = "";
    lastPartialRef.current = "";
    setAudioUrl(null);

    try {
      // Create/ensure a DB session for this recording
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const startRes = await fetch(`${API_BASE}/session/start`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!startRes.ok) {
        const err = (await startRes.json()) as { detail?: string };
        throw new Error(err.detail || "Failed to start session");
      }
      const startData: StartSessionResponse = await startRes.json();
      sessionRef.current = startData.session_id;
      sessionStorage.setItem("guest_session_id", startData.session_id);

      // Acquire mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, noiseSuppression: true, echoCancellation: true },
      });

      // MediaRecorder for final blob persistence (keeps your finalize flow)
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      audioChunks.current = [];
      mr.ondataavailable = (evt: BlobEvent) => {
        if (evt.data.size > 0) audioChunks.current.push(evt.data);
      };
      mr.start();

      // Establish WS to FastAPI streaming proxy
      const url = wsURL();
      const ws = new WebSocket(url);
      // If your backend expects binary frames (AAI v3), default is fine; just send ArrayBuffer
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        // WebAudio graph
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 48000,
        });
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;

        // ScriptProcessor (deprecated but simple); consider AudioWorklet when you want ultra-low-lat
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const int16 = downsampleTo16k(input, audioCtx.sampleRate);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(int16.buffer); // raw PCM16 as ArrayBuffer
          }
        };

        source.connect(processor);
        // Avoid echo by NOT connecting to destination
        // processor.connect(audioCtx.destination); // <- leave disconnected
      };

      ws.onmessage = (event: MessageEvent<string | ArrayBufferLike | Blob>) => {
        if (typeof event.data !== "string") return;
        try {
          const msg = JSON.parse(event.data as string) as Record<string, unknown>;
          const t = msg["type"];

          if (t === "Begin") {
            return;
          }

          if (t === "Turn") {
            const text = String(msg["transcript"] || "").trim();
            const isFinal = Boolean(msg["turn_is_formatted"] || msg["is_final"]);

            if (!text) return;

            if (isFinal) {
              if (text !== lastFinalRef.current) {
                setLiveCommitted((prev) => (prev ? prev + " " : "") + text);
                lastFinalRef.current = text;
              }
              setLivePartial("");
              lastPartialRef.current = "";
            } else {
              // Replace partial only if it changed
              if (text !== lastPartialRef.current) {
                setLivePartial(text);
                lastPartialRef.current = text;
              }
            }
          }
        } catch {
          // Non-JSON frames or heartbeat; ignore
        }
      };

      ws.onerror = () => setError("Streaming connection error");
      ws.onclose = () => { /* no-op; cleaned in stop */ };

      setIsRecording(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start streaming";
      setError(msg);
      // Best-effort cleanup
      await stopRecording();
    }
  };

  /** === Stop Recording (Close streaming + finalize blob) === */
  const stopRecording = async (): Promise<void> => {
    setIsRecording(false);
    setIsProcessing(true);

    try {
      // Terminate WS session
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "Terminate" }));
        } catch {}
        wsRef.current.close();
      }

      // Tear down WebAudio
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioCtxRef.current) await audioCtxRef.current.close();

      // Persist final blob via your existing finalize API
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") {
        await new Promise<void>((resolve) => {
          mr.onstop = () => resolve();
          mr.stop();
        });
      }

      if (!sessionRef.current) throw new Error("Session not initialized");

      if (audioChunks.current.length > 0) {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        const fd = new FormData();
        fd.append("file", blob, "final.webm");

        const uploadRes = await fetch(`${API_BASE}/session/${sessionRef.current}/chunk`, {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) {
          const err = (await uploadRes.json()) as { detail?: string };
          throw new Error(err.detail || "Failed to upload audio chunk");
        }

        const finalizeRes = await fetch(`${API_BASE}/session/${sessionRef.current}/finalize`, {
          method: "POST",
        });
        if (!finalizeRes.ok) {
          const err = (await finalizeRes.json()) as { detail?: string };
          throw new Error(err.detail || "Transcription failed");
        }

        const data: FinalizeResponse = await finalizeRes.json();
        setFinalTranscript(data.final || "Transcription incomplete.");
        setAudioUrl(data.audio_url || URL.createObjectURL(blob));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to stop streaming";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  /** === Render === */
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
      <Header />

      {!mounted ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          {!isRecording && (
            <>
              <h2 className="text-4xl font-bold mb-8 text-gray-900 dark:text-gray-100">
                Monologue Mode
              </h2>
              <p className="max-w-2xl text-center text-gray-700 dark:text-gray-300 text-lg mb-8">
                Practice your speaking fluency for up to{" "}
                <span className="font-semibold text-red-600 dark:text-red-400">3 minutes</span>. If you
                pause for too long, you’ll automatically receive topic suggestions to keep the monologue
                flowing.
              </p>
            </>
          )}

          {/* CTA controls unchanged */}
          <div className="flex space-x-4 mb-8">
            {!isRecording && !isProcessing ? (
              <button
                onClick={startRecording}
                className="px-6 py-4 bg-gray-700 text-white rounded-full shadow hover:bg-red-900 transition-colors"
              >
                Start Recording
              </button>
            ) : isRecording ? (
              <button
                onClick={stopRecording}
                className="px-8 py-3 bg-red-600 text-white rounded-full shadow hover:bg-red-700"
              >
                Stop Recording
              </button>
            ) : (
              <button disabled className="px-8 py-3 bg-gray-500 text-white rounded-full shadow">
                Processing...
              </button>
            )}
          </div>

          {/* Waveform unchanged */}
          {isRecording && <LiveWaveform isRecording={isRecording} />}

          {/* Live transcript box only while recording */}
          {isRecording && (
            <div className="w-full max-w-2xl mt-6 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6">
              <h3 className="text-lg font-semibold mb-2">Live Transcript</h3>
              <p className="min-h-[120px] whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {displayText || "Listening... start speaking."}
              </p>
            </div>
          )}

          {/* Error box unchanged */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 p-4 rounded-xl shadow mb-6 max-w-2xl">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Final transcript unchanged */}
          {finalTranscript && (
            <div className="w-full max-w-2xl bg-green-50 dark:bg-green-900/40 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6 mb-6">
              <h3 className="text-lg font-semibold mb-2">Final Transcript</h3>
              <p className="whitespace-pre-line">{finalTranscript}</p>
            </div>
          )}

          {/* Playback unchanged */}
          {audioUrl && (
            <div className="w-full max-w-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6">
              <h3 className="text-lg font-semibold mb-2">Playback</h3>
              <audio controls src={audioUrl} className="w-full mt-2"></audio>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
