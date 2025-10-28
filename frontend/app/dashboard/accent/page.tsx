"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE as ENV_API_BASE } from "../../lib/api";
import { AuthExpiredError, fetchAccentRecording } from "../listenRecording";

const API_BASE = ENV_API_BASE || "http://127.0.0.1:8000";

const PAGE_SIZE = 5;

type AccentAttemptSummary = {
  attempt_id: string;
  created_at: string;
  accent_target: string;
  score: number | null;
  transcript: string | null;
  audio_available: boolean;
};

const formatAccentLabel = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export default function AccentDashboardPage() {
  const [accentHistory, setAccentHistory] = useState<AccentAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioSources, setAudioSources] = useState<
    Record<string, { url: string; mimeType: string | null }>
  >({});
  const audioSourcesRef = useRef<Record<string, { url: string; mimeType: string | null }>>({});
  const pendingRevokesRef = useRef<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handleSessionExpired = useCallback(() => {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("authChange"));
  }, []);

  useEffect(() => {
    return () => {
      if (pendingRevokesRef.current.length) {
        pendingRevokesRef.current.forEach((url) => {
          if (url.startsWith("blob:")) {
            URL.revokeObjectURL(url);
          }
        });
        pendingRevokesRef.current = [];
      }
      Object.values(audioSourcesRef.current).forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!pendingRevokesRef.current.length) {
      return;
    }
    const urls = pendingRevokesRef.current.splice(0);
    urls.forEach((url) => {
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    });
  }, [audioSources]);

  const queueForRevoke = useCallback((url: string | null | undefined) => {
    if (url && url.startsWith("blob:")) {
      pendingRevokesRef.current.push(url);
    }
  }, []);

  const upsertAudioSource = useCallback(
    (attemptId: string, nextValue: { url: string; mimeType: string | null }) => {
      setAudioSources((prev) => {
        const existing = prev[attemptId];
        if (
          existing &&
          existing.url === nextValue.url &&
          existing.mimeType === nextValue.mimeType
        ) {
          audioSourcesRef.current = prev;
          return prev;
        }

        const next = { ...prev, [attemptId]: nextValue };
        if (existing?.url && existing.url !== nextValue.url) {
          queueForRevoke(existing.url);
        }
        audioSourcesRef.current = next;
        return next;
      });
    },
    [queueForRevoke]
  );

  const removeAudioSource = useCallback(
    (attemptId: string) => {
      setAudioSources((prev) => {
        const existing = prev[attemptId];
        if (!existing) {
          audioSourcesRef.current = prev;
          return prev;
        }

        const next = { ...prev };
        delete next[attemptId];
        queueForRevoke(existing.url);
        audioSourcesRef.current = next;
        return next;
      });
    },
    [queueForRevoke]
  );

  useEffect(() => {
    setCurrentPage((prev) => {
      const total = Math.max(1, Math.ceil(accentHistory.length / PAGE_SIZE));
      return Math.min(prev, total);
    });
  }, [accentHistory.length]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to review accent practice attempts.");
      setLoading(false);
      return;
    }

    const fetchAccent = async () => {
      try {
        const response = await fetch(`${API_BASE}/accent/history`, {
          headers: { Authorization: "Bearer " + token },
        });

        if (response.status === 401) {
          handleSessionExpired();
          throw new Error("Session expired. Please log in again.");
        }

        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(detail.detail || "Unable to load accent practice history.");
        }

        const data = (await response.json()) as AccentAttemptSummary[];
        setAccentHistory(data);
        setCurrentPage(1);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load accent practice history.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchAccent();
  }, [handleSessionExpired]);

  const hasRecordings = accentHistory.length > 0;
  const totalPages = Math.max(1, Math.ceil(accentHistory.length / PAGE_SIZE));
  const paginatedAttempts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return accentHistory.slice(start, start + PAGE_SIZE);
  }, [accentHistory, currentPage]);

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, idx) => idx + 1),
    [totalPages]
  );

  const handleLoadAudio = useCallback(
    async (attemptId: string) => {
      const token = localStorage.getItem("token");
      if (!token) {
        setAudioError("Please log in again to load this recording.");
        return;
      }

      if (audioSourcesRef.current[attemptId]) {
        setAudioError(null);
        return;
      }

      setLoadingAudioId(attemptId);
      setAudioError(null);

      try {
        const { summary, blob, mimeType } = await fetchAccentRecording(attemptId, token);

        setAccentHistory((prev) =>
          prev.map((attempt) =>
            attempt.attempt_id === attemptId
              ? {
                  ...attempt,
                  accent_target: summary.accent_target,
                  score: summary.score,
                  transcript: summary.transcript,
                  audio_available: summary.audio_available,
                }
              : attempt
          )
        );

        const objectUrl = URL.createObjectURL(blob);
        upsertAudioSource(attemptId, { url: objectUrl, mimeType });
      } catch (err) {
        if (err instanceof AuthExpiredError) {
          handleSessionExpired();
          setAudioError(err.message);
        } else {
          const message =
            err instanceof Error ? err.message : "Unable to fetch accent practice audio.";
          setAudioError(message);
        }
      } finally {
        setLoadingAudioId(null);
      }
    },
    [handleSessionExpired, upsertAudioSource]
  );

  const handleDeleteAttempt = useCallback(
    async (attemptId: string) => {
      if (!window.confirm("Delete this accent training attempt? This action cannot be undone.")) {
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        setDeleteError("Please log in again to delete recordings.");
        return;
      }

      setDeleteError(null);
      setDeletingId(attemptId);

      try {
        const response = await fetch(`${API_BASE}/accent/${attemptId}`, {
          method: "DELETE",
          headers: { Authorization: "Bearer " + token },
        });

        if (response.status === 401) {
          handleSessionExpired();
          throw new Error("Session expired. Please log in again.");
        }

        if (!response.ok) {
          const detail = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(detail.detail || "Failed to delete accent attempt.");
        }

        setAccentHistory((prev) => prev.filter((attempt) => attempt.attempt_id !== attemptId));
        removeAudioSource(attemptId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to delete accent attempt.";
        setDeleteError(message);
      } finally {
        setDeletingId(null);
      }
    },
    [handleSessionExpired, removeAudioSource]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold text-red-600 dark:text-red-400">Accent training history</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Listen back to targeted accent exercises separate from your monologue recordings.
        </p>
      </header>

      <section className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-red-100 dark:border-gray-800 p-8">
        <div className="flex flex-col gap-1 mb-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Accent practice library</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Review pronunciation scores, transcripts, and audio from your focused accent drills.
          </p>
        </div>
        {loading ? (
          <p className="text-center text-gray-600 dark:text-gray-400">Loading accent practice history...</p>
        ) : error ? (
          <p className="text-center text-red-500 text-sm">{error}</p>
        ) : !hasRecordings ? (
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {paginatedAttempts.map((attempt) => {
                  const audioEntry = audioSources[attempt.attempt_id];
                  const audioUrl = audioEntry?.url;
                  const audioType = audioEntry?.mimeType || "audio/webm";

                  return (
                    <tr
                      key={attempt.attempt_id}
                      className="hover:bg-red-50/60 dark:hover:bg-gray-800/60 transition"
                    >
                      <td className="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-200">
                        {new Date(attempt.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-600 dark:text-gray-400">
                        {formatAccentLabel(attempt.accent_target)}
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
                              onClick={() => handleLoadAudio(attempt.attempt_id)}
                              disabled={loadingAudioId === attempt.attempt_id}
                            >
                              {loadingAudioId === attempt.attempt_id
                                ? "Loading..."
                                : audioUrl
                                ? "Reload recording"
                                : "Listen recording"}
                            </button>
                            {audioUrl && (
                              <audio controls className="w-full">
                                <source src={audioUrl} type={audioType} />
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
                          onClick={() => handleDeleteAttempt(attempt.attempt_id)}
                          disabled={deletingId === attempt.attempt_id}
                          className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {deletingId === attempt.attempt_id ? "Removing..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && hasRecordings && (
          <div className="mt-6 flex justify-center gap-2">
            {pageNumbers.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  page === currentPage
                    ? "bg-red-600 text-white shadow"
                    : "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {page}
              </button>
            ))}
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
    </div>
  );
}
