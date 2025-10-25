"use client";

import { useMemo, useState } from "react";
import Header from "../components/Header";

type TrainingMode = {
  id: string;
  label: string;
  summary: string;
  focus: string[];
  cta: string;
};

type Drill = {
  title: string;
  description: string;
  duration: string;
  category: "Warm-up" | "Intonation" | "Pronunciation" | "Flow";
};

const TRAINING_MODES: TrainingMode[] = [
  {
    id: "guided",
    label: "Guided Practice",
    summary:
      "Follow a structured 20-minute routine that walks you through warm-ups, targeted drills, and reflection prompts.",
    focus: ["Daily routine", "Step-by-step coaching", "Progress logging"],
    cta: "Launch guided mode",
  },
  {
    id: "targeted",
    label: "Accent Focus",
    summary:
      "Pick the elements you want to improve today—intonation, rhythm, vowel shaping—and receive matching drills.",
    focus: ["Customized drills", "Repeat after coach", "Instant transcript"],
    cta: "Start targeted session",
  },
  {
    id: "conversation",
    label: "Conversation Lab",
    summary:
      "Simulate real dialogues with AI prompts. Practice turn taking, natural pauses, and emphasis in context.",
    focus: ["Role-play", "Adaptive prompts", "Feedback summaries"],
    cta: "Open conversation lab",
  },
];

const DRILLS: Drill[] = [
  {
    title: "Breath & Resonance",
    description: "3 minutes of humming and diaphragm engagement to warm up your speaking voice.",
    duration: "3 min",
    category: "Warm-up",
  },
  {
    title: "Pitch Contours",
    description: "Shadow rising and falling questions while tracking your intonation curve on screen.",
    duration: "5 min",
    category: "Intonation",
  },
  {
    title: "Vowel Precision",
    description: "Contrast minimal pairs to sharpen mouth placement and vowel length.",
    duration: "4 min",
    category: "Pronunciation",
  },
  {
    title: "Rhythm & Linking",
    description: "Practice connected speech by linking phrases and reducing filler syllables.",
    duration: "6 min",
    category: "Flow",
  },
];

