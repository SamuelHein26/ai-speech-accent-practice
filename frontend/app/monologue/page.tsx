"use client";

import Header from "../components/Header";
import { useEffect, useRef, useState } from "react";
import LiveWaveform from "../components/LiveWaveform";

export default function MonologuePage() {
  /** === UI/State === */
  const [mounted, setMounted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");

  // Finalized text and replaceable partial
  const [liveCommitted, setLiveCommitted] = useState("");
  const [livePartial, setLivePartial] = useState("");

  const lastFinalRef = useRef<string>("");

  /** === Session & Media Refs === */
  const sessionRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const displayText = [liveCommitted, livePartial].filter(Boolean).join(" ");

  /** === Streaming Refs (WS + WebAudio) === */
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  /** === Mount bootstrap === */
  useEffect(() => {
    setMounted(true);
    const existing = sessionStorage.getItem("guest_session_id");
    if (existing) sessionRef.current = existing;
  }, []);

  /** === PCM Conversion Utilities === */
  // Convert Float32 samples [-1..1] → Int16 little-endian PCM
  const floatTo16BitPCM = (input: Float32Array): Int16Array => {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  // Downsample Float32 @ inputRate → Int16 @ targetRate (mono)
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
      let accum = 0, count = 0;
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
  const startRecording = async () => {
    setError(null);
    setFinalTranscript("");
    setLiveTranscript("");          // if you still keep this, not required anymore
    setLiveCommitted("");           // reset committed
    setLivePartial("");             // reset partial
    lastFinalRef.current = "";      // reset dedup guard
    setAudioUrl(null);

    try {
      // Start/ensure a DB session (keeps your prior flow unchanged)
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/session/start", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to start session");
      }
      const data = await res.json();
      sessionRef.current = data.session_id;
      sessionStorage.setItem("guest_session_id", data.session_id);

      // Acquire mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });

      // Keep MediaRecorder for final blob persistence (unchanged flow)
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      audioChunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      mr.start();

      // Establish WS to FastAPI streaming proxy
      const ws = new WebSocket("ws://127.0.0.1:8000/ws/stream");
      wsRef.current = ws;

      ws.onopen = () => {
        // Initialize WebAudio processing on connect
        const audioCtx = new AudioContext({ sampleRate: 48000 }); // typical default, we downsample to 16k
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;

        // ScriptProcessor for simplicity; can upgrade to AudioWorklet for low-lat
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const int16 = downsampleTo16k(input, audioCtx.sampleRate);
          // Send as binary ArrayBuffer (AAI expects raw PCM16 frames)
          if (ws.readyState === WebSocket.OPEN) ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const t = msg?.type;

          if (t === "Begin") {
            // Reset per-session if you want
            // setLiveCommitted(""); setLivePartial(""); lastFinalRef.current = "";
            return;
          }

          if (t === "Turn") {
            const text: string = (msg?.transcript || "").trim();
            const isFormattedFinal: boolean =
              Boolean(msg?.turn_is_formatted) || Boolean(msg?.is_final);

            if (!text) return;

            if (isFormattedFinal) {
              // Only append once per final value
              if (text !== lastFinalRef.current) {
                setLiveCommitted((prev) => (prev ? prev + " " : "") + text);
                lastFinalRef.current = text;
              }
              // Clear partial since this turn is finalized
              setLivePartial("");
            } else {
              // Partial updates should REPLACE, not append
              setLivePartial(text);
            }
          }

          // Optional: handle "Termination" if you want to finalize UI
          // if (t === "Termination") { ... }

        } catch {
          // Non-JSON or control frames can be ignored
        }
      };


      ws.onerror = (e) => setError("Streaming connection error");
      ws.onclose = () => { /* noop; cleaned up in stop */ };

      setIsRecording(true);
    } catch (err: any) {
      setError(err.message || "Failed to start streaming");
      await stopRecording(); // best-effort cleanup
    }
  };

  /** === Stop Recording (Close streaming + finalize blob) === */
  const stopRecording = async () => {
    setIsRecording(false);
    setIsProcessing(true);

    try {
      // Graceful terminate AAI session
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "Terminate" }));
        wsRef.current.close();
      }

      // Tear down WebAudio graph
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioCtxRef.current) await audioCtxRef.current.close();

      // Close MediaRecorder and persist final blob via your existing API
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") {
        await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); });
      }

      if (!sessionRef.current) throw new Error("Session not initialized");

      // Upload and finalize (your existing finalize path)
      if (audioChunks.current.length > 0) {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        const fd = new FormData();
        fd.append("file", blob, "final.webm");

        const uploadRes = await fetch(
          `http://127.0.0.1:8000/session/${sessionRef.current}/chunk`,
          { method: "POST", body: fd }
        );
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.detail || "Failed to upload audio chunk");
        }

        const finalizeRes = await fetch(
          `http://127.0.0.1:8000/session/${sessionRef.current}/finalize`,
          { method: "POST" }
        );
        if (!finalizeRes.ok) {
          const err = await finalizeRes.json();
          throw new Error(err.detail || "Transcription failed");
        }

        const data = await finalizeRes.json();
        setFinalTranscript(data.final || "Transcription incomplete.");
        setAudioUrl(URL.createObjectURL(blob));
      }
    } catch (err: any) {
      setError(err.message || "Failed to stop streaming");
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
                <span className="font-semibold text-red-600 dark:text-red-400">
                  3 minutes
                </span>
                . If you pause for too long, you’ll automatically receive topic
                suggestions to keep the monologue flowing.
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
              <button
                disabled
                className="px-8 py-3 bg-gray-500 text-white rounded-full shadow"
              >
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
