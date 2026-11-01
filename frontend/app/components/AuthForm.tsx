"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { API_BASE } from "../lib/api";
import { safeReturnTo } from "../lib/auth";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("next"));
  const alternateHref = `${registering ? "/login" : "/register"}?next=${encodeURIComponent(returnTo)}`;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}${registering ? "/users/register" : "/login"}`, {
        method: "POST",
        headers: { "Content-Type": registering ? "application/json" : "application/x-www-form-urlencoded" },
        body: registering
          ? JSON.stringify({ username: username.trim(), email: email.trim(), password })
          : new URLSearchParams({ username: username.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "We couldn’t complete your request. Please try again.");
      if (typeof data.access_token !== "string" || !data.access_token) throw new Error("Sign-in was incomplete. Please try again.");
      localStorage.setItem("token", data.access_token);
      window.dispatchEvent(new Event("authChange"));
      router.replace(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-container">
      <div className="mx-auto max-w-md rounded-3xl border border-ui-border bg-ui-surface p-6 shadow-sm sm:p-9">
        <section aria-labelledby="auth-heading">
          <p className="page-eyebrow">{registering ? "Get started" : "Welcome back"}</p>
          <h1 id="auth-heading" className="page-title mt-3">{registering ? "Create your account" : "Log in to ComfTalk"}</h1>
          <p className="mt-3 text-sm leading-relaxed text-ui-muted">{registering ? "Make room for a regular speaking habit." : "Pick up where you left off. Your next practice starts here."}</p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-5" aria-busy={loading}>
            <fieldset disabled={loading} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="auth-username" className="form-label">{registering ? "Username" : "Email or username"}</label>
                <input id="auth-username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} required className="form-input" />
              </div>
              {registering && <div className="space-y-2">
                <label htmlFor="auth-email" className="form-label">Email address</label>
                <input id="auth-email" name="email" type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} required className="form-input" />
              </div>}
              <div className="space-y-2">
                <label htmlFor="auth-password" className="form-label">Password</label>
                <div className="relative">
                  <input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required className="form-input pr-20" aria-describedby={error ? "auth-error" : undefined} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-1 rounded-lg px-3 text-sm font-medium text-ui-muted hover:text-ui-text focus-visible:outline-2 focus-visible:outline-brand-primary">{showPassword ? "Hide" : "Show"}</button>
                </div>
              </div>
            </fieldset>
            {error && <p id="auth-error" role="alert" className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 p-3 text-sm text-ui-text">{error}</p>}
            <button type="submit" disabled={loading} className="button-primary w-full">{loading ? (registering ? "Creating account…" : "Logging in…") : (registering ? "Create account" : "Log in")}</button>
          </form>
          <p className="mt-6 text-center text-sm text-ui-muted">{registering ? "Already have an account?" : "New to ComfTalk?"}{" "}<Link href={alternateHref} className="font-semibold text-ui-accent underline-offset-4 hover:underline dark:text-brand-primary">{registering ? "Log in" : "Create an account"}</Link></p>
          <Link href="/" className="mt-6 block text-center text-sm text-ui-muted underline-offset-4 hover:text-ui-text hover:underline">Back to practice</Link>
        </section>
      </div>
    </main>
  );
}