export default function AccentPage() {
  const [selectedMode, setSelectedMode] = useState<string>(TRAINING_MODES[0].id);

  const modeDetails = useMemo(
    () => TRAINING_MODES.find((mode) => mode.id === selectedMode) ?? TRAINING_MODES[0],
    [selectedMode]
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-red-50 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <Header />
      <main className="flex-1 px-4 py-12 flex justify-center">
        <div className="w-full max-w-6xl space-y-12">
          <section className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr] items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-300">
                Accent training mode
              </span>
              <h1 className="text-4xl sm:text-5xl font-semibold text-red-700 dark:text-red-300 leading-tight">
                Build confident speech patterns with dedicated accent coaching
              </h1>
              <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 max-w-2xl">
                Choose the practice flow that matches your goals, record guided drills, and compare your accent to model
                audio in real time. Accent mode stitches together every tool you need for consistent improvement.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-gray-700 dark:text-gray-300">
                {["Realtime feedback", "Adaptive drills", "Progress snapshots"].map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 bg-white/80 dark:bg-gray-900/60"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-red-200/40 via-white to-red-100/30 dark:from-red-500/20 dark:via-gray-900 dark:to-red-600/10 blur-3xl" />
              <div className="relative rounded-3xl border border-red-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/70 backdrop-blur-md shadow-xl p-8 space-y-6">
                <h2 className="text-xl font-semibold text-red-600 dark:text-red-300">Daily practice snapshot</h2>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-2xl bg-red-50 dark:bg-red-900/30 p-4 border border-red-100 dark:border-red-500/30">
                    <dt className="uppercase text-xs tracking-wide text-red-500 dark:text-red-300">Streak</dt>
                    <dd className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-200">5 days</dd>
                  </div>
                  <div className="rounded-2xl bg-red-50 dark:bg-red-900/30 p-4 border border-red-100 dark:border-red-500/30">
                    <dt className="uppercase text-xs tracking-wide text-red-500 dark:text-red-300">Focus</dt>
                    <dd className="mt-1 text-sm font-medium">Intonation &amp; flow</dd>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-700 col-span-2">
                    <dt className="uppercase text-xs tracking-wide text-gray-500 dark:text-gray-400">Next action</dt>
                    <dd className="mt-1 text-sm font-medium">Complete pitch contour drill &amp; upload a reflection clip.</dd>
                  </div>
                </dl>
                <button className="w-full rounded-2xl bg-red-600 text-white font-semibold py-3 hover:bg-red-700 transition">
                  Continue practice session
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-900 rounded-3xl border border-red-100 dark:border-gray-800 shadow-lg p-8 space-y-8">
            <header className="space-y-2">
              <h2 className="text-2xl font-semibold text-red-600 dark:text-red-300">Select your training mode</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Switch between guided flows depending on whether you want structure, targeted drills, or conversation
                practice.
              </p>
            </header>
            <div className="flex flex-wrap gap-3">
              {TRAINING_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`rounded-2xl border px-5 py-3 text-left transition shadow-sm ${
                    mode.id === modeDetails.id
                      ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/20 dark:text-red-200"
                      : "border-gray-200 bg-white/70 text-gray-700 hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300"
                  }`}
                >
                  <span className="block text-sm font-semibold">{mode.label}</span>
                  <span className="block text-xs text-gray-600 dark:text-gray-400 mt-1">{mode.summary}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-[1fr,0.8fr]">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">What to expect</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{modeDetails.summary}</p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {modeDetails.focus.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-dashed border-red-200 dark:border-red-500/40 bg-red-50/60 dark:bg-red-900/10 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-300">Ready to start?</h3>
                <p className="text-sm text-red-700 dark:text-red-200">
                  Launch the mode to open the recorder, transcript feedback, and drill queue tailored to your focus.
                </p>
                <button className="w-full rounded-xl bg-red-600 text-white font-semibold py-3 hover:bg-red-700 transition">
                  {modeDetails.cta}
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr,0.8fr]">
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-red-100 dark:border-gray-800 shadow-lg p-8 space-y-6">
              <header className="space-y-2">
                <h2 className="text-2xl font-semibold text-red-600 dark:text-red-300">Core drills</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Mix and match these exercises inside any mode to balance clarity, rhythm, and expressiveness.
                </p>
              </header>
              <div className="space-y-4">
                {DRILLS.map((drill) => (
                  <article
                    key={drill.title}
                    className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-300">
                        {drill.category}
                      </span>
                      <h3 className="mt-1 text-lg font-semibold text-gray-800 dark:text-gray-100">{drill.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">{drill.description}</p>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1">{drill.duration}</span>
                      <button className="rounded-xl bg-red-600 text-white font-medium px-4 py-2 hover:bg-red-700 transition">
                        Queue drill
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="bg-white dark:bg-gray-900 rounded-3xl border border-red-100 dark:border-gray-800 shadow-lg p-8 space-y-6">
              <header className="space-y-2">
                <h2 className="text-2xl font-semibold text-red-600 dark:text-red-300">Session roadmap</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Keep each practice aligned to tangible milestones.
                </p>
              </header>
              <ol className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-3">
                  <span className="mt-1 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-semibold">
                    1
                  </span>
                  <div>
                    <h3 className="font-semibold">Record your target phrase</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Upload a short script or pick from our library to anchor today’s drills.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-semibold">
                    2
                  </span>
                  <div>
                    <h3 className="font-semibold">Analyze feedback</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Compare pronunciation, pitch, and timing heatmaps against the model speaker.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-semibold">
                    3
                  </span>
                  <div>
                    <h3 className="font-semibold">Refine &amp; reflect</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Re-record key sentences, jot down notes, and save milestones to your profile.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Need inspiration?</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Try recording a news excerpt, movie dialogue, or personal introduction. Accent mode adapts feedback to
                  your chosen context.
                </p>
                <button className="w-full rounded-lg bg-red-600 text-white font-semibold py-2 hover:bg-red-700 transition">
                  Browse scripts
                </button>
              </div>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}
