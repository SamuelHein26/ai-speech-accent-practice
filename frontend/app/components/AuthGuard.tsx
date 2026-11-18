"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginHref } from "../lib/auth";
import { API_BASE } from "../lib/api";
import PracticeSignInDialog from "./PracticeSignInDialog";

export default function AuthGuard({
  children,
  verifyOnEntry = false,
}: { children: ReactNode; verifyOnEntry?: boolean }) {
  const [ready, setReady] = useState(false);
  const [signInPath, setSignInPath] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState(false);
  const [retry, setRetry] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let checkedToken: string | null = null;
    let request: AbortController | undefined;
    const check = () => {
      const token = localStorage.getItem("token");
      if (!token) {
        request?.abort();
        checkedToken = null;
        setReady(false);
        setVerificationError(false);
        const returnTo = pathname + window.location.search;
        if (verifyOnEntry) setSignInPath(returnTo);
        else router.replace(loginHref(returnTo));
        return;
      }
      setSignInPath(null);
      if (!verifyOnEntry) {
        setReady(true);
        return;
      }
      if (checkedToken === token) return;
      checkedToken = token;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      setReady(false);
      setVerificationError(false);
      void fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then((response) => {
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          if (localStorage.getItem("token") === token) {
            localStorage.removeItem("token");
            window.dispatchEvent(new Event("authChange"));
          }
          return;
        }
        if (!response.ok) throw new Error("Unable to verify sign-in");
        setReady(true);
      }).catch(() => {
        if (!controller.signal.aborted) setVerificationError(true);
      });
    };
    check();
    window.addEventListener("authChange", check);
    window.addEventListener("storage", check);
    window.addEventListener("focus", check);
    return () => {
      request?.abort();
      window.removeEventListener("authChange", check);
      window.removeEventListener("storage", check);
      window.removeEventListener("focus", check);
    };
  }, [pathname, router, verifyOnEntry, retry]);

  if (signInPath) return (
    <PracticeSignInDialog returnTo={signInPath} onDismiss={() => router.replace("/")} />
  );
  if (verificationError) return (
    <div className="page-container space-y-3 text-center">
      <p role="alert">Couldn’t verify your sign-in. Try again to start practising.</p>
      <button type="button" className="button-primary" onClick={() => setRetry((value) => value + 1)}>Try again</button>
    </div>
  );
  if (!ready) return <p className="page-container text-center text-ui-muted" role="status">Opening your account…</p>;
  return children;
}
