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

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setIsProfileOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
        setIsMenuOpen(false);
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
      : "text-ui-text hover:text-ui-accent";

  return (
    <header className="relative z-40 w-full border-b border-ui-border bg-ui-surface transition-colors">
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

      <nav className="hidden md:flex items-center space-x-6">
        <Link
          href="/monologue"
          className={`flex items-center gap-2 font-medium transition pb-1 ${getActiveClass("/monologue")}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 1.75a3.25 3.25 0 00-3.25 3.25v6a3.25 3.25 0 006.5 0v-6A3.25 3.25 0 0012 1.75zM5 10.25a7 7 0 0014 0M12 17.25v4.5"
            />
          </svg>
          <span>Monologue</span>
        </Link>

        <Link
          href="/accent"
          className={`flex items-center gap-2 font-medium transition pb-1 ${getActiveClass("/accent")}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 87.459 87.459"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.8"
            className="h-5 w-5"
          >
            <path d="M37.44,73.283H7.694V55.66C2.787,51.136,0,44.811,0,38.09c0-13.186,10.728-23.913,23.913-23.913 c10.765,0,20.254,7.251,23.074,17.634l0.088,0.32l0.178,3.921l7.217,10.12l-6.344,4.608v3.524c0,4.244-3.453,7.698-7.7,7.698 h-2.985L37.44,73.283z" />
            <path d="M61.152,56.972L56.91,52.73c2.706-2.707,2.706-7.111-0.001-9.819l4.244-4.242C66.198,43.715,66.198,51.927,61.152,56.972z" />
            <path d="M69.251,63.361l-4.242-4.242c6.229-6.229,6.229-16.366,0-22.596l4.242-4.242C77.818,40.85,77.818,54.793,69.251,63.361z" />
            <path d="M78.555,69.351l-4.244-4.242c9.531-9.533,9.531-25.043,0.002-34.575l4.242-4.242 C90.427,38.161,90.427,57.478,78.555,69.351z" />
          </svg>
          <span>Accent Training</span>
        </Link>

        <Link href="/about" className={`${getActiveClass("/about")} font-medium transition pb-1`}>
          About
        </Link>
      </nav>

      <div className="flex items-center space-x-4 relative" ref={profileRef}>
        <ThemeToggle />

        {isLoggedIn ? (
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              aria-expanded={isProfileOpen}
              className="focus:outline-none bg-brand-secondary hover:bg-brand-secondary/90 text-ui-on-brand font-medium rounded-full px-4 py-2.5 text-sm transition cursor-pointer"
            >
              Profile
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-ui-surface shadow-lg rounded-lg z-50">
                <button
                  onClick={() => { setIsProfileOpen(false); router.push("/profile"); }}
                  className="block w-full text-left px-4 py-2 text-ui-text hover:bg-brand-primary/10 transition"
                >
                  View Profile
                </button>
                <button
                  onClick={() => { setIsProfileOpen(false); router.push("/dashboard"); }}
                  className="block w-full text-left px-4 py-2 text-ui-text hover:bg-brand-primary/10 transition"
                >
                  Dashboard
                </button>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-ui-accent hover:bg-brand-primary/10 transition"
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
          className="md:hidden p-2 rounded-lg hover:bg-brand-primary/10 transition"
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
        <div className="md:hidden">
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
                className="rounded-lg p-2 text-ui-text transition hover:bg-ui-surface-muted"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {["/monologue", "/accent", "/about"].map((path) => (
                <Link
                  key={path}
                  href={path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`rounded-xl px-4 py-3 text-base font-medium transition ${
                    pathname === path
                      ? "bg-brand-primary/10 text-ui-accent"
                      : "text-ui-text hover:bg-ui-surface-muted hover:text-ui-accent"
                  }`}
                >
                  {path === "/monologue"
                    ? "Monologue"
                    : path === "/accent"
                    ? "Accent Training"
                    : "About"}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}

    </header>
  );
}
