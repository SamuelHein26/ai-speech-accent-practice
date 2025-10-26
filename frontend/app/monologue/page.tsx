"use client";

import Header from "../components/Header";
import { useCallback, useEffect, useRef, useState } from "react";
import LiveWaveform from "../components/LiveWaveform";

/** ---- API response types (strict typing; no any) ---- */
type StartSessionResponse = { session_id: string; is_guest: boolean };
type FinalizeResponse = { final: string; filler_word_count: number; audio_url?: string };
type TopicResponse = { topics: string[] };

/** ---- AudioContext factory (WebAudio init w/ SR cfg) ---- */
function createAudioContext(desiredSampleRate = 48000): AudioContext {
  // Browser vendor prefix fallback
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };

  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio API not supported");

  // Try parameterized ctor first (some UA accept sampleRate opt)
  try {
    return new Ctor({ sampleRate: desiredSampleRate } as AudioContextOptions);
  } catch {
    // Fallback default ctor (older UA reject options)
    return new Ctor();
  }
}

/** ---- Base URL derivation (avoids trailing slash) ---- */
const RAW_API_BASE =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://127.0.0.1:8000";

const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

/** ---- Suggestion trigger silence threshold (ms) ---- */
const SUGGESTION_SILENCE_MS = 6_000;

/** ---- WS URL builder (wss:// in prod https ctx) ---- */
const wsURL = (): string => {
  try {
    const u = new URL(API_BASE);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/ws/stream";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    const isHttps =
      typeof window !== "undefined" &&
      window.location.protocol === "https:";
    return `${isHttps ? "wss" : "ws"}://${
      window.location.host
    }/ws/stream`;
  }
};

