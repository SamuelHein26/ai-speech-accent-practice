"use client";
import Header from "../components/Header";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-800 transition-colors">
      <Header />
      <main className="flex-1 flex flex-col items-center px-4 py-16">
        <div className="w-full max-w-4xl bg-white dark:bg-gray-900 shadow-xl rounded-3xl p-8 sm:p-12 border border-gray-200 dark:border-gray-700 space-y-8">
          <header className="text-center space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-red-400 tracking-tight">
              About ComfTalk
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              AI Speech & Accent Practice Platform
            </p>
          </header>

          <div className="space-y-6 text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
            <p>
              <span className="font-semibold text-red-400">ComfTalk</span> is an intelligent, web-based platform engineered to help 
              English learners enhance their pronunciation, conversational flow, and speaking confidence. 
              Through real-time <span className="font-medium text-gray-900 dark:text-gray-100">streaming speech recognition</span> and 
              <span className="font-medium text-gray-900 dark:text-gray-100"> AI feedback analytics</span>, users engage in realistic 
              practice sessions with instant, objective evaluation of clarity and cadence.
            </p>
            <p>
              The platform addresses the growing need for personalized English-speaking 
              coaching in global contexts — from job interviews and academic presentations to 
              multinational team collaboration. By emphasizing active spoken production rather than 
              passive grammar drills, ComfTalk helps{" "}
              <span className="text-red-400 font-medium">
                bridge the gap between accuracy and authenticity in natural speech
              </span>.
            </p>
            <p>
              Featuring adaptive silence-prompting in <span className="font-semibold text-gray-900 dark:text-gray-100">Monologue Mode</span> and 
              phonetic rule-based evaluations in <span className="font-semibold text-gray-900 dark:text-gray-100">Accent Training Mode</span>, 
              ComfTalk empowers speakers to build confidence through repeatable, measurable practice.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
