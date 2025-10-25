"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://127.0.0.1:8000";

type UserProfile = {
  id: number;
  username: string;
  email: string;
  created_at: string;
  total_sessions: number;
};

type SessionSummary = {
  id: number;
  session_id: string;
  created_at: string;
  duration_seconds: number | null;
  final_transcript: string | null;
  audio_available: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to view your profile.");
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const [profileRes, historyRes] = await Promise.all([
          fetch(`${API_BASE}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/session/history`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (profileRes.status === 401 || historyRes.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }

        if (!profileRes.ok) {
          const detail = (await profileRes.json().catch(() => ({}))) as { detail?: string };
          throw new Error(detail.detail || "Unable to load profile details.");
        }
        if (!historyRes.ok) {
          const detail = (await historyRes.json().catch(() => ({}))) as { detail?: string };
          throw new Error(detail.detail || "Unable to load recording history.");
        }

        const profileData = (await profileRes.json()) as UserProfile;
        const historyData = (await historyRes.json()) as SessionSummary[];

        setProfile(profileData);
        setHistory(historyData);
        setUsernameInput(profileData.username);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const formattedJoinedDate = useMemo(() => {
    if (!profile) return "";
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(profile.created_at));
  }, [profile]);

  const recentHistory = useMemo(() => history.slice(0, 5), [history]);

  const handleDeleteRecording = async (sessionId: string) => {
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
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(detail.detail || "Failed to delete recording.");
      }

      setHistory((prev) => prev.filter((session) => session.session_id !== sessionId));
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              total_sessions: Math.max(0, prev.total_sessions - 1),
            }
          : prev
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete recording.";
      setDeleteError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in again to update your profile.");
      return;
    }

    const payload: { username?: string; password?: string } = {};
    if (usernameInput && usernameInput !== profile.username) {
      payload.username = usernameInput;
    }
    if (passwordInput) {
      payload.password = passwordInput;
    }

    if (!payload.username && !payload.password) {
      setUpdateMessage("No changes to save.");
      return;
    }

    setUpdating(true);
    setUpdateMessage(null);

    try {
      const response = await fetch(`${API_BASE}/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(detail.detail || "Could not update profile.");
      }

      const updated = (await response.json()) as UserProfile;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              username: updated.username,
            }
          : updated
      );
      setPasswordInput("");
      setUpdateMessage("Profile updated successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed.";
      setUpdateMessage(message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Header />
      <main className="px-4 py-12 flex justify-center">
        <div className="w-full max-w-4xl space-y-8">
          <section className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-red-100 dark:border-gray-800 p-8">
            {loading ? (
              <p className="text-center text-gray-600 dark:text-gray-400">Loading profile...</p>
            ) : error ? (
              <div className="text-center space-y-4">
                <p className="text-red-500 text-sm">{error}</p>
                <button
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
                  onClick={() => router.push("/")}
                >
                  Go to login
                </button>
              </div>
            ) : profile ? (
              <div className="space-y-6">
                <header className="flex flex-col gap-2">
                  <h1 className="text-3xl font-semibold text-red-600 dark:text-red-400">{profile.username}</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{profile.email}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Joined {formattedJoinedDate} • {profile.total_sessions} saved sessions
                  </p>
                </header>

                <form onSubmit={handleUpdate} className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="username-update">
                      Update username
                    </label>
                    <input
                      id="username-update"
                      type="text"
                      value={usernameInput}
                      onChange={(event) => setUsernameInput(event.target.value)}
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="password-update">
                      Change password
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="password-update"
                        type={showPassword ? "text" : "password"}
                        value={passwordInput}
                        onChange={(event) => setPasswordInput(event.target.value)}
                        placeholder="New password"
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <input
                          type="checkbox"
                          checked={showPassword}
                          onChange={(event) => setShowPassword(event.target.checked)}
                          className="accent-red-600"
                        />
                        Show
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {updateMessage && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">{updateMessage}</span>
                    )}
                    <button
                      type="submit"
                      disabled={updating}
                      className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
                    >
                      {updating ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </section>

          <section className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-red-100 dark:border-gray-800 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-red-600 dark:text-red-400">Recent recordings</h2>
              <button
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
                onClick={() => router.push("/dashboard")}
              >
                View dashboard
              </button>
            </div>
            {loading ? (
              <p className="text-gray-600 dark:text-gray-400">Loading sessions...</p>
            ) : recentHistory.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">No recordings saved yet. Start a monologue to build your history!</p>
            ) : (
              <ul className="space-y-4">
                {recentHistory.map((session) => (
                  <li
                    key={session.session_id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {new Date(session.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {session.final_transcript || "Transcript unavailable"}
                      </p>
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {session.duration_seconds ? `${session.duration_seconds}s` : "Duration unknown"}
                      </span>
                      <button
                        onClick={() => handleDeleteRecording(session.session_id)}
                        disabled={deletingId === session.session_id}
                        className="self-start sm:self-end px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deletingId === session.session_id ? "Removing..." : "Delete"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {deleteError && (
              <p className="mt-4 text-sm text-red-500" role="alert">
                {deleteError}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
