"use client";

import Header from "../components/Header";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import LiveWaveform from "../components/LiveWaveform";

type StartSessionResponse = { session_id: string; is_guest: boolean };
type FinalizeResponse = { final: string; filler_word_count: number; audio_url?: string };
type TopicResponse = { topics: string[] };
type FeedbackResponse = { feedback: string };

function createAudioContext(desiredSampleRate = 48000): AudioContext {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };

  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio API not supported");
  try {
    return new Ctor({ sampleRate: desiredSampleRate } as AudioContextOptions);
  } catch {
    return new Ctor();
  }
}

const RAW_API_BASE =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://127.0.0.1:8000";

const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

const resolveApiUrl = (path: string): string => {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
};

const SUGGESTION_SILENCE_MS = 6_000;

const MAX_RECORDING_SECONDS = 180;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const FILLER_PHRASES = [
  "um",
  "uh",
  "erm",
  "hmm",
  "like",
  "so",
  "actually",
  "basically",
  "literally",
  "you know",
  "i mean",
  "kind of",
  "sort of",
] as const;

const fillerRegex = new RegExp(
  `\\b(${FILLER_PHRASES.map((phrase) =>
    escapeRegex(phrase).replace(/\\s+/g, "\\\\s+")
  ).join("|")})\\b`,
  "gi"
);

const highlightFillerWords = (text: string): ReactNode[] => {
  if (!text) return [];

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  fillerRegex.lastIndex = 0;

  const pushText = (segment: string) => {
    if (!segment) return;
    const parts = segment.split("\n");
    parts.forEach((part, index) => {
      nodes.push(<Fragment key={`text-${key++}`}>{part}</Fragment>);
      if (index < parts.length - 1) {
        nodes.push(<br key={`br-${key++}`} />);
      }
    });
  };

  while ((match = fillerRegex.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      pushText(text.slice(lastIndex, start));
    }

    const matched = match[0];
    nodes.push(
      <mark
        key={`filler-${key++}`}
        className="rounded bg-yellow-200 px-1 text-gray-900 dark:bg-yellow-500/60 dark:text-gray-900"
      >
        {matched}
      </mark>
    );
    lastIndex = start + matched.length;
  }

  if (lastIndex < text.length) {
    pushText(text.slice(lastIndex));
  }

  if (nodes.length === 0) {
    return [text];
  }

  return nodes;
};

