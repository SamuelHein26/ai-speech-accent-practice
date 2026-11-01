import Link from "next/link";

export default function AccentGuidePage() {
  return (
    <main className="page-container">
      <article className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-4">
          <p className="page-eyebrow">How it works</p>
          <h1 className="page-title">Accent Training</h1>
          <p className="text-lg leading-relaxed text-ui-muted">Practise a short phrase against an American or British English target and get feedback on how clearly each word was recognised.</p>
        </header>

        <ol className="space-y-8 border-l border-ui-border pl-6">
          <li className="space-y-2"><h2 className="font-semibold text-ui-text">1. Choose a target accent</h2><p className="leading-relaxed text-ui-muted">Select American English or British English. You can switch targets whenever you like.</p></li>
          <li className="space-y-2"><h2 className="font-semibold text-ui-text">2. Read the phrase aloud</h2><p className="leading-relaxed text-ui-muted">Use the displayed phrase as your prompt, then record a short attempt. You can refresh the phrase to practise something new.</p></li>
          <li className="space-y-2"><h2 className="font-semibold text-ui-text">3. Review and listen back</h2><p className="leading-relaxed text-ui-muted">See a clarity score, word-by-word results, and a coaching tip. Words that may need attention are highlighted. Replay your recording and try again.</p></li>
        </ol>

        <section className="space-y-3 border-t border-ui-border pt-8">
          <h2 className="text-xl font-semibold text-ui-text">Use feedback as a guide</h2>
          <p className="leading-relaxed text-ui-muted">Speech recognition can miss words or interpret pronunciation differently. Treat each score as a practice aid, listen to your recording, and focus on patterns across attempts.</p>
          <Link href="/accent" className="button-primary mt-2">Try Accent Training</Link>
        </section>
      </article>
    </main>
  );
}
