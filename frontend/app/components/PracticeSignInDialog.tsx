"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { loginHref } from "../lib/auth";

export default function PracticeSignInDialog({
  returnTo,
  onDismiss,
}: {
  returnTo: string;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onDismiss}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="m-auto w-11/12 max-w-sm rounded-2xl border border-ui-border bg-ui-surface p-6 text-ui-text shadow-xl backdrop:bg-black/50"
    >
      <h2 id={titleId} className="text-xl font-semibold">Log in to practise</h2>
      <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-ui-muted">
        You need to log in to use this practice mode.
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <form method="dialog">
          <button type="submit" className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-sage/10">
            Cancel
          </button>
        </form>
        <Link href={loginHref(returnTo)} className="button-primary">Log in</Link>
      </div>
    </dialog>
  );
}
