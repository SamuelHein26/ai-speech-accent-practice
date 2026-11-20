"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import AuthGuard from "../components/AuthGuard";
import { API_BASE } from "../lib/api";

const tabs = [
  { href: "/dashboard/monologue", label: "Monologue" },
  { href: "/dashboard/accent", label: "Accent Training" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let request: AbortController | undefined;
    const checkRole = () => {
      request?.abort();
      setIsAdmin(false);
      const token = localStorage.getItem("token");
      if (!token) return;
      const controller = new AbortController();
      request = controller;
      void fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) return;
        const { role } = await response.json();
        if (!controller.signal.aborted) setIsAdmin(role === "admin" || role === "primary_admin");
      }).catch(() => {});
    };
    checkRole();
    window.addEventListener("authChange", checkRole);
    window.addEventListener("storage", checkRole);
    return () => {
      request?.abort();
      window.removeEventListener("authChange", checkRole);
      window.removeEventListener("storage", checkRole);
    };
  }, []);

  const visibleTabs = isAdmin ? [...tabs, { href: "/dashboard/admin", label: "Admin" }] : tabs;

  return (
    <AuthGuard>
    <div className="bg-ui-page transition-colors">
      <main className="page-container">
        <div className="space-y-8">
          <nav className="flex justify-center">
            <div className="inline-flex flex-wrap justify-center rounded-2xl border border-ui-border bg-ui-surface p-1 shadow-sm">
              {visibleTabs.map((tab) => {
                const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                      isActive
                        ? "bg-brand-sage/15 text-ui-sage"
                        : "text-ui-muted hover:text-ui-sage hover:bg-brand-sage/5"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {children}
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}
