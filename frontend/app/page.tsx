import PracticeLink from "./components/PracticeLink";

const cardClass = "group flex min-h-52 min-w-0 flex-col items-center justify-center rounded-2xl border border-ui-border bg-ui-surface px-3 py-6 text-center shadow-sm transition hover:border-brand-sage/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sage sm:min-h-68 sm:p-10";
const iconClass = "mb-3 flex size-14 items-center justify-center rounded-full bg-brand-sage/10 sm:size-20 dark:bg-brand-sage/15";

export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col justify-center text-ui-text lg:justify-start">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-6 text-center sm:px-6 sm:py-12">
        <header className="mb-5 w-full space-y-2 sm:mb-8">
          <h1 className="mx-auto max-w-3xl text-2xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Speak a little more.<br />
            <span className="text-ui-accent dark:text-brand-primary">Feel a little more confident.</span>
          </h1>
          <p className="text-sm text-ui-muted sm:text-base">Choose a practice mode to get started.</p>
        </header>

        <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:gap-6">
          <PracticeLink
            href="/monologue"
            className={cardClass}
          >
            <div className={iconClass}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                className="size-6 text-ui-accent sm:size-9"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 1.75a3.25 3.25 0 00-3.25 3.25v6a3.25 3.25 0 006.5 0v-6A3.25 3.25 0 0012 1.75zM5 10.25a7 7 0 0014 0M12 17.25v4.5"
                />
              </svg>
            </div>

            <h2 className="mb-2 flex min-h-10 items-center text-sm font-semibold leading-tight transition-colors group-hover:text-ui-sage sm:min-h-0 sm:text-2xl">
              Monologue Mode
            </h2>

            <p className="max-w-xs text-xs leading-relaxed text-ui-muted sm:text-base">
              Speak freely for three minutes with live transcription and topic prompts.
            </p>
          </PracticeLink>

          <PracticeLink
            href="/accent"
            className={cardClass}
          >
            <div className={iconClass}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 87.459 87.459"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="0.8"
                className="size-6 text-ui-accent sm:size-9"
                aria-hidden="true"
              >
                <path d="M37.44,73.283H7.694V55.66C2.787,51.136,0,44.811,0,38.09c0-13.186,10.728-23.913,23.913-23.913 c10.765,0,20.254,7.251,23.074,17.634l0.088,0.32l0.178,3.921l7.217,10.12l-6.344,4.608v3.524c0,4.244-3.453,7.698-7.7,7.698 h-2.985L37.44,73.283L37.44,73.283z M13.694,67.283H31.44V56.004h8.985c0.938,0,1.7-0.763,1.7-1.699v-6.58l4.006-2.91l-4.794-6.72 l-0.227-5.016c-2.214-7.612-9.241-12.9-17.198-12.9c-9.877,0-17.913,8.036-17.913,17.913c0,5.4,2.402,10.458,6.591,13.877 l1.103,0.9L13.694,67.283L13.694,67.283z" />
                <path d="M61.152,56.972L56.91,52.73c2.706-2.707,2.706-7.111-0.001-9.819l4.244-4.242C66.198,43.715,66.198,51.927,61.152,56.972z" />
                <path d="M69.251,63.361l-4.242-4.242c6.229-6.229,6.229-16.366,0-22.596l4.242-4.242C77.818,40.85,77.818,54.793,69.251,63.361z" />
                <path d="M78.555,69.351l-4.244-4.242c9.531-9.533,9.531-25.043,0.002-34.575l4.242-4.242 C90.427,38.161,90.427,57.478,78.555,69.351z" />
              </svg>
            </div>

            <h2 className="mb-2 flex min-h-10 items-center text-sm font-semibold leading-tight transition-colors group-hover:text-ui-sage sm:min-h-0 sm:text-2xl">
              Accent Training
            </h2>

            <p className="max-w-xs text-xs leading-relaxed text-ui-muted sm:text-base">
              Read a short phrase and get feedback on your American or British English.
            </p>
          </PracticeLink>
        </div>
      </div>
    </main>
  );
}
