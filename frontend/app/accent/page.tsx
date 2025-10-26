"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Header from "../components/Header";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://127.0.0.1:8000";

type AccentOption = "american" | "british";

type AccentWordFeedback = {
  text: string;
  status: "ok" | "bad" | "accent_mismatch";
  note?: string;
};

type AccentTrainingResponse = {
  attemptId: string;
  score: number;
  words: AccentWordFeedback[];
  tips: string;
  transcript: string;
};

const PRACTICE_PARAGRAPH =
  "The weather today is perfect for a calming walk by the river, so breathe deeply and feel the rhythm of your words.";

export default function AccentPage() {
  const [selectedAccent, setSelectedAccent] = useState<AccentOption>("american");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccentTrainingResponse | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isBusy = useMemo(() => isRecording || isUploading, [isRecording, isUploading]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Your browser doesn't support microphone recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        void uploadRecording(blob);
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to access microphone.";
      setError(message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("audio", blob, "accent-practice.webm");
      formData.append("text", PRACTICE_PARAGRAPH);
      formData.append("accent", selectedAccent);
      formData.append("userId", "0");

      try {
        const response = await fetch(`${API_BASE}/accent/train`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(detail.detail || "Accent analysis failed.");
        }

        const data = (await response.json()) as AccentTrainingResponse;
        setResult(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to analyse recording.";
        setError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [selectedAccent]
  );

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Header />
      <main className="px-4 py-12 flex justify-center">
        <div className="w-full max-w-3xl space-y-10">
          <header className="text-center space-y-2">
            <p className="text-sm uppercase tracking-widest text-red-500 dark:text-red-400">Accent training</p>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Choose your accent and practise with real-time feedback
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pick a target accent, read the prompt aloud, and we&apos;ll highlight the words that need polish.
            </p>
          </header>

          <section className="bg-white dark:bg-gray-900 border border-red-100 dark:border-gray-800 shadow-lg rounded-3xl p-8 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Target accent</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Swap accents anytime — your next attempt will score against the selected style.
                </p>
              </div>
              <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1">
                {(["american", "british"] as AccentOption[]).map((option) => {
                  const active = option === selectedAccent;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedAccent(option)}
                      className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                        active
                          ? "bg-red-500 text-white shadow"
                          : "text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {option === "american" ? "American English" : "British English"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Read this aloud
              </p>
              <div className="rounded-2xl border border-dashed border-red-200 dark:border-gray-700 bg-red-50/40 dark:bg-gray-800/60 p-6">
                <ParagraphFeedback feedback={result?.words} fallbackText={PRACTICE_PARAGRAPH} />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isUploading}
                  className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                    isRecording
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900"
                  }`}
                >
                  {isRecording ? "Stop recording" : "Record attempt"}
                </button>
                {isRecording && <PulseIndicator />}
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                {isUploading
                  ? "Uploading and analysing your speech..."
                  : "We capture a short clip each time you hit record."}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {result && (
              <div className="space-y-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      Clarity score
                    </p>
                    <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                      {result.score.toFixed(0)} / 100
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Attempt ID: <span className="font-mono">{result.attemptId}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    Coach&apos;s tip
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{result.tips}</p>
                </div>
              </div>
            )}
          </section>

          <footer className="text-center text-xs text-gray-500 dark:text-gray-400">
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
    <span className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
      </span>
      Recording...
    </span>
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
    return <p className="text-base leading-relaxed text-gray-800 dark:text-gray-200">{fallbackText}</p>;
  }

  return (
    <p className="text-base leading-relaxed text-gray-800 dark:text-gray-200">
      {feedback.map((word, index) => {
        const isAccentIssue = word.status === "accent_mismatch";
        const isProblem = word.status !== "ok";
        const classes = [
          isAccentIssue
            ? "underline decoration-2 decoration-red-500 text-red-600 dark:text-red-300"
            : isProblem
            ? "underline decoration-red-400 text-red-600 dark:text-red-300"
            : "text-gray-800 dark:text-gray-200",
        ].join(" ");

        return (
          <span key={`${word.text}-${index}`} className="inline-flex items-center">
            <span className={classes} title={word.note}>{word.text}</span>
            {index < feedback.length - 1 && <span>&nbsp;</span>}
          </span>
        );
      })}
    </p>
  );
}