export default function MonologuePage() {
  /** === UI/UX state === */
  const [mounted, setMounted] = useState(false); // CSR guard for hydration mismatch (SSR vs client)
  const [isRecording, setIsRecording] = useState(false); // mic capture active flag
  const [isProcessing, setIsProcessing] = useState(false); // post-stop finalize in-flight
  const [finalTranscript, setFinalTranscript] = useState(""); // final ASR text
  const [fillerWordCount, setFillerWordCount] = useState<number | null>(null); // filler words detected
  const [audioUrl, setAudioUrl] = useState<string | null>(null); // blob playback URL
  const [error, setError] = useState<string | null>(null); // fatal UX err surfacing
  const [suggestions, setSuggestions] = useState<string[]>([]); // topic prompt list
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false); // suggestions fetch in-flight
  const [suggestionError, setSuggestionError] = useState<string | null>(null); // suggestions subsystem err
  const [lastSuggestionSource, setLastSuggestionSource] = useState<
    "auto" | "manual" | null
  >(null); // UX copy state (auto-surface vs manual refresh CTA)

  /** ---- Streaming transcript state (LLM/ASR incremental buffer mgmt) ---- */
  const [liveCommitted, setLiveCommitted] = useState(""); // committed finalized turns
  const [livePartial, setLivePartial] = useState(""); // current interim/partial hypothesis

  /** ---- Derived display string for live transcript panel ---- */
  const displayText = [liveCommitted, livePartial]
    .filter(Boolean)
    .join(" ");
  const suggestionLeadSeconds = Math.round(
    SUGGESTION_SILENCE_MS / 1000
  );

  /** === Session / Media refs (mutable, not reactive) === */
  const sessionRef = useRef<string | null>(null); // backend sess ID (guest/user)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null); // browser MediaRecorder handle
  const audioChunks = useRef<Blob[]>([]); // captured audio chunks for upload/finalize

  /** === Live stream refs (WebSocket + WebAudio graph) === */
  const wsRef = useRef<WebSocket | null>(null); // WS handle -> FastAPI stream proxy
  const audioCtxRef = useRef<AudioContext | null>(null); // AudioContext handle
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null); // mic source node
  const processorRef = useRef<ScriptProcessorNode | null>(null); // ScriptProcessorNode for PCM pull
  const lastSpeechAtRef = useRef<number>(Date.now()); // epoch ms of last user speech activity
  const suggestionCooldownRef = useRef(false); // cooldown mutex to avoid spam suggestion req

  /** === Dedup guards for transcript reconciliation === */
  const lastFinalRef = useRef<string>(""); // last final segment pushed
  const lastPartialRef = useRef<string>(""); // last partial segment pushed

  /** === Mount bootstrap / teardown (lifecycle hook) === */
  useEffect(() => {
    setMounted(true);

    // restore guest session from sessionStorage (sticky anon session)
    const existing = sessionStorage.getItem("guest_session_id");
    if (existing) sessionRef.current = existing;

    // graceful teardown (WS, WebAudio graph, MediaRecorder) on unmount
    return () => {
      try {
        if (
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          wsRef.current.send(
            JSON.stringify({ type: "Terminate" })
          );
          wsRef.current.close();
        }
      } catch {
        /* no-op */
      }

      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }

      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") {
        mr.stop();
      }
    };
  }, []);

  /** === Activity register: called whenever we get new speech tokens via RT-STT === */
  const registerSpeechActivity = useCallback(() => {
    lastSpeechAtRef.current = Date.now();
    suggestionCooldownRef.current = false;
    // clear suggestion "stale" error state once user starts talking again
    setSuggestionError((prev) => (prev ? null : prev));
    // reset "auto" source hint if last ones were auto
    setLastSuggestionSource((prev) =>
      prev === "auto" ? null : prev
    );
  }, []);

  /** === Topic suggestion pipeline (manual / auto trigger) === */
  const requestSuggestions = useCallback(
    async (source: "auto" | "manual") => {
      const transcriptSnapshot = [liveCommitted, livePartial]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!transcriptSnapshot) {
        // Edge case: user spam-clicks "New ideas" before saying anything
        if (source === "manual") {
          setSuggestionError(
            "Speak for a few seconds so we can tailor fresh topics."
          );
        }
        return;
      }

      // prevent multiple parallel req (rate-limit UX)
      suggestionCooldownRef.current = true;
      setIsFetchingSuggestions(true);
      setSuggestionError(null);

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;

        const response = await fetch(
          `${API_BASE}/topics/generate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token
                ? { Authorization: `Bearer ${token}` }
                : {}),
            },
            body: JSON.stringify({
              transcript: transcriptSnapshot,
            }),
          }
        );

        if (!response.ok) {
          let detail: string | undefined;
          try {
            const err = (await response.json()) as {
              detail?: string;
            };
            detail = err.detail;
          } catch {
            detail = undefined;
          }
          throw new Error(
            detail || "Failed to fetch topic suggestions"
          );
        }

        const data: TopicResponse = await response.json();
        if (
          !Array.isArray(data.topics) ||
          data.topics.length === 0
        ) {
          setSuggestions([]);
          setSuggestionError(
            "No fresh ideas were generated. Try again soon."
          );
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

  /** === Auto-surface suggestions after silence (SIL threshold FSM) === */
  useEffect(() => {
    if (!isRecording) return;

    lastSpeechAtRef.current = Date.now();

    const interval = window.setInterval(() => {
      const elapsed =
        Date.now() - lastSpeechAtRef.current;
      const pastThreshold =
        elapsed >= SUGGESTION_SILENCE_MS;
      if (
        pastThreshold &&
        !suggestionCooldownRef.current &&
        !isFetchingSuggestions
      ) {
        void requestSuggestions("auto");
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    isRecording,
    isFetchingSuggestions,
    requestSuggestions,
  ]);

  /** === PCM conversion utils (Float32 -> Int16LE, resample to 16kHz mono) === */
  // Float32 [-1.0..1.0] → Int16 LE PCM
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

  // Downsample arbitrary SR -> 16kHz mono Int16
  const downsampleTo16k = (
    buffer: Float32Array,
    inputRate: number
  ): Int16Array => {
    const targetRate = 16000;
    if (inputRate === targetRate)
      return floatTo16BitPCM(buffer);

    const ratio = inputRate / targetRate;
    const newLen = Math.round(buffer.length / ratio);
    const down = new Float32Array(newLen);

    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < newLen) {
      const nextOffsetBuffer = Math.round(
        (offsetResult + 1) * ratio
      );
      let accum = 0;
      let count = 0;
      for (
        let i = offsetBuffer;
        i < nextOffsetBuffer && i < buffer.length;
        i++
      ) {
        accum += buffer[i];
        count++;
      }
      down[offsetResult] = accum / (count || 1);
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return floatTo16BitPCM(down);
  };

  /** === startRecording: boot session, mic capture, WS RTP-like uplink === */
  const startRecording = async (): Promise<void> => {
    // reset UI/UX state for fresh session
    setError(null);
    setFinalTranscript("");
    setFillerWordCount(null);
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
      // 1. obtain/ensure server session for DB persistence
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;

      const startRes = await fetch(`${API_BASE}/session/start`, {
        method: "POST",
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {},
      });
      if (!startRes.ok) {
        const err = (await startRes.json()) as {
          detail?: string;
        };
        throw new Error(
          err.detail || "Failed to start session"
        );
      }
      const startData: StartSessionResponse =
        await startRes.json();
      sessionRef.current = startData.session_id;
      sessionStorage.setItem(
        "guest_session_id",
        startData.session_id
      );

      // 2. acquire mic (MediaStream)
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            noiseSuppression: true,
            echoCancellation: true,
          },
        });

      // 3. init MediaRecorder for local final blob archival
      const mr = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mr;
      audioChunks.current = [];
      mr.ondataavailable = (evt: BlobEvent) => {
        if (evt.data.size > 0)
          audioChunks.current.push(evt.data);
      };
      mr.start();

      // 4. WS open -> wire up ScriptProcessorNode pump
      const url = wsURL();
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer"; // raw PCM frames → backend
      wsRef.current = ws;

      ws.onopen = () => {
        // build WebAudio graph (mic -> processor -> PCM frame send)
        const audioCtx = createAudioContext(48000);
        audioCtxRef.current = audioCtx;

        const source =
          audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;

        const processor =
          audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        // silentGain sink avoids feedback loop (no monitor)
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;

        processor.onaudioprocess = (e) => {
          const input =
            e.inputBuffer.getChannelData(0);
          const int16 = downsampleTo16k(
            input,
            audioCtx.sampleRate
          );
          if (
            ws.readyState === WebSocket.OPEN
          ) {
            ws.send(int16.buffer);
          }
        };

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioCtx.destination);
      };

      // 5. WS downstream messages for partial/final ASR tokens
      ws.onmessage = (
        event: MessageEvent<
          string | ArrayBufferLike | Blob
        >
      ) => {
        if (typeof event.data !== "string") return;
        try {
          const msg = JSON.parse(
            event.data as string
          ) as Record<string, unknown>;
          const t = msg["type"];

          // control frames from backend
          if (t === "Begin") {
            return;
          }

          // incremental transcript frame
          if (t === "Turn") {
            const text = String(
              msg["transcript"] || ""
            ).trim();
            const isFinal = Boolean(
              msg["turn_is_formatted"] ||
                msg["is_final"]
            );

            if (!text) return;

            // mark activity for silence-timer logic
            registerSpeechActivity();

            if (isFinal) {
              // append only if new final
              if (text !== lastFinalRef.current) {
                setLiveCommitted((prev) =>
                  prev
                    ? prev + " " + text
                    : text
                );
                lastFinalRef.current = text;
              }
              // reset partial buffer
              setLivePartial("");
              lastPartialRef.current = "";
            } else {
              // update partial only on change
              if (
                text !== lastPartialRef.current
              ) {
                setLivePartial(text);
                lastPartialRef.current = text;
              }
            }
          }
        } catch {
          // ignore heartbeat / malformed frames
        }
      };

      ws.onerror = () =>
        setError("Streaming connection error");
      ws.onclose = () => {
        /* WS closed -> handled in stopRecording */
      };

      setIsRecording(true);
    } catch (e: unknown) {
      // fatal init err path
      const msg =
        e instanceof Error
          ? e.message
          : "Failed to start streaming";
      setError(msg);

      // best-effort cleanup (idempotent)
      await stopRecording();
    }
  };

  /** === stopRecording: tear down WS/Audio graph, upload blob, finalize ASR === */
  const stopRecording = async (): Promise<void> => {
    setIsRecording(false);
    setIsProcessing(true);

    try {
      // A. graceful WS shutdown
      if (
        wsRef.current &&
        wsRef.current.readyState ===
          WebSocket.OPEN
      ) {
        try {
          wsRef.current.send(
            JSON.stringify({ type: "Terminate" })
          );
        } catch {
          /* no-op */
        }
        wsRef.current.close();
      }

      // B. destroy WebAudio nodes + ctx
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        await audioCtxRef.current.close();
      }

      // C. stop MediaRecorder and await onstop flush
      const mr = mediaRecorderRef.current;
      if (
        mr &&
        mr.state !== "inactive"
      ) {
        await new Promise<void>((resolve) => {
          mr.onstop = () => resolve();
          mr.stop();
        });
      }

      // D. send final blob → backend finalize pipeline
      if (!sessionRef.current)
        throw new Error(
          "Session not initialized"
        );

      if (audioChunks.current.length > 0) {
        const blob = new Blob(
          audioChunks.current,
          { type: "audio/webm" }
        );

        const fd = new FormData();
        fd.append("file", blob, "final.webm");

        // upload chunk(s)
        const uploadRes = await fetch(
          `${API_BASE}/session/${sessionRef.current}/chunk`,
          {
            method: "POST",
            body: fd,
          }
        );
        if (!uploadRes.ok) {
          const err = (await uploadRes.json()) as {
            detail?: string;
          };
          throw new Error(
            err.detail ||
              "Failed to upload audio chunk"
          );
        }

        // finalize
        const finalizeRes = await fetch(
          `${API_BASE}/session/${sessionRef.current}/finalize`,
          {
            method: "POST",
          }
        );
        if (!finalizeRes.ok) {
          const err = (await finalizeRes.json()) as {
            detail?: string;
          };
          throw new Error(
            err.detail ||
              "Transcription failed"
          );
        }

        const data: FinalizeResponse =
          await finalizeRes.json();
        setFinalTranscript(
          data.final ||
            "Transcription incomplete."
        );
        setFillerWordCount(data.filler_word_count ?? null);
        setAudioUrl(
          data.audio_url ||
            URL.createObjectURL(blob)
        );
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Failed to stop streaming";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  /** === JSX === */
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
      {/* Global header/nav (top bar) */}
      <Header />

      {/* SSR safety gate */}
      {!mounted ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 dark:text-gray-300">
            Loading...
          </p>
        </div>
      ) : (
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col">
          {/* Hero / Intro copy (hidden when actively recording to reduce clutter) */}
          {!isRecording && (
            <section className="text-center mb-10">
              <h2 className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Monologue Mode
              </h2>
              <p className="mx-auto max-w-2xl text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                Practice your speaking fluency for up to{" "}
                <span className="font-semibold text-red-600 dark:text-red-400">
                  3 minutes
                </span>
                . If you pause for too long, you’ll
                automatically receive topic
                suggestions to keep the monologue
                flowing.
              </p>
            </section>
          )}

          {/* Control strip (Start/Stop/Processing) + waveform */}
          <section className="flex flex-col items-center mb-8">
            {/* CTA controls */}
            <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
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

            {/* Live waveform visualization (VU meter style) */}
            {isRecording && (
              <div className="w-full max-w-xl">
                <LiveWaveform
                  isRecording={isRecording}
                />
              </div>
            )}
          </section>

          {/* === Responsive main grid: Live Transcript | Topic Suggestions ===
               lg+: 2-col split view
               <lg: stacked with gap
          */}
          {(isRecording ||
            suggestions.length > 0 ||
            isFetchingSuggestions ||
            suggestionError) && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full mb-10">
              {/* --- Live Transcript panel (col 1) --- */}
              <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold">
                    Live Transcript
                  </h3>
                  {isRecording && (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full">
                      Recording…
                    </span>
                  )}
                </div>

                <p className="min-h-[140px] whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed text-base">
                  {displayText ||
                    "Listening... start speaking."}
                </p>
              </div>

              {/* --- Topic Suggestions panel (col 2) --- */}
              <div className="bg-slate-50 dark:bg-slate-900/60 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">
                    Topic Suggestions
                  </h3>

                  <button
                    type="button"
                    onClick={() => {
                      void requestSuggestions(
                        "manual"
                      );
                    }}
                    disabled={
                      !isRecording ||
                      isFetchingSuggestions
                    }
                    className="px-4 py-2 rounded-full text-sm font-medium bg-red-500 text-white shadow hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetchingSuggestions
                      ? "Generating..."
                      : "New ideas"}
                  </button>
                </div>

                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  We&apos;ll surface prompts
                  automatically after about{" "}
                  {suggestionLeadSeconds} seconds of
                  silence.
                </p>

                {isFetchingSuggestions && (
                  <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                    Listening to your last
                    thoughts and preparing fresh
                    prompts...
                  </p>
                )}

                {suggestionError && (
                  <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                    {suggestionError}
                  </p>
                )}

                {!isFetchingSuggestions &&
                  !suggestionError &&
                  suggestions.length === 0 && (
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                      Keep the monologue flowing.
                      Pause too long and
                      we&apos;ll jump in with
                      inspiration, or tap
                      &quot;New ideas&quot;
                      anytime.
                    </p>
                  )}

                {suggestions.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {suggestions.map(
                      (topic, index) => (
                        <li
                          key={`${topic}-${index}`}
                          className="flex items-start gap-3 rounded-2xl bg-white dark:bg-gray-800/80 px-4 py-3 shadow-sm border border-slate-200 dark:border-slate-700"
                        >
                          <span className="mt-0.5 text-sm font-semibold text-red-500 dark:text-red-400">
                            {index + 1}.
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {topic}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                )}

                {lastSuggestionSource ===
                  "auto" &&
                  suggestions.length > 0 && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      We noticed a pause and added
                      these prompts to help you keep
                      going.
                    </p>
                  )}

                {lastSuggestionSource ===
                  "manual" &&
                  suggestions.length > 0 && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Need something new? Feel free
                      to refresh ideas whenever you
                      like.
                    </p>
                  )}
              </div>
            </section>
          )}

          {/* Error alert (UX fail-fast surfacing) */}
          {error && (
            <section className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 p-4 rounded-xl shadow mb-8 border border-red-300/60 dark:border-red-700/60">
              <p className="font-semibold">
                Error:
              </p>
              <p className="text-sm leading-relaxed">
                {error}
              </p>
            </section>
          )}

          {/* Final transcript (post-session ASR result) */}
          {finalTranscript && (
            <section className="w-full bg-green-50 dark:bg-green-900/40 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6 mb-8 border border-green-300/50 dark:border-green-800/50">
              <h3 className="text-lg font-semibold mb-2">
                Final Transcript
              </h3>
              {fillerWordCount !== null && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  Filler words detected: <span className="font-semibold">{fillerWordCount}</span>
                </p>
              )}
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                {finalTranscript}
              </p>
            </section>
          )}

          {/* Playback (audio element for review QA) */}
          {audioUrl && (
            <section className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold mb-2">
                Playback
              </h3>
              <audio
                controls
                src={audioUrl}
                className="w-full mt-2"
              />
            </section>
          )}
        </main>
      )}
    </div>
  );
}
