// app/lib/ws.ts
// Purpose: Build a ws:// or wss:// URL from NEXT_PUBLIC_API_BASE_URL.
// Notes:
// - Ensures /ws/stream path and proper scheme in prod (wss).

import { API_BASE } from "./api";

export function buildWsUrl(path = "/ws/stream"): string {
  const u = new URL(API_BASE);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = path;
  u.search = "";
  u.hash = "";
  return u.toString();
}
