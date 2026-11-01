"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginHref } from "../lib/auth";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const check = () => {
      if (!localStorage.getItem("token")) {
        setReady(false);
        router.replace(loginHref(pathname + window.location.search));
      } else setReady(true);
    };
    check();
    window.addEventListener("authChange", check);
    window.addEventListener("storage", check);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("authChange", check);
      window.removeEventListener("storage", check);
      window.removeEventListener("focus", check);
    };
  }, [pathname, router]);

  if (!ready) return <p className="page-container text-center text-ui-muted" role="status">Opening your account…</p>;
  return children;
}
