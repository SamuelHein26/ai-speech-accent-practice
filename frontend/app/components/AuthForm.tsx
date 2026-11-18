"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { API_BASE } from "../lib/api";
import { safeReturnTo } from "../lib/auth";

function getRegistrationEmailError(email: string, typeMismatch: boolean) {
  if (!email) return "Enter your email address.";
  if (typeMismatch || !email.slice(email.lastIndexOf("@") + 1).includes(".")) {
    return "Enter a valid email address.";
  }
  if (Array.from(email).length > 150) return "Email address must be 150 characters or fewer.";
  return null;
}

function getRegistrationPasswordError(password: string) {
  if (Array.from(password).length < 12 || !password.trim()) {
    return "Use at least 12 characters for your password. It cannot be all whitespace.";
  }
  if (new TextEncoder().encode(password).length > 72) {
    return "Password is too long. Use up to 72 bytes. Some characters take more than one byte.";
  }
  if (password.includes("\0")) return "Password contains an unsupported character.";
  return null;
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("next"));
  const alternateHref = `${registering ? "/login" : "/register"}?next=${encodeURIComponent(returnTo)}`;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showEmailFeedback, setShowEmailFeedback] = useState(false);
  const [showPasswordFeedback, setShowPasswordFeedback] = useState(false);
  const [showConfirmationFeedback, setShowConfirmationFeedback] = useState(false);
  const [emailTypeMismatch, setEmailTypeMismatch] = useState(false);
  const [serverEmailError, setServerEmailError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const registrationEmail = email.trim();
  const emailError = registering ? getRegistrationEmailError(registrationEmail, emailTypeMismatch) : null;
  const passwordError = registering ? getRegistrationPasswordError(password) : null;
  const confirmationError = !passwordConfirmation
    ? "Retype your password."
    : passwordConfirmation !== password
      ? "Passwords do not match."
      : null;
  const emailFeedbackError = emailError ?? serverEmailError;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    if (registering) {
      setShowEmailFeedback(true);
      setShowPasswordFeedback(true);
      setShowConfirmationFeedback(true);
      if (emailError || passwordError || confirmationError) return;
      setServerEmailError(null);
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}${registering ? "/users/register" : "/login"}`, {
        method: "POST",
        headers: { "Content-Type": registering ? "application/json" : "application/x-www-form-urlencoded" },
        body: registering
          ? JSON.stringify({ username: username.trim(), email: registrationEmail, password })
          : new URLSearchParams({ username: username.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const invalidEmail = registering && Array.isArray(data.detail) &&
          data.detail.some((issue: { loc?: string[] }) => issue.loc?.includes("email"));
        if (invalidEmail) {
          setServerEmailError("Enter a valid email address.");
          return;
        }
        throw new Error(typeof data.detail === "string" ? data.detail : "We couldn’t complete your request. Please try again.");
      }
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
      <div className="mx-auto max-w-lg rounded-3xl border border-ui-border bg-ui-surface p-6 shadow-sm sm:p-9">
        <section aria-labelledby="auth-heading">
          <p className="page-eyebrow">{registering ? "Get started" : "Welcome back"}</p>
          <h1 id="auth-heading" className="page-title mt-3">{registering ? "Create your account" : "Log in to ComfTalk"}</h1>
          <form onSubmit={handleSubmit} className="mt-7 space-y-5" aria-busy={loading}>
            <fieldset disabled={loading} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="auth-username" className="form-label">{registering ? "Username" : "Email or username"}</label>
                <input id="auth-username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} required className="form-input" />
              </div>
              {registering && <div className="space-y-2">
                <label htmlFor="auth-email" className="form-label">Email address</label>
                <input
                  id="auth-email" name="email" type="email" autoComplete="email" autoCapitalize="none"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.currentTarget.value);
                    setEmailTypeMismatch(event.currentTarget.validity.typeMismatch);
                    setServerEmailError(null);
                    setShowEmailFeedback(true);
                  }}
                  onInvalid={(event) => {
                    event.preventDefault();
                    setEmailTypeMismatch(event.currentTarget.validity.typeMismatch);
                    setShowEmailFeedback(true);
                  }}
                  required className="form-input" aria-describedby="auth-email-feedback"
                  aria-invalid={showEmailFeedback && Boolean(emailFeedbackError)}
                />
                <p id="auth-email-feedback" aria-live="polite" className={showEmailFeedback && !emailFeedbackError ? "text-xs text-ui-sage" : "text-xs text-ui-text"}>
                  {showEmailFeedback && (emailFeedbackError ?? "Email format looks good.")}
                </p>
              </div>}
              <div className="space-y-2">
                <label htmlFor="auth-password" className="form-label">Password</label>
                <div className="relative">
                  <input
                    id="auth-password" name="password" type={showPassword ? "text" : "password"}
                    autoComplete={registering ? "new-password" : "current-password"} value={password}
                    onChange={(event) => {
                      setPassword(event.currentTarget.value);
                      if (registering) setShowPasswordFeedback(true);
                    }}
                    onInvalid={registering ? (event) => {
                      event.preventDefault();
                      setShowPasswordFeedback(true);
                    } : undefined}
                    required className="form-input pr-20"
                    aria-describedby={registering ? "auth-password-feedback" : undefined}
                    aria-invalid={registering ? showPasswordFeedback && Boolean(passwordError) : undefined}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-1 rounded-lg px-3 text-sm font-medium text-ui-muted hover:text-ui-sage focus-visible:outline-2 focus-visible:outline-brand-primary">{showPassword ? "Hide" : "Show"}</button>
                </div>
                {registering && (
                  <p id="auth-password-feedback" aria-live="polite" className={showPasswordFeedback ? (passwordError ? "text-xs text-ui-text" : "text-xs text-ui-sage") : "text-xs text-ui-muted"}>
                    {showPasswordFeedback ? (passwordError ?? "Password meets the requirements.") : "Use at least 12 characters. A passphrase works well."}
                  </p>
                )}
              </div>
              {registering && (
                <div className="space-y-2">
                  <label htmlFor="auth-password-confirmation" className="form-label">Retype password</label>
                  <input
                    id="auth-password-confirmation" name="password-confirmation"
                    type="password" autoComplete="new-password" value={passwordConfirmation}
                    onChange={(event) => {
                      setPasswordConfirmation(event.currentTarget.value);
                      setShowConfirmationFeedback(true);
                    }}
                    onInvalid={(event) => {
                      event.preventDefault();
                      setShowConfirmationFeedback(true);
                    }}
                    required className="form-input"
                    aria-describedby="auth-password-confirmation-feedback"
                    aria-invalid={showConfirmationFeedback && Boolean(confirmationError)}
                  />
                  <p
                    id="auth-password-confirmation-feedback" aria-live="polite"
                    className={confirmationError ? "text-xs text-ui-text" : "text-xs text-ui-sage"}
                  >
                    {showConfirmationFeedback && (confirmationError ?? "Passwords match.")}
                  </p>
                </div>
              )}
            </fieldset>
            {error && <p id="auth-error" role="alert" className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 p-3 text-sm text-ui-text">{error}</p>}
            <button type="submit" disabled={loading} className="button-primary w-full">{loading ? (registering ? "Creating account…" : "Logging in…") : (registering ? "Create account" : "Log in")}</button>
          </form>
          <p className="mt-6 text-center text-sm text-ui-muted">{registering ? "Already have an account?" : "New to ComfTalk?"}{" "}<Link href={alternateHref} className="font-semibold text-ui-accent underline-offset-4 hover:text-ui-sage hover:underline dark:text-brand-primary dark:hover:text-ui-sage">{registering ? "Log in" : "Create an account"}</Link></p>
          <Link href="/" className="mt-6 block text-center text-sm text-ui-muted underline-offset-4 hover:text-ui-sage hover:underline">Back to practice</Link>
        </section>
      </div>
    </main>
  );
}
