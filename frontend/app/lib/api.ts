// app/lib/api.ts
// Purpose: Centralized, typed HTTP client bound to NEXT_PUBLIC_API_BASE_URL.
// Notes:
// - Uses native fetch (built into Next.js runtime).
// - Adds JSON & error handling. Avoids "any" by using generics.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

if (!API_BASE) {
  // Early failure helps catch misconfigured env in local/preview/prod.
  // In production this will never log to browser console before usage.
  // It's still good to keep for debugging during dev.
  // console.warn("NEXT_PUBLIC_API_BASE_URL is not defined");
}

type FetchOptions = Omit<RequestInit, "body"> & { body?: BodyInit | null };

export async function apiGet<T>(path: string, init?: FetchOptions): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    method: "GET",
    headers: { "Accept": "application/json", ...(init?.headers || {}) },
    credentials: "include", // keep if you ever switch to cookie auth; harmless now
  });
  if (!res.ok) {
    const msg = await safeMsg(res);
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body?: BodyInit, init?: Omit<FetchOptions,"body">): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    method: "POST",
    body,
    headers: {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const msg = await safeMsg(res);
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

async function safeMsg(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return (j?.detail as string) || res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}
