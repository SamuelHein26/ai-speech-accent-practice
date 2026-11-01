import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="page-container">
      <article className="mx-auto max-w-3xl space-y-12">
        <header className="space-y-4">
          <p className="page-eyebrow">Made for everyday practice</p>
          <h1 className="page-title">About ComfTalk</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-ui-muted">
            ComfTalk is a place to practise spoken English at your own pace, build confidence, and get useful feedback from each attempt.
          </p>
        </header>

        <section className="space-y-4 border-t border-ui-border pt-8">
          <h2 className="text-xl font-semibold text-ui-text">Practice that fits your goal</h2>
          <p className="leading-relaxed text-ui-muted">
            Use Monologue Mode to speak freely and work on keeping a thought going. Choose Accent Training to practise a short phrase and review word-level pronunciation feedback for American or British English.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1 text-sm font-semibold">
            <Link href="/about/monologue" className="text-ui-accent hover:underline">How Monologue Mode works →</Link>
            <Link href="/about/accent" className="text-ui-accent hover:underline">How Accent Training works →</Link>
          </div>
        </section>

        <section className="space-y-4 border-t border-ui-border pt-8">
          <h2 className="text-xl font-semibold text-ui-text">A little practice goes a long way</h2>
          <p className="leading-relaxed text-ui-muted">
            ComfTalk is designed to make speaking practice easy to repeat. Start a session, listen to your own voice, and use each result to decide what you want to work on next.
          </p>
          <Link href="/" className="inline-flex pt-1 text-sm font-semibold text-ui-accent hover:underline">Choose a practice mode →</Link>
        </section>
      </article>
    </main>
  );
}
