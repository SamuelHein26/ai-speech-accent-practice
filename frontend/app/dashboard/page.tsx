"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://127.0.0.1:8000";

type SessionSummary = {
  id: number;
  session_id: string;
  created_at: string;
  duration_seconds: number | null;
  final_transcript: string | null;
  filler_word_count: number | null;
  audio_available: boolean;
};

type AccentAttemptSummary = {
  attempt_id: string;
  created_at: string;
  accent_target: string;
  score: number | null;
  transcript: string | null;
  audio_available: boolean;
};

export default function DashboardPage() {
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioSources, setAudioSources] = useState<Record<string, string>>({});
  const audioSourcesRef = useRef<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [accentHistory, setAccentHistory] = useState<AccentAttemptSummary[]>([]);
  const [accentLoading, setAccentLoading] = useState(true);
  const [accentError, setAccentError] = useState<string | null>(null);
  const [accentAudioSources, setAccentAudioSources] = useState<Record<string, string>>({});
  const accentAudioSourcesRef = useRef<Record<string, string>>({});
  const [loadingAccentAudioId, setLoadingAccentAudioId] = useState<string | null>(null);
  const [accentAudioError, setAccentAudioError] = useState<string | null>(null);

  useEffect(() => {
    audioSourcesRef.current = audioSources;
  }, [audioSources]);

  useEffect(() => {
    accentAudioSourcesRef.current = accentAudioSources;
  }, [accentAudioSources]);

  useEffect(() => {
    return () => {
      Object.values(audioSourcesRef.current).forEach((url) => URL.revokeObjectURL(url));
      Object.values(accentAudioSourcesRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to view your dashboard.");
      setLoading(false);
      setAccentError("Please log in to review accent practice attempts.");
      setAccentLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_BASE}/session/history`, {
          headers: { Authorization: "Bearer " + token },
        });

        if (response.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }

        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(detail.detail || "Unable to load session history.");
        }

        const data = (await response.json()) as SessionSummary[];
        setHistory(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load dashboard.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    const fetchAccent = async () => {
      try {
        const response = await fetch(`${API_BASE}/accent/history`, {
          headers: { Authorization: "Bearer " + token },
        });

        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(detail.detail || "Unable to load accent practice history.");
        }

        const data = (await response.json()) as AccentAttemptSummary[];
        setAccentHistory(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to load accent practice history.";
        setAccentError(message);
      } finally {
        setAccentLoading(false);
      }
    };

    fetchHistory();
    fetchAccent();
  }, []);

  const hasRecordings = useMemo(() => history.length > 0, [history]);
  const hasAccentRecordings = useMemo(() => accentHistory.length > 0, [accentHistory]);

  const handleLoadAudio = useCallback(
    async (sessionId: string) => {
      const token = localStorage.getItem("token");
      if (!token) {
        setAudioError("Please log in again to load this recording.");
        return;
      }

      if (audioSourcesRef.current[sessionId]) {
        setAudioError(null);
        return;
      }

      setLoadingAudioId(sessionId);
      setAudioError(null);

      try {
        const response = await fetch(`${API_BASE}/session/${sessionId}/audio`, {
          headers: { Authorization: "Bearer " + token },
        });

        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(detail.detail || "Unable to load audio.");
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setAudioSources((prev) => {
          const next = { ...prev };
          if (next[sessionId]) {
            URL.revokeObjectURL(next[sessionId]);
          }
          next[sessionId] = objectUrl;
          return next;
        });
        audioSourcesRef.current[sessionId] = objectUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to fetch audio.";
        setAudioError(message);
      } finally {
        setLoadingAudioId(null);
      }
    },
    []
  );

  const handleLoadAccentAudio = useCallback(
    async (attemptId: string) => {
      const token = localStorage.getItem("token");
      if (!token) {
        setAccentAudioError("Please log in again to load this recording.");
        return;
      }

      if (accentAudioSourcesRef.current[attemptId]) {
        setAccentAudioError(null);
        return;
      }

      setLoadingAccentAudioId(attemptId);
      setAccentAudioError(null);

      try {
        const response = await fetch(`${API_BASE}/accent/${attemptId}/audio`, {
          headers: { Authorization: "Bearer " + token },
        });

        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(detail.detail || "Unable to load accent practice audio.");
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setAccentAudioSources((prev) => {
          const next = { ...prev };
          if (next[attemptId]) {
            URL.revokeObjectURL(next[attemptId]);
          }
          next[attemptId] = objectUrl;
          return next;
        });
        accentAudioSourcesRef.current[attemptId] = objectUrl;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to fetch accent practice audio.";
        setAccentAudioError(message);
      } finally {
        setLoadingAccentAudioId(null);
      }
    },
    []
  );

  const handleDeleteRecording = useCallback(
    async (sessionId: string) => {
      const token = localStorage.getItem("token");
      if (!token) {
        setDeleteError("Please log in again to delete recordings.");
        return;
      }

      setDeleteError(null);
      setDeletingId(sessionId);

      try {
        const response = await fetch(`${API_BASE}/session/${sessionId}`, {
          method: "DELETE",
          headers: { Authorization: "Bearer " + token },
        });

        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(detail.detail || "Failed to delete recording.");
        }

        setHistory((prev) => prev.filter((session) => session.session_id !== sessionId));
        setAudioSources((prev) => {
          const next = { ...prev };
          if (next[sessionId]) {
            URL.revokeObjectURL(next[sessionId]);
            delete next[sessionId];
          }
          audioSourcesRef.current = next;
          return next;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to delete recording.";
        setDeleteError(message);
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Header />
      <main className="px-4 py-12 flex justify-center">
        <div className="w-full max-w-5xl space-y-6">
          <header className="flex flex-col gap-2 text-center">
            <h1 className="text-3xl font-semibold text-red-600 dark:text-red-400">Your monologue dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Review your practice sessions, revisit transcripts, and listen to saved recordings.
            </p>
          </header>

          <section className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-red-100 dark:border-gray-800 p-8">
            <div className="flex flex-col gap-1 mb-6 text-center">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Monologue sessions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Review transcripts, filler-word counts, and replay your long-form practice takes.
              </p>
            </div>
            {loading ? (
              <p className="text-center text-gray-600 dark:text-gray-400">Loading session history...</p>
            ) : error ? (
              <p className="text-center text-red-500 text-sm">{error}</p>
            ) : !hasRecordings ? (
              <p className="text-center text-gray-600 dark:text-gray-400">
                You have no saved sessions yet. Start a monologue to build your library!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-red-50 dark:bg-gray-800/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Recorded
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Transcript
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Filler words
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Audio
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {history.map((session) => {
                      const audioUrl = audioSources[session.session_id];
                      return (
                        <tr key={session.session_id} className="hover:bg-red-50/60 dark:hover:bg-gray-800/60 transition">
                          <td className="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-200">
                            {new Date(session.created_at).toLocaleString()}
                          </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-400">
                          <span className="block max-w-sm whitespace-pre-line">
                            {session.final_transcript || "Transcript unavailable"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300">
                          {typeof session.filler_word_count === "number"
                            ? session.filler_word_count
                            : "—"}
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-400">
                          {session.duration_seconds ? `${session.duration_seconds}s` : "Unknown"}
                        </td>
                          <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-400 space-y-2">
                            {session.audio_available ? (
                              <>
                                <button
                                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-60"
                                  onClick={() => handleLoadAudio(session.session_id)}
                                  disabled={loadingAudioId === session.session_id}
                                >
                                  {loadingAudioId === session.session_id
                                    ? "Loading..."
                                    : audioUrl
                                    ? "Reload"
                                    : "Load audio"}
                                </button>
                                {audioUrl && (
                                  <audio controls className="w-full">
                                    <source src={audioUrl} type="audio/wav" />
                                    Your browser does not support audio playback.
                                  </audio>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-500">Audio unavailable</span>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-400">
                            <button
                              onClick={() => handleDeleteRecording(session.session_id)}
                              disabled={deletingId === session.session_id}
                              className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {deletingId === session.session_id ? "Removing..." : "Delete"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {audioError && (
              <p className="mt-4 text-center text-sm text-red-500">{audioError}</p>
            )}
            {deleteError && (
              <p className="mt-2 text-center text-sm text-red-500" role="alert">
                {deleteError}
              </p>
            )}
          </section>

          <section className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-red-100 dark:border-gray-800 p-8">
            <div className="flex flex-col gap-1 mb-6 text-center">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Accent practice library
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Listen back to targeted accent exercises separate from your monologue recordings.
              </p>
            </div>
            {accentLoading ? (
              <p className="text-center text-gray-600 dark:text-gray-400">Loading accent practice history...</p>
            ) : accentError ? (
              <p className="text-center text-red-500 text-sm">{accentError}</p>
            ) : !hasAccentRecordings ? (
              <p className="text-center text-gray-600 dark:text-gray-400">
                You haven&apos;t saved any accent training attempts yet. Visit the accent page to capture your first clip.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-red-50 dark:bg-gray-800/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Recorded
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Accent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Transcript
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Audio
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {accentHistory.map((attempt) => {
                      const audioUrl = accentAudioSources[attempt.attempt_id];
                      const accentLabel =
                        attempt.accent_target.charAt(0).toUpperCase() + attempt.accent_target.slice(1);
                      return (
                        <tr key={attempt.attempt_id} className="hover:bg-red-50/60 dark:hover:bg-gray-800/60 transition">
                          <td className="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-200">
                            {new Date(attempt.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-400">
                            {accentLabel}
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300">
                            {typeof attempt.score === "number" ? `${Math.round(attempt.score)} / 100` : "—"}
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-400">
                            <span className="block max-w-sm whitespace-pre-line">
                              {attempt.transcript || "Transcript unavailable"}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-400 space-y-2">
                            {attempt.audio_available ? (
                              <>
                                <button
                                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-60"
                                  onClick={() => handleLoadAccentAudio(attempt.attempt_id)}
                                  disabled={loadingAccentAudioId === attempt.attempt_id}
                                >
                                  {loadingAccentAudioId === attempt.attempt_id
                                    ? "Loading..."
                                    : audioUrl
                                    ? "Reload"
                                    : "Load audio"}
                                </button>
                                {audioUrl && (
                                  <audio controls className="w-full">
                                    <source src={audioUrl} type="audio/webm" />
                                    Your browser does not support audio playback.
                                  </audio>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-500">Audio unavailable</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {accentAudioError && (
              <p className="mt-4 text-center text-sm text-red-500">{accentAudioError}</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
