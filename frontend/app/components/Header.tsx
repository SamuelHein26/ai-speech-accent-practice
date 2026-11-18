"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { loginHref } from "../lib/auth";
import ThemeToggle from "./ThemeToggle";
import { useRouter, usePathname } from "next/navigation";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const profileRef = useRef<HTMLDivElement | null>(null);
  const desktopGuideRef = useRef<HTMLDetailsElement | null>(null);
  const mobileGuideRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setIsProfileOpen(false);
      for (const ref of [desktopGuideRef, mobileGuideRef]) {
        if (ref.current && !ref.current.contains(event.target as Node)) {
          ref.current.open = false;
        }
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
        setIsMenuOpen(false);
        if (desktopGuideRef.current) desktopGuideRef.current.open = false;
        if (mobileGuideRef.current) mobileGuideRef.current.open = false;
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    const checkToken = () => setIsLoggedIn(!!localStorage.getItem("token"));
    checkToken();

    window.addEventListener("authChange", checkToken);
    window.addEventListener("storage", checkToken);
    window.addEventListener("focus", checkToken);
    return () => {
      window.removeEventListener("authChange", checkToken);
      window.removeEventListener("storage", checkToken);
      window.removeEventListener("focus", checkToken);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("authChange"));
    setIsProfileOpen(false);
    router.push("/");
  };

  const getActiveClass = (path: string): string =>
    pathname === path
      ? "text-ui-accent border-b-2 border-brand-secondary"
      : "text-ui-text hover:text-ui-sage";

  return (
    <header className="relative z-40 w-full bg-ui-surface transition-colors">
      <div className="mx-auto flex items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
      <Link href="/" aria-label="ComfTalk home" onClick={() => setIsMenuOpen(false)} className="shrink-0">
        <Image
          src="/Logo_light.png"
          alt="ComfTalk"
          width={860}
          height={270}
          priority
          className="h-auto w-28 sm:w-32 dark:hidden"
        />
        <Image
          src="/Logo_dark.png"
          alt="ComfTalk"
          width={860}
          height={270}
          priority
          className="hidden h-auto w-28 sm:w-32 dark:block"
        />
      </Link>

      <nav className="hidden shrink-0 items-center space-x-6 whitespace-nowrap lg:flex">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={`font-medium transition pb-1 ${getActiveClass("/")}`}>
          Home
        </Link>

        <Link href="/about" aria-current={pathname === "/about" ? "page" : undefined} className={`flex items-center gap-2 font-medium transition pb-1 ${getActiveClass("/about")}`}>
          About ComfTalk
        </Link>

        <details ref={desktopGuideRef} className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-1 pb-1 font-medium text-ui-text transition hover:text-ui-sage">
            How it works
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition group-open:rotate-180"><path fillRule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
          </summary>
          <div className="absolute right-0 top-full z-50 mt-3 w-56 rounded-xl border border-ui-border bg-ui-surface p-2 shadow-xl">
            <Link href="/about/monologue" aria-current={pathname === "/about/monologue" ? "page" : undefined} className="block rounded-lg px-3 py-2 text-sm text-ui-text transition hover:bg-brand-sage/10 hover:text-ui-sage">Monologue guide</Link>
            <Link href="/about/accent" aria-current={pathname === "/about/accent" ? "page" : undefined} className="block rounded-lg px-3 py-2 text-sm text-ui-text transition hover:bg-brand-sage/10 hover:text-ui-sage">Accent Training guide</Link>
          </div>
        </details>


      </nav>

      <div className="flex items-center space-x-4 relative" ref={profileRef}>
        <ThemeToggle />

        {isLoggedIn ? (
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              aria-expanded={isProfileOpen}
              className="focus:outline-none bg-brand-secondary hover:bg-brand-sage hover:text-brand-on-sage text-ui-on-brand font-medium rounded-full px-4 py-2.5 text-sm transition cursor-pointer"
            >
              Profile
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-ui-surface shadow-lg rounded-lg z-50">
                <button
                  onClick={() => { setIsProfileOpen(false); router.push("/profile"); }}
                  className="block w-full text-left px-4 py-2 text-ui-text hover:bg-brand-sage/10 transition"
                >
                  View Profile
                </button>
                <button
                  onClick={() => { setIsProfileOpen(false); router.push("/dashboard"); }}
                  className="block w-full text-left px-4 py-2 text-ui-text hover:bg-brand-sage/10 transition"
                >
                  Dashboard
                </button>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-ui-accent hover:bg-brand-sage/10 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href={loginHref(pathname === "/" ? "/dashboard" : pathname)}
            onClick={() => setIsMenuOpen(false)}
            className="button-primary whitespace-nowrap"
          >
            Log in
          </Link>
        )}

        <button
          className="lg:hidden p-2 rounded-lg hover:bg-brand-sage/10 transition"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle Menu"
          aria-expanded={isMenuOpen}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-6 w-6 text-ui-accent"
          >
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      </div>
      {isMenuOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 z-50 bg-black/40"
          />
          <nav
            aria-label="Mobile navigation"
            className="fixed inset-y-0 right-0 z-[60] flex w-80 max-w-[85vw] flex-col border-l border-ui-border bg-ui-surface p-6 shadow-2xl animate-slideInRight"
          >
            <div className="mb-8 flex items-center justify-between">
              <span className="text-lg font-semibold text-ui-text">Menu</span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setIsMenuOpen(false)}
                className="rounded-lg p-2 text-ui-text transition hover:bg-brand-sage/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {[{ path: "/", label: "Home" }, { path: "/about", label: "About ComfTalk" }].map(({ path, label }) => (
                <Link
                  key={path}
                  href={path}
                  aria-current={pathname === path ? "page" : undefined}
                  onClick={() => setIsMenuOpen(false)}
                  className={`rounded-xl px-4 py-3 text-base font-medium transition ${
                    pathname === path
                      ? "bg-brand-primary/10 text-ui-accent"
                      : "text-ui-text hover:bg-brand-sage/10 hover:text-ui-sage"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
            <details ref={mobileGuideRef} className="mt-5 border-t border-ui-border pt-4">
              <summary className="cursor-pointer list-none px-4 py-2 font-semibold text-ui-text">How it works</summary>
              <div className="mt-1 flex flex-col gap-1 pl-3">
                <Link href="/about/monologue" aria-current={pathname === "/about/monologue" ? "page" : undefined} onClick={() => setIsMenuOpen(false)} className="rounded-lg px-4 py-2 text-sm text-ui-muted transition hover:bg-brand-sage/10 hover:text-ui-sage">Monologue guide</Link>
                <Link href="/about/accent" aria-current={pathname === "/about/accent" ? "page" : undefined} onClick={() => setIsMenuOpen(false)} className="rounded-lg px-4 py-2 text-sm text-ui-muted transition hover:bg-brand-sage/10 hover:text-ui-sage">Accent Training guide</Link>
              </div>
            </details>
          </nav>
        </div>
      )}

    </header>
  );
}