const formatClock = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

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
  const [mounted, setMounted] = useState(false);
  const [isRecording, setIsRecording] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false); 
  const [finalTranscript, setFinalTranscript] = useState(""); 
  const [fillerWordCount, setFillerWordCount] = useState<number | null>(null); 
  const [audioUrl, setAudioUrl] = useState<string | null>(null); 
  const [error, setError] = useState<string | null>(null); 
  const [suggestions, setSuggestions] = useState<string[]>([]); 
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null); 
  const [lastSuggestionSource, setLastSuggestionSource] = useState<
    "auto" | "manual" | null
  >(null); 
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(false); 
  const [feedbackError, setFeedbackError] = useState<string | null>(null); 
  const [elapsedSeconds, setElapsedSeconds] = useState(0); 
  const [timeLimitReached, setTimeLimitReached] = useState(false); 

  const [liveCommitted, setLiveCommitted] = useState(""); 
  const [livePartial, setLivePartial] = useState(""); 

  const displayText = [liveCommitted, livePartial]
    .filter(Boolean)
    .join(" ");
  const suggestionLeadSeconds = Math.round(
    SUGGESTION_SILENCE_MS / 1000
  );
  const clampedElapsed = Math.min(elapsedSeconds, MAX_RECORDING_SECONDS);
  const remainingSeconds = Math.max(0, MAX_RECORDING_SECONDS - clampedElapsed);
  const formattedElapsed = formatClock(clampedElapsed);
  const formattedRemaining = formatClock(remainingSeconds);
  const isNearLimit = remainingSeconds <= 10 && isRecording;
  const showInteractivePanels = isRecording || isProcessing;

  const sessionRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null); 
  const audioChunks = useRef<Blob[]>([]); 
  const audioUrlRef = useRef<string | null>(null);
  const timerIdRef = useRef<number | null>(null); 
  const timerStartRef = useRef<number | null>(null); 
  const timeLimitTriggeredRef = useRef(false); 

  const clearRecordingTimer = useCallback(() => {
    if (timerIdRef.current !== null) {
      window.clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
  }, []);

  const wsRef = useRef<WebSocket | null>(null); 
  const audioCtxRef = useRef<AudioContext | null>(null); 
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null); 
  const lastSpeechAtRef = useRef<number>(Date.now()); 
  const suggestionCooldownRef = useRef(false); 

  const lastFinalRef = useRef<string>(""); 
  const lastPartialRef = useRef<string>(""); 

  useEffect(() => {
    setMounted(true);

    const existing = sessionStorage.getItem("guest_session_id");
    if (existing) sessionRef.current = existing;

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

      clearRecordingTimer();
      timerStartRef.current = null;

      const url = audioUrlRef.current;
      if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    };
  }, [clearRecordingTimer]);

  const applyAudioUrl = useCallback(
    (
      nextUrl: string | null,
      options: { revokePrevious?: boolean } = {}
    ) => {
      const { revokePrevious = false } = options;
      setAudioUrl((prev) => {
        if (
          revokePrevious &&
          prev &&
          prev.startsWith("blob:") &&
          prev !== nextUrl
        ) {
          URL.revokeObjectURL(prev);
        }
        audioUrlRef.current = nextUrl;
        return nextUrl;
      });
    },
    []
  );

  const registerSpeechActivity = useCallback(() => {
    lastSpeechAtRef.current = Date.now();
    suggestionCooldownRef.current = false;
    setSuggestionError((prev) => (prev ? null : prev));
    setLastSuggestionSource((prev) =>
      prev === "auto" ? null : prev
    );
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

  const requestFeedback = useCallback(async (transcript: string) => {
    const payload = transcript.trim();
    if (!payload) {
      setFeedback(null);
      setFeedbackError(null);
      return;
    }

    setIsFetchingFeedback(true);
    setFeedback(null);
    setFeedbackError(null);

    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const response = await fetch(`${API_BASE}/feedback/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ transcript: payload }),
      });

      if (!response.ok) {
        let detail: string | undefined;
        try {
          const err = (await response.json()) as { detail?: string };
          detail = err.detail;
        } catch {
          detail = undefined;
        }
        throw new Error(detail || "Failed to generate AI feedback");
      }

      const data: FeedbackResponse = await response.json();
      const message = data.feedback?.trim();
      if (!message) {
        throw new Error("Feedback generation returned an empty response");
      }
      setFeedback(message);
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "Unable to generate AI feedback right now.";
      setFeedbackError(message);
    } finally {
      setIsFetchingFeedback(false);
    }
  }, []);

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

  const startRecording = async (): Promise<void> => {
  
    setError(null);
    setFinalTranscript("");
    setFillerWordCount(null);
    setFeedback(null);
    setFeedbackError(null);
    setIsFetchingFeedback(false);
    setLiveCommitted("");
    setLivePartial("");
    lastFinalRef.current = "";
    lastPartialRef.current = "";
    applyAudioUrl(null);
    setSuggestions([]);
    setIsFetchingSuggestions(false);
    setSuggestionError(null);
    setLastSuggestionSource(null);
    suggestionCooldownRef.current = false;
    lastSpeechAtRef.current = Date.now();
    setElapsedSeconds(0);
    setTimeLimitReached(false);
    clearRecordingTimer();
    timeLimitTriggeredRef.current = false;

    try {
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

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            noiseSuppression: true,
            echoCancellation: true,
          },
        });

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

      timerStartRef.current = Date.now();
      timerIdRef.current = window.setInterval(() => {
        if (!timerStartRef.current) return;
        const diffSeconds = Math.floor(
          (Date.now() - timerStartRef.current) / 1000
        );
        const elapsed = Math.min(diffSeconds, MAX_RECORDING_SECONDS);
        setElapsedSeconds(elapsed);

        if (diffSeconds >= MAX_RECORDING_SECONDS) {
          setTimeLimitReached(true);
          clearRecordingTimer();
          timerStartRef.current = null;
          timeLimitTriggeredRef.current = true;
          void stopRecording();
        }
      }, 250);

      const url = wsURL();
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        const audioCtx = createAudioContext(48000);
        audioCtxRef.current = audioCtx;

        const source =
          audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;

        const processor =
          audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

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
          if (t === "Begin") {
            return;
          }
          if (t === "Turn") {
            const text = String(
              msg["transcript"] || ""
            ).trim();
            const isFinal = Boolean(
              msg["turn_is_formatted"] ||
                msg["is_final"]
            );

            if (!text) return;
            registerSpeechActivity();

            if (isFinal) {
              if (text !== lastFinalRef.current) {
                setLiveCommitted((prev) =>
                  prev
                    ? prev + " " + text
                    : text
                );
                lastFinalRef.current = text;
              }
              setLivePartial("");
              lastPartialRef.current = "";
            } else {
              if (
                text !== lastPartialRef.current
              ) {
                setLivePartial(text);
                lastPartialRef.current = text;
              }
            }
          }
        } catch {
        }
      };

      ws.onerror = () =>
        setError("Streaming connection error");
      ws.onclose = () => {
      };

      setIsRecording(true);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Failed to start streaming";
      setError(msg);

      await stopRecording();
    }
  };

  const stopRecording = useCallback(async (): Promise<void> => {
    setIsRecording(false);
    setIsProcessing(true);
    clearRecordingTimer();
    timerStartRef.current = null;

    try {
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
        }
        wsRef.current.close();
      }

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
        const finalText =
          data.final?.trim() ||
          "Transcription incomplete.";
        setFinalTranscript(finalText);
        setFillerWordCount(data.filler_word_count ?? null);
        const playbackUrl = data.audio_url
          ? resolveApiUrl(data.audio_url)
          : URL.createObjectURL(blob);
        applyAudioUrl(playbackUrl, { revokePrevious: true });
        void requestFeedback(data.final ?? "");
        audioChunks.current = [];
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Failed to stop streaming";
      setError(msg);
    } finally {
      setIsProcessing(false);
      if (timeLimitTriggeredRef.current) {
        setElapsedSeconds(MAX_RECORDING_SECONDS);
      } else {
        setElapsedSeconds(0);
      }
      timeLimitTriggeredRef.current = false;
    }
  }, [applyAudioUrl, clearRecordingTimer, requestFeedback]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
      <Header />

      {!mounted ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 dark:text-gray-300">
            Loading...
          </p>
        </div>
      ) : (
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col">
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

          <section className="flex flex-col items-center mb-8">
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

            {(isRecording || clampedElapsed > 0 || timeLimitReached) && (
              <div className="flex flex-col items-center gap-1 text-sm text-gray-600 dark:text-gray-300 mb-4">
                <span className="text-xs uppercase tracking-widest">Recording timer</span>
                <span
                  className={`font-mono text-3xl font-semibold ${
                    isNearLimit
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {formattedElapsed}
                </span>
                {isRecording ? (
                  <span
                    className={`text-xs ${
                      isNearLimit
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    Time left: {formattedRemaining}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {timeLimitReached
                      ? "Maximum duration reached — we saved your take automatically."
                      : `Maximum duration: ${formatClock(MAX_RECORDING_SECONDS)}`}
                  </span>
                )}
              </div>
            )}

            {isRecording && (
              <div className="w-full max-w-xl">
                <LiveWaveform
                  isRecording={isRecording}
                />
              </div>
            )}
          </section>

          {showInteractivePanels && (
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
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                {highlightFillerWords(finalTranscript)}
              </p>
            </section>
          )}

          {(isFetchingFeedback || feedback || feedbackError) && (
            <section className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl shadow p-6 border border-slate-200 dark:border-slate-700 mb-8">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-lg font-semibold">AI Feedback</h3>
                {isFetchingFeedback && (
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Generating...
                  </span>
                )}
              </div>

              {feedbackError && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                  {feedbackError}
                </p>
              )}

              {feedback && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                  {feedback}
                </p>
              )}

              {!feedback && !feedbackError && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Gathering personalized insights from your session...
                </p>
              )}
            </section>
          )}

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
