"use client";

import Header from "../components/Header";

export default function AccentPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 transition-colors">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center space-y-4">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Accent training mode</h1>
        <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">
          A refreshed accent training experience is on the way. We&apos;ll publish the new layout here soon.
        </p>
      </main>
    </div>
  );
}
