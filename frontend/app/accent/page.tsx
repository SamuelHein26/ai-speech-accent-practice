"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE } from "../lib/api";
import { createAudioRecorder, recordingFilename } from "../lib/recording";

import practicePhrasesData from "./practice-phrases.json";

const FALLBACK_PHRASE =
  "The weather today is perfect for a calming walk by the river, so breathe deeply and feel the rhythm of your words.";

const PRACTICE_PHRASES = (Array.isArray(practicePhrasesData)
  ? (practicePhrasesData as unknown[])
  : []
).filter((phrase): phrase is string => typeof phrase === "string" && phrase.trim().length > 0);

function pickRandomPhrase(exclude?: string): string {
  if (PRACTICE_PHRASES.length === 0) {
    return FALLBACK_PHRASE;
  }

  if (PRACTICE_PHRASES.length === 1) {
    return PRACTICE_PHRASES[0];
  }

  let candidate: string | undefined;

  do {
    const index = Math.floor(Math.random() * PRACTICE_PHRASES.length);
    candidate = PRACTICE_PHRASES[index];
  } while (!candidate || candidate === exclude);

  return candidate;
}

type AccentOption = "american" | "british";

type AccentWordFeedback = {
  text: string;
  status: "ok" | "bad" | "accent_mismatch";
  note?: string;
  spoken?: string | null;
  confidence?: number | null;
};

type AccentTrainingResponse = {
  attemptId: string;
  score: number;
  words: AccentWordFeedback[];
  tips: string;
  transcript: string;
};

type AccentTrainingUiResult = AccentTrainingResponse & { accent: AccentOption };

