"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import PracticeSignInDialog from "./PracticeSignInDialog";

export default function PracticeLink({ href, className, children }: {
  href: "/monologue" | "/accent";
  className: string;
  children: ReactNode;
}) {
  const [prompt, setPrompt] = useState(false);

  return (
    <>
      <Link
        href={href}
        className={className}
        onNavigate={(event) => {
          if (!localStorage.getItem("token")) {
            event.preventDefault();
            setPrompt(true);
          }
        }}
      >
        {children}
      </Link>
      {prompt && <PracticeSignInDialog returnTo={href} onDismiss={() => setPrompt(false)} />}
    </>
  );
}
