"use client";

import Header from "../components/Header";
import { useCallback, useEffect, useRef, useState } from "react";
import LiveWaveform from "../components/LiveWaveform";

// ---- API response types (strict typing; no any) ----
type StartSessionResponse = { session_id: string; is_guest: boolean };
type FinalizeResponse = { final: string; audio_url?: string };
type TopicResponse = { topics: string[] };

function createAudioContext(desiredSampleRate = 48000): AudioContext {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };

  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio API not supported");

  // Try with options first
  try {
    return new Ctor({ sampleRate: desiredSampleRate } as AudioContextOptions);
  } catch {
    // Fall back to default constructor (some browsers reject options)
    return new Ctor();
  }
}

// ---- Helpers: build base API + WS URLs safely ----
const RAW_API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://127.0.0.1:8000";

const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

const SUGGESTION_SILENCE_MS = 6_000;

const wsURL = (): string => {
  try {
    const u = new URL(API_BASE);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/ws/stream"; // no trailing slash
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    const isHttps =
      typeof window !== "undefined" && window.location.protocol === "https:";
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [lastSuggestionSource, setLastSuggestionSource] = useState<"auto" | "manual" | null>(null);

  // Live render text: committed final turns + replaceable partial
  const [liveCommitted, setLiveCommitted] = useState("");
  const [livePartial, setLivePartial] = useState("");

  // Display text assembled from committed + partial
  const displayText = [liveCommitted, livePartial].filter(Boolean).join(" ");
  const suggestionLeadSeconds = Math.round(SUGGESTION_SILENCE_MS / 1000);

  /** === Session & Media Refs === */
  const sessionRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  /** === Streaming Refs (WS + WebAudio) === */
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const lastSpeechAtRef = useRef<number>(Date.now());
  const suggestionCooldownRef = useRef(false);

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

  const registerSpeechActivity = useCallback(() => {
    lastSpeechAtRef.current = Date.now();
    suggestionCooldownRef.current = false;
    setSuggestionError((prev) => (prev ? null : prev));
    setLastSuggestionSource((prev) => (prev === "auto" ? null : prev));
  }, []);

  const requestSuggestions = useCallback(
    async (source: "auto" | "manual") => {
      const transcriptSnapshot = [liveCommitted, livePartial]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!transcriptSnapshot) {
        if (source === "manual") {
          setSuggestionError(
            "Speak for a few seconds so we can tailor fresh topics."
          );
        }
        return;
      }

      suggestionCooldownRef.current = true;
      setIsFetchingSuggestions(true);
      setSuggestionError(null);

      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        const response = await fetch(`${API_BASE}/topics/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ transcript: transcriptSnapshot }),
        });

        if (!response.ok) {
          let detail: string | undefined;
          try {
            const err = (await response.json()) as { detail?: string };
            detail = err.detail;
          } catch {
            detail = undefined;
          }
          throw new Error(detail || "Failed to fetch topic suggestions");
        }

        const data: TopicResponse = await response.json();
        if (!Array.isArray(data.topics) || data.topics.length === 0) {
          setSuggestions([]);
          setSuggestionError("No fresh ideas were generated. Try again soon.");
          setLastSuggestionSource(null);
        } else {
          setSuggestions(data.topics);
          setLastSuggestionSource(source);
        }
      } catch (e: unknown) {
        const message =
          e instanceof Error
            ? e.message
            : "Unable to generate new topics right now.";
        setSuggestionError(message);
        suggestionCooldownRef.current = false;
      } finally {
        setIsFetchingSuggestions(false);
      }
    },
    [liveCommitted, livePartial]
  );

  useEffect(() => {
    if (!isRecording) return;

    lastSpeechAtRef.current = Date.now();

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - lastSpeechAtRef.current;
      if (
        elapsed >= SUGGESTION_SILENCE_MS &&
        !suggestionCooldownRef.current &&
        !isFetchingSuggestions
      ) {
        void requestSuggestions("auto");
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRecording, isFetchingSuggestions, requestSuggestions]);

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
    setSuggestions([]);
    setIsFetchingSuggestions(false);
    setSuggestionError(null);
    setLastSuggestionSource(null);
    suggestionCooldownRef.current = false;
    lastSpeechAtRef.current = Date.now();

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
        const audioCtx = createAudioContext(48000);
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        // 🔇 Silent sink so onaudioprocess runs without echo
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;

        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const int16 = downsampleTo16k(input, audioCtx.sampleRate);
          if (ws.readyState === WebSocket.OPEN) ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioCtx.destination);
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

            registerSpeechActivity();

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

          {(isRecording || suggestions.length > 0 || isFetchingSuggestions || suggestionError) && (
            <div className="w-full max-w-2xl mt-6 bg-slate-50 dark:bg-slate-900/60 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Topic Suggestions</h3>
                <button
                  type="button"
                  onClick={() => {
                    void requestSuggestions("manual");
                  }}
                  disabled={!isRecording || isFetchingSuggestions}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-red-500 text-white shadow hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFetchingSuggestions ? "Generating..." : "New ideas"}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                We&apos;ll surface prompts automatically after about {suggestionLeadSeconds} seconds of silence.
              </p>

              {isFetchingSuggestions && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                  Listening to your last thoughts and preparing fresh prompts...
                </p>
              )}

              {suggestionError && (
                <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                  {suggestionError}
                </p>
              )}

              {!isFetchingSuggestions && !suggestionError && suggestions.length === 0 && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                  Keep the monologue flowing. Pause too long and we&apos;ll jump in with inspiration, or tap &quot;New ideas&quot; anytime.
                </p>
              )}

              {suggestions.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {suggestions.map((topic, index) => (
                    <li
                      key={`${topic}-${index}`}
                      className="flex items-start gap-3 rounded-2xl bg-white dark:bg-gray-800/80 px-4 py-3 shadow-sm border border-slate-200 dark:border-slate-700"
                    >
                      <span className="mt-0.5 text-sm font-semibold text-red-500 dark:text-red-400">
                        {index + 1}.
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{topic}</span>
                    </li>
                  ))}
                </ul>
              )}

              {lastSuggestionSource === "auto" && suggestions.length > 0 && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  We noticed a pause and added these prompts to help you keep going.
                </p>
              )}

              {lastSuggestionSource === "manual" && suggestions.length > 0 && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Need something new? Feel free to refresh ideas whenever you like.
                </p>
              )}
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
