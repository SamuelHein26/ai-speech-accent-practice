"use client";
import Header from "../components/Header";
import { useState, useRef, useEffect } from "react";
import LiveWaveform from "../components/LiveWaveform";

/**
 * MonologuePage — Realtime Speech Capture with Streaming Transcription + Topic Suggestion
 * 
 * Maintains original layout and behavior.
 * Adds live transcript box and topic suggestion bubbles appearing during recording only.
 */
export default function MonologuePage() {
  /** === State Management === */
  const [mounted, setMounted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [liveTranscript, setLiveTranscript] = useState(""); // live stream transcript

  /** === Refs for Recording Session === */
  const sessionRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  /** === Mount Effect === */
  useEffect(() => {
    setMounted(true);
    const existing = sessionStorage.getItem("guest_session_id");
    if (existing) {
      sessionRef.current = existing;
      console.log("Resumed guest session:", existing);
    }
  }, []);

  /** === Silence Detection Config === */
  const silenceThreshold = 0.01; // sensitivity control
  const silenceDuration = 3000; // 3 seconds of silence triggers topic suggestion

  /** === Trigger Topic Suggestion from Backend === */
  const triggerTopicSuggestions = async () => {
    if (!liveTranscript) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/topics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(liveTranscript),
      });
      if (!res.ok) throw new Error("Failed to generate topics");
      const data = await res.json();
      setSuggestedTopics(data.topics || []);
    } catch (err) {
      console.error("Topic suggestion error:", err);
    }
  };

  /** === Start Recording === */
  const startRecording = async () => {
    setError(null);
    setFinalTranscript("");
    setLiveTranscript("");
    setSuggestedTopics([]);

    try {
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
      console.log("Started new session:", data.session_id);

      // === Setup Microphone Stream ===
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;

      audioChunks.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      mr.start();

      // === Setup AssemblyAI Streaming via FastAPI WS ===
      const ws = new WebSocket("ws://127.0.0.1:8000/ws/stream", "json");
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.text) setLiveTranscript((prev) => prev + " " + msg.text);
        } catch {
          console.warn("Non-JSON WS frame:", event.data);
        }
      };


      ws.onerror = () => setError("Streaming connection error");
      ws.onclose = () => console.log("Streaming connection closed");

      // === Audio Streaming Setup ===
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const toBase64 = (buf: ArrayBufferLike): string => {
        const arrayBuffer = buf instanceof ArrayBuffer ? buf : new ArrayBuffer(buf.byteLength);
        const view = new Uint8Array(arrayBuffer);
        if (!(buf instanceof ArrayBuffer)) view.set(new Uint8Array(buf));

        let binary = "";
        const len = view.byteLength;
        for (let i = 0; i < len; i++) binary += String.fromCharCode(view[i]);
        return btoa(binary);
      };

      const downsampleBuffer = (buffer: Float32Array, inputRate: number): Int16Array => {
        const ratio = inputRate / 16000;
        const newLen = Math.round(buffer.length / ratio);
        const result = new Int16Array(newLen);
        let offset = 0;
        while (offset < newLen) {
          const next = Math.round((offset + 1) * ratio);
          let accum = 0,
            count = 0;
          for (let i = offset * ratio; i < next && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
          }
          result[offset] = Math.max(-1, Math.min(1, accum / count)) * 0x7fff;
          offset++;
        }
        return result;
      };

      const analyser = audioCtx.createAnalyser();
      source.connect(analyser);

      const detectSilence = () => {
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        const amplitude =
          data.reduce((sum, val) => sum + Math.abs(val - 128), 0) / data.length;

        if (amplitude < silenceThreshold * 128) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              console.log("Silence detected → topic suggestion triggered");
              triggerTopicSuggestions();
              silenceTimerRef.current = null;
            }, silenceDuration);
          }
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (suggestedTopics.length > 0) setSuggestedTopics([]);
        }
        requestAnimationFrame(detectSilence);
      };
      detectSilence();

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = downsampleBuffer(input, audioCtx.sampleRate);
        const payload = { audio_data: toBase64(pcm16.buffer) };
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsRecording(true);
    } catch (err: any) {
      console.error("Recording error:", err);
      setError(err.message);
    }
  };

  /** === Stop Recording === */
  const stopRecording = async () => {
    setIsRecording(false);
    setIsProcessing(true);

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ terminate_session: true }));
        wsRef.current.close();
      }
      if (processorRef.current) processorRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioCtxRef.current) await audioCtxRef.current.close();

      const mr = mediaRecorderRef.current;
      if (mr) mr.stop();

      await new Promise<void>((resolve) => {
        if (mr) mr.onstop = () => resolve();
        else resolve();
      });

      if (!sessionRef.current) throw new Error("Session not initialized");

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
    } catch (err: any) {
      console.error("Stop recording error:", err);
      setError(err.message);
      setFinalTranscript("Transcription failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  /** === Remove topics once user speaks one === */
  useEffect(() => {
    if (!liveTranscript || suggestedTopics.length === 0) return;
    const spoken = suggestedTopics.find((topic) =>
      liveTranscript.toLowerCase().includes(topic.toLowerCase())
    );
    if (spoken) {
      console.log(`User mentioned suggested topic: ${spoken}`);
      setSuggestedTopics([]);
    }
  }, [liveTranscript, suggestedTopics]);

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

          {/* === Start/Stop Buttons === */}
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

          {isRecording && <LiveWaveform isRecording={isRecording} />}

          {/* === Live Transcript + Topic Suggestions (only when recording) === */}
          {isRecording && (
            <div className="w-full max-w-2xl mt-6 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6">
              <h3 className="text-lg font-semibold mb-2">
                Live Transcript
              </h3>
              <p className="min-h-[120px] whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {liveTranscript || "Listening... start speaking."}
              </p>

              {suggestedTopics.length > 0 && (
                <div className="mt-4 bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-xl">
                  <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
                    Need inspiration? Try one of these:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTopics.map((topic, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-2 bg-yellow-500 text-white rounded-full text-sm hover:bg-yellow-600 cursor-pointer"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === Error Box === */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 p-4 rounded-xl shadow mb-6 max-w-2xl">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}

          {/* === Final Transcript === */}
          {finalTranscript && (
            <div className="w-full max-w-2xl bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6 mb-6">
              <h3 className="text-lg font-semibold mb-2">Final Transcript</h3>
              <p className="whitespace-pre-line">{finalTranscript}</p>
            </div>
          )}

          {audioUrl && !isRecording && !isProcessing && (
            <div
              className="w-full max-w-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6 transition-opacity duration-500 ease-in-out opacity-100"
            >
              <h3 className="text-lg font-semibold mb-2">Playback</h3>
              <audio controls src={audioUrl} className="w-full mt-2"></audio>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
