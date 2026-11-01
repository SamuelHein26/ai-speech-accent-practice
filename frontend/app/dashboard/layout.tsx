"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AuthGuard from "../components/AuthGuard";

const tabs = [
  { href: "/dashboard/monologue", label: "Monologue" },
  { href: "/dashboard/accent", label: "Accent Training" },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthGuard>
    <div className="bg-ui-page transition-colors">
      <main className="page-container">
        <div className="space-y-8">
          <nav className="flex justify-center">
            <div className="inline-flex rounded-full border border-ui-border bg-ui-surface p-1 shadow-sm">
              {tabs.map((tab) => {
                const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                      isActive
                        ? "bg-brand-secondary text-ui-on-brand shadow"
                        : "text-ui-muted hover:text-ui-accent hover:bg-ui-surface-muted"
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
