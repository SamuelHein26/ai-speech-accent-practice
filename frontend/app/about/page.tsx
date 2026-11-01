"use client";

export default function About() {
  return (
    <div className="w-full bg-ui-page transition-colors">
      <main className="page-container">
        <div className="mx-auto max-w-4xl bg-ui-surface shadow-sm rounded-3xl p-6 sm:p-10 border border-ui-border space-y-8">
          <header className="text-center space-y-2">
            <p className="page-eyebrow">Made for everyday practice</p>
            <h1 className="page-title">
              About ComfTalk
            </h1>
            <p className="text-sm text-ui-muted">
              AI Speech & Accent Practice Platform
            </p>
          </header>

          <div className="space-y-6 text-ui-text text-lg leading-relaxed">
            <p>
              <span className="font-semibold text-ui-accent">ComfTalk</span> is an intelligent, web-based platform engineered to help
              English learners enhance their pronunciation, conversational flow, and speaking confidence. 
              Through real-time <span className="font-medium text-ui-text">streaming speech recognition</span> and
              <span className="font-medium text-ui-text"> AI feedback analytics</span>, users engage in realistic
              practice sessions with instant, objective evaluation of clarity and cadence.
            </p>
            <p>
              The platform addresses the growing need for personalized English-speaking 
              coaching in global contexts — from job interviews and academic presentations to 
              multinational team collaboration. By emphasizing active spoken production rather than 
              passive grammar drills, ComfTalk helps{" "}
              <span className="text-ui-accent font-medium">
                bridge the gap between accuracy and authenticity in natural speech
              </span>.
            </p>
            <p>
              Featuring adaptive silence-prompting in <span className="font-semibold text-ui-text">Monologue Mode</span> and
              phonetic rule-based evaluations in <span className="font-semibold text-ui-text">Accent Training Mode</span>,
              ComfTalk empowers speakers to build confidence through repeatable, measurable practice.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
