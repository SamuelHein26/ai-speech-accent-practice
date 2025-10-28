"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AuthExpiredError, fetchMonologueRecording } from "../../listenRecording";

type PageProps = {
  params: {
    sessionId: string;
  };
};

type SessionSummary = {
  id: number;
  session_id: string;
  created_at: string;
  duration_seconds: number | null;
  final_transcript: string | null;
  filler_word_count: number | null;
  audio_available: boolean;
};

export default function ViewMonologueRecordingPage({ params }: PageProps) {
  const { sessionId } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioType, setAudioType] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleSessionExpired = useCallback(() => {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("authChange"));
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const loadRecording = async () => {
      setLoading(true);
      setError(null);
      setSummary(null);
      setAudioUrl(null);
      setAudioType(null);

      const token = localStorage.getItem("token");
      if (!token) {
        if (!active) return;
        setError("Please log in to access this recording.");
        setLoading(false);
        return;
      }

      try {
        const { summary: responseSummary, blob, mimeType } = await fetchMonologueRecording(
          sessionId,
          token,
        );

        if (!active) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setSummary(responseSummary);
        setAudioUrl(objectUrl);
        setAudioType(mimeType || "audio/wav");
      } catch (err) {
        if (!active) {
          return;
        }

        if (err instanceof AuthExpiredError) {
          handleSessionExpired();
          setError(err.message);
        } else {
          const message = err instanceof Error ? err.message : "Unable to load recording.";
          setError(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadRecording();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [handleSessionExpired, reloadKey, sessionId]);

  const handleRetry = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const recordedAt = summary?.created_at
    ? new Date(summary.created_at).toLocaleString()
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/monologue"
          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-gray-700 dark:text-red-300 dark:hover:bg-gray-800"
        >
          <span aria-hidden="true">←</span>
          Back to dashboard
        </Link>
      </div>

      <section className="rounded-3xl border border-red-100 bg-white p-8 shadow-lg dark:border-gray-800 dark:bg-gray-900">
        <header className="mb-6 space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-red-600 dark:text-red-400">Monologue recording</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Review your final transcript and replay the audio captured for this practice session.
          </p>
        </header>

        {loading ? (
          <p className="text-center text-gray-600 dark:text-gray-400">Loading recording...</p>
        ) : error ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        ) : summary ? (
          <div className="space-y-8">
            <div className="grid gap-4 rounded-2xl bg-red-50/60 p-6 text-sm text-gray-700 dark:bg-gray-800/40 dark:text-gray-300 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Session ID</span>
                <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{summary.session_id}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Recorded</span>
                <p className="text-sm text-gray-800 dark:text-gray-200">{recordedAt ?? "Unknown"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Duration</span>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {summary.duration_seconds ? `${summary.duration_seconds}s` : "Unknown"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Filler words</span>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {typeof summary.filler_word_count === "number" ? summary.filler_word_count : "—"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Final transcript</h2>
              <div className="whitespace-pre-line rounded-2xl border border-red-100 bg-white/80 p-6 text-sm text-gray-800 shadow-sm dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-100">
                {summary.final_transcript || "Transcript unavailable."}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Recording playback</h2>
              {audioUrl ? (
                <audio controls className="w-full">
                  <source src={audioUrl} type={audioType ?? undefined} />
                  Your browser does not support audio playback.
                </audio>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">Recording unavailable.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-red-500" role="alert">
            Recording data is unavailable.
          </p>
        )}
      </section>
    </div>
  );
}

