"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/api";
import { loginHref } from "../../lib/auth";

type Overview = {
  role: "admin" | "primary_admin";
  users: number;
  admins: number;
  monologue_sessions: number;
  accent_attempts: number;
};

const metrics = [
  { key: "users", label: "Registered accounts" },
  { key: "admins", label: "Admin accounts" },
  { key: "monologue_sessions", label: "Monologue sessions" },
  { key: "accent_attempts", label: "Accent attempts" },
] as const;

export default function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem("token");
    void fetch(`${API_BASE}/admin/overview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
      cache: "no-store",
    }).then(async (response) => {
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        router.replace(loginHref("/dashboard/admin"));
        return;
      }
      if (response.status === 403) {
        setError("You need an admin account to view this dashboard.");
        return;
      }
      if (!response.ok) throw new Error("Unable to load the dashboard.");
      const data: Overview = await response.json();
      if (!controller.signal.aborted) setOverview(data);
    }).catch(() => {
      if (!controller.signal.aborted) setError("Couldn't load the dashboard. Refresh to try again.");
    });
    return () => controller.abort();
  }, [router]);

  return (
    <section aria-labelledby="admin-heading" className="space-y-6">
      <div className="space-y-2">
        <h1 id="admin-heading" className="page-title">Admin dashboard</h1>
        {overview && <p className="text-sm text-ui-sage">{overview.role === "primary_admin" ? "Primary admin" : "Admin"}</p>}
      </div>
      {error && <p role="alert" className="text-sm text-ui-text">{error}</p>}
      {!overview && !error && <p role="status" className="text-sm text-ui-muted">Loading dashboard…</p>}
      {overview && (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ key, label }) => (
            <div key={key} className="rounded-2xl border border-ui-border bg-ui-surface p-5">
              <dt className="text-sm text-ui-muted">{label}</dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums">{overview[key].toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
