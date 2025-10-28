import { API_BASE } from "../lib/api";

export class AuthExpiredError extends Error {
  constructor(message = "Session expired. Please log in again.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

const BASE_URL = API_BASE || "http://127.0.0.1:8000";

type SessionSummaryResponse = {
  id: number;
  session_id: string;
  created_at: string;
  duration_seconds: number | null;
  final_transcript: string | null;
  filler_word_count: number | null;
  audio_available: boolean;
};

type AccentAttemptSummaryResponse = {
  attempt_id: string;
  created_at: string;
  accent_target: string;
  score: number | null;
  transcript: string | null;
  audio_available: boolean;
};

type AudioFetchResult = {
  blob: Blob;
  mimeType: string | null;
};

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return (data?.detail as string) || res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

async function fetchJsonWithAuth<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401) {
    throw new AuthExpiredError();
  }

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return (await res.json()) as T;
}

async function fetchAudioWithAuth(path: string, token: string): Promise<AudioFetchResult> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    throw new AuthExpiredError();
  }

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  const blob = await res.blob();
  const mimeType = res.headers.get("Content-Type");
  return { blob, mimeType };
}

export async function fetchMonologueRecording(sessionId: string, token: string) {
  const summary = await fetchJsonWithAuth<SessionSummaryResponse>(`/session/${sessionId}`, token);

  if (!summary.audio_available) {
    throw new Error("Audio unavailable for this session.");
  }

  const audio = await fetchAudioWithAuth(`/session/${sessionId}/audio`, token);

  return { summary, ...audio };
}

export async function fetchAccentRecording(attemptId: string, token: string) {
  const summary = await fetchJsonWithAuth<AccentAttemptSummaryResponse>(`/accent/${attemptId}`, token);

  if (!summary.audio_available) {
    throw new Error("Audio unavailable for this attempt.");
  }

  const audio = await fetchAudioWithAuth(`/accent/${attemptId}/audio`, token);

  return { summary, ...audio };
}
