export default function PrivacyPage() {
  return (
    <main className="page-container">
      <article className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-3"><p className="page-eyebrow">ComfTalk policies</p><h1 className="page-title">Privacy Policy</h1><p className="text-sm text-ui-muted">Last updated: November 1, 2026</p></header>
        <p className="leading-relaxed text-ui-muted">This page explains what information ComfTalk handles when you use the practice features. The exact services and storage settings may vary by deployment.</p>
        <section className="space-y-3"><h2 className="text-xl font-semibold text-ui-text">Information used by the app</h2><p className="leading-relaxed text-ui-muted">If you create an account, ComfTalk stores account details such as your username and email address. Practice sessions can include audio recordings, transcripts, selected accent, scores, feedback, and session details.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold text-ui-text">How practice information is processed</h2><p className="leading-relaxed text-ui-muted">Audio is sent to speech recognition services to produce transcripts and pronunciation results. Monologue transcripts may be sent to the configured language model service to generate topic suggestions and coaching feedback. The app may store recordings and practice results so signed-in users can review their history.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold text-ui-text">Storage and access</h2><p className="leading-relaxed text-ui-muted">Depending on the deployment, practice recordings may be stored in cloud object storage or on the server. Account and practice data are held by the services configured by the operator. Retention periods and deletion procedures depend on that deployment.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold text-ui-text">Your choices</h2><p className="leading-relaxed text-ui-muted">You can choose whether to use the microphone and whether to create an account. Do not include sensitive personal information in your speech practice. For questions about a particular deployment or to request help with your data, contact the person or organization operating that ComfTalk service.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold text-ui-text">Policy changes</h2><p className="leading-relaxed text-ui-muted">This policy may be updated as the app and its integrations change. The date above indicates when this page was last revised.</p></section>
      </article>
    </main>
  );
}
