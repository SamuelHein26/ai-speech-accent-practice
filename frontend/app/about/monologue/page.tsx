import Link from "next/link";

export default function MonologueGuidePage() {
  return (
    <main className="page-container">
      <article className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-4">
          <Link href="/about" className="text-sm font-medium text-ui-accent hover:underline">← About ComfTalk</Link>
          <p className="page-eyebrow">How it works</p>
          <h1 className="page-title">Monologue Mode</h1>
          <p className="text-lg leading-relaxed text-ui-muted">Practise speaking continuously for three minutes, with live transcription and prompts to help you keep going.</p>
        </header>

        <ol className="space-y-8 border-l border-ui-border pl-6">
          <li className="space-y-2"><h2 className="font-semibold text-ui-text">1. Start speaking</h2><p className="leading-relaxed text-ui-muted">Allow microphone access and begin a session. Your speech appears as a live transcript while the session timer tracks your practice.</p></li>
          <li className="space-y-2"><h2 className="font-semibold text-ui-text">2. Follow a prompt when you pause</h2><p className="leading-relaxed text-ui-muted">If you fall quiet, ComfTalk can suggest fresh topics based on what you have said so far. Use a suggestion to continue, or keep speaking about your own subject.</p></li>
          <li className="space-y-2"><h2 className="font-semibold text-ui-text">3. Review your session</h2><p className="leading-relaxed text-ui-muted">When you finish, review the transcript, filler-word count, and generated feedback. Signed-in users can revisit saved sessions from their dashboard.</p></li>
        </ol>

        <section className="space-y-3 border-t border-ui-border pt-8">
          <h2 className="text-xl font-semibold text-ui-text">A helpful way to practise</h2>
          <p className="leading-relaxed text-ui-muted">Choose one idea and explain it in your own words. You do not need to sound perfect; focus on expressing the idea and notice one thing to try differently next time.</p>
          <Link href="/monologue" className="button-primary mt-2">Try Monologue Mode</Link>
        </section>
      </article>
    </main>
  );
}