export default function AccentPage() {
  const [selectedAccent, setSelectedAccent] = useState<AccentOption>("american");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccentTrainingUiResult | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [downloadName, setDownloadName] = useState("comftalk-accent");
  const mountedRef = useRef(false);
  const startingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const playbackUrlRef = useRef<string | null>(null);

  const isBusy = useMemo(() => isRecording || isUploading, [isRecording, isUploading]);

  useEffect(() => {
    setIsMounted(true);
    setCurrentPhrase(pickRandomPhrase());
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
        playbackUrlRef.current = null;
      }
    };
  }, []);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setIsUploading(true);
      setError(null);

      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(blob);
      playbackUrlRef.current = objectUrl;
      setPlaybackUrl(objectUrl);

      const formData = new FormData();
      const filename = recordingFilename("accent", blob.type);
      setDownloadName(filename);
      formData.append("audio", blob, filename);
      formData.append("text", currentPhrase);
      formData.append("accent", selectedAccent);

      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("Sign in again to submit your practice.");

        const response = await fetch(`${API_BASE}/accent/train`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(typeof detail.detail === "string" ? detail.detail : "Accent analysis failed.");
        }

        const data = (await response.json()) as AccentTrainingResponse;
        setResult({ ...data, accent: selectedAccent });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to analyse recording.";
        setError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [currentPhrase, selectedAccent]
  );

  const startRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Your browser doesn't support microphone recording.");
      return;
    }

    if (startingRef.current) return;
    startingRef.current = true;
    let stream: MediaStream | undefined;
    try {
      const activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream = activeStream;
      if (!mountedRef.current) {
        activeStream.getTracks().forEach((track) => track.stop());
        return;
      }
      const recorder = createAudioRecorder(activeStream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        activeStream.getTracks().forEach((track) => track.stop());
        if (!mountedRef.current) return;
        const mimeType = recorder.mimeType || chunksRef.current[0]?.type;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size) {
          void uploadRecording(blob);
        } else {
          setError("No audio was recorded. Try again.");
          setIsUploading(false);
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
        playbackUrlRef.current = null;
        setPlaybackUrl(null);
      }
      setIsRecording(true);
      setError(null);
      setResult(null);
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      const message = err instanceof Error ? err.message : "Unable to access microphone.";
      setError(message);
    } finally {
      startingRef.current = false;
    }
  }, [uploadRecording]);

  const stopRecording = useCallback(() => {
    setIsUploading(true);
    recorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div className="w-full bg-ui-page transition-colors">
      <main className="page-container">
        <div className="mx-auto max-w-3xl space-y-10">
          <header className="text-center space-y-2">
            <p className="page-eyebrow">Accent training</p>
            <h1 className="page-title">
              Give every word a little attention
            </h1>
            <p className="text-sm sm:text-base text-ui-muted">
              Pick a target accent, read the prompt aloud, and we&apos;ll highlight the words that need polish.
            </p>
          </header>

          <section className="bg-ui-surface border border-ui-border shadow-lg rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-medium text-ui-text">Target accent</h2>
                <p className="text-xs text-ui-muted">
                  Swap accents anytime — your next attempt will score against the selected style.
                </p>
              </div>
              <div className="grid w-full grid-cols-2 rounded-full bg-ui-surface-muted p-1 sm:w-auto sm:shrink-0">
                {(["american", "british"] as AccentOption[]).map((option) => {
                  const active = option === selectedAccent;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={active}
                      disabled={isBusy}
                      onClick={() => setSelectedAccent(option)}
                      className={`px-3 py-2 text-center text-sm font-medium rounded-full transition-colors cursor-pointer sm:px-4 ${
                        active
                          ? "bg-brand-sage/15 text-ui-sage shadow-sm"
                          : "text-ui-muted hover:bg-brand-sage/10"
                      }`}
                    >
                      {option === "american" ? "American English" : "British English"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-widest text-ui-muted">
                  Read this aloud
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPhrase((prev) => pickRandomPhrase(prev));
                    setResult(null);
                    setError(null);
                    if (playbackUrlRef.current) {
                      URL.revokeObjectURL(playbackUrlRef.current);
                      playbackUrlRef.current = null;
                    }
                    setPlaybackUrl(null);
                  }}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-full border border-ui-border bg-ui-surface px-3 py-1.5 text-xs font-medium text-ui-muted transition hover:border-brand-sage hover:text-ui-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sage focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  Refresh phrase
                </button>
              </div>
                <div className="rounded-2xl border border-dashed border-brand-sage/45 bg-brand-sage/5 p-6">
                  {isMounted ? (
                    <ParagraphFeedback feedback={result?.words} fallbackText={currentPhrase} />
                  ) : (
                    <p className="text-base leading-relaxed text-ui-muted">Loading phrase...</p>
                  )}
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isUploading}
                  className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                    isRecording
                      ? "bg-brand-secondary text-ui-on-brand hover:bg-brand-sage hover:text-brand-on-sage"
                      : "bg-brand-secondary text-ui-on-brand hover:bg-brand-sage hover:text-brand-on-sage"
                  }`}
                >
                  {isRecording ? "Stop recording" : "Record attempt"}
                </button>
                {isRecording && <PulseIndicator />}
              </div>

              <div className="text-xs text-ui-muted">
                {isUploading
                  ? "Uploading and analysing your speech..."
                  : "We capture a short clip each time you hit record."}
              </div>
            </div>

            {error && <p className="text-sm text-ui-accent">{error}</p>}

            {result && (
              <div className="space-y-4 rounded-2xl border border-ui-border bg-ui-surface/60 p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-ui-muted">
                      Clarity score
                    </p>
                    <p className="text-3xl font-semibold text-ui-accent">
                      {result.score.toFixed(0)} / 100
                    </p>
                  </div>
                  <div className="text-xs text-ui-muted">
                    Attempt ID: <span className="font-mono">{result.attemptId}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-ui-muted">
                    Coach&apos;s tip
                  </p>
                  <p className="text-sm text-ui-text leading-relaxed">{result.tips}</p>
                </div>

                <WordFeedbackDetails accent={result.accent} words={result.words} />
              </div>
            )}

          {playbackUrl && (
            <div className="space-y-3 rounded-2xl border border-ui-border bg-ui-surface/70 p-6">
              <h3 className="text-base font-semibold text-ui-text">Listen back</h3>
              <p className="text-sm text-ui-muted">
                Replay your latest take to hear improvements and spot words that still feel tricky.
              </p>
              <audio controls src={playbackUrl} className="w-full">
                Your browser does not support audio playback.
              </audio>
              <a href={playbackUrl} download={downloadName} className="button-primary">
                Download recording
              </a>
              <p className="text-sm text-ui-muted">Download before leaving this page or replacing the recording.</p>
            </div>
          )}
        </section>

          <footer className="text-center text-xs text-ui-muted">
            {isBusy
              ? "Hang tight — we&apos;re processing your latest take."
              : "Keep experimenting with different accents to build muscle memory."}
          </footer>
        </div>
      </main>
    </div>
  );
}

function PulseIndicator() {
  return (
    <span className="flex items-center gap-2 text-sm text-ui-accent">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-secondary opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-secondary" />
      </span>
      Recording...
    </span>
  );
}

function WordFeedbackDetails({
  accent,
  words,
}: {
  accent: AccentOption;
  words: AccentWordFeedback[];
}) {
  const accentLabel = accent === "american" ? "American" : "British";
  const issues = words.filter((word) => word.status !== "ok");

  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-ui-border bg-ui-surface/80 p-4 text-sm text-ui-muted shadow-sm/40">
        Every word matched the {accentLabel} target. Nicely done!
      </div>
    );
  }

  const formatStatus = (status: AccentWordFeedback["status"]) => {
    switch (status) {
      case "accent_mismatch":
        return "Accent adjustment";
      case "bad":
        return "Needs clarity";
      default:
        return "On target";
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-widest text-ui-muted">
        Detailed {accentLabel} feedback
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-ui-border text-sm dark:divide-ui-border">
          <thead className="bg-ui-surface-muted/70">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ui-muted">
                Target word
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ui-muted">
                What we heard
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ui-muted">
                Confidence
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ui-muted">
                Status
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ui-muted">
                Coach note
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ui-border dark:divide-ui-border">
            {issues.map((word, index) => (
              <tr key={`${word.text}-${index}`} className="bg-ui-surface/40">
                <td className="px-3 py-2 font-medium text-ui-text">{word.text}</td>
                <td className="px-3 py-2 text-ui-text">
                  {word.spoken ?? <span className="italic text-ui-muted">—</span>}
                </td>
                <td className="px-3 py-2 text-ui-muted">
                  {typeof word.confidence === "number"
                    ? `${Math.round(word.confidence * 100)}%`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-ui-text">{formatStatus(word.status)}</td>
                <td className="px-3 py-2 text-ui-text">
                  {word.note || "Keep practising this word."}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParagraphFeedback({
  feedback,
  fallbackText,
}: {
  feedback: AccentWordFeedback[] | undefined;
  fallbackText: string;
}) {
  if (!feedback || feedback.length === 0) {
    return <p className="text-base leading-relaxed text-ui-text">{fallbackText}</p>;
  }

  return (
    <p className="text-base leading-relaxed text-ui-text">
      {feedback.map((word, index) => {
        const isAccentIssue = word.status === "accent_mismatch";
        const isProblem = word.status !== "ok";
        const classes = [
          isAccentIssue
            ? "underline decoration-2 decoration-brand-secondary text-ui-accent"
            : isProblem
            ? "underline decoration-brand-secondary text-ui-accent"
            : "text-ui-text",
        ].join(" ");

        return (
          <span key={`${word.text}-${index}`} className="inline-flex items-center">
            <span
              className={classes}
              title={word.note}
              aria-label={word.note ? `${word.text}: ${word.note}` : undefined}
            >
              {word.text}
            </span>
            {index < feedback.length - 1 && <span>&nbsp;</span>}
          </span>
        );
      })}
    </p>
  );
}
