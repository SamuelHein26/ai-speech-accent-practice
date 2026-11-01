"use client";
import Link from "next/link";

export default function Home() {


  return (
    <main className="page-container text-ui-text">
      {/* Hero Section */}
      <section className="flex flex-col items-center text-center pb-10 pt-4 sm:pb-14 sm:pt-8">
        <p className="page-eyebrow mb-4">A space to find your voice</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Speak a little more.<br /><span className="text-ui-accent dark:text-brand-primary">Feel a little more confident.</span>
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-ui-muted">
          Practise at your own pace with live transcription and thoughtful feedback. Choose a mode and make time for your voice.
        </p>
        <span className="mt-5 rounded-full border border-ui-border bg-ui-surface px-4 py-2 text-xs font-medium text-ui-muted">Try either mode without an account</span>
      </section>

      {/* Options Section */}
      <section className="w-full pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ================= Monologue Mode Tile ================= */}
          <Link
            href="/monologue"
            className="group flex flex-col items-center justify-center p-8 sm:p-10 rounded-3xl border border-ui-border bg-ui-surface hover:border-brand-primary/60 dark:hover:border-brand-primary/60 hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            {/* Tile Icon */}
            <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary/10 dark:bg-brand-secondary/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                className="h-10 w-10 text-ui-accent"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 1.75a3.25 3.25 0 00-3.25 3.25v6a3.25 3.25 0 006.5 0v-6A3.25 3.25 0 0012 1.75zM5 10.25a7 7 0 0014 0M12 17.25v4.5"
                />
              </svg>
            </div>

            {/* Tile Title */}
            <h3 className="text-2xl sm:text-3xl font-bold text-ui-text mb-4 group-hover:text-ui-accent transition-colors">
              Monologue Mode
            </h3>

            {/* Tile Description */}
            <p className="text-base sm:text-lg text-ui-muted text-center max-w-md leading-relaxed">
              Speak freely for <span className="font-semibold text-ui-accent">3 minutes</span>. The AI monitors your flow and suggests fresh topics to keep your practice continuous.
            </p>
          </Link>

          {/* ================= Accent Training Tile ================= */}
          <Link
            href="/accent"
            className="group flex flex-col items-center justify-center p-8 sm:p-10 rounded-3xl border border-ui-border bg-ui-surface hover:border-brand-primary/60 dark:hover:border-brand-primary/60 hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            {/* Tile Icon */}
            <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary/10 dark:bg-brand-secondary/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 87.459 87.459"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="0.8"
                className="h-10 w-10 text-ui-accent"
                role="img"
                aria-label="Person Speaking Icon"
              >
                <path d="M37.44,73.283H7.694V55.66C2.787,51.136,0,44.811,0,38.09c0-13.186,10.728-23.913,23.913-23.913 c10.765,0,20.254,7.251,23.074,17.634l0.088,0.32l0.178,3.921l7.217,10.12l-6.344,4.608v3.524c0,4.244-3.453,7.698-7.7,7.698 h-2.985L37.44,73.283L37.44,73.283z M13.694,67.283H31.44V56.004h8.985c0.938,0,1.7-0.763,1.7-1.699v-6.58l4.006-2.91l-4.794-6.72 l-0.227-5.016c-2.214-7.612-9.241-12.9-17.198-12.9c-9.877,0-17.913,8.036-17.913,17.913c0,5.4,2.402,10.458,6.591,13.877 l1.103,0.9L13.694,67.283L13.694,67.283z" />
                <path d="M61.152,56.972L56.91,52.73c2.706-2.707,2.706-7.111-0.001-9.819l4.244-4.242C66.198,43.715,66.198,51.927,61.152,56.972z" />
                <path d="M69.251,63.361l-4.242-4.242c6.229-6.229,6.229-16.366,0-22.596l4.242-4.242C77.818,40.85,77.818,54.793,69.251,63.361z" />
                <path d="M78.555,69.351l-4.244-4.242c9.531-9.533,9.531-25.043,0.002-34.575l4.242-4.242 C90.427,38.161,90.427,57.478,78.555,69.351z" />
              </svg>
            </div>

            {/* Tile Title */}
            <h3 className="text-2xl sm:text-3xl font-bold text-ui-text mb-4 group-hover:text-ui-accent transition-colors">
              Accent Training
            </h3>

            {/* Tile Description */}
            <p className="text-base sm:text-lg text-ui-muted text-center max-w-md leading-relaxed">
              Read a short phrase, listen back, and explore <span className="font-semibold text-ui-accent">word-by-word feedback</span> on your American or British English practice.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
