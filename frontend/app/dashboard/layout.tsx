"use client";

import Header from "../components/Header";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const tabs = [
  { href: "/dashboard/monologue", label: "Monologue" },
  { href: "/dashboard/accent", label: "Accent training" },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Header />
      <main className="px-4 py-12 flex justify-center">
        <div className="w-full max-w-5xl space-y-8">
          <nav className="flex justify-center">
            <div className="inline-flex rounded-full bg-white/70 backdrop-blur px-1 py-1 shadow dark:bg-gray-900/70 dark:border dark:border-gray-800">
              {tabs.map((tab) => {
                const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                      isActive
                        ? "bg-red-600 text-white shadow"
                        : "text-gray-600 hover:bg-red-50 dark:text-gray-300 dark:hover:bg-gray-800/70"
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
  );
}
