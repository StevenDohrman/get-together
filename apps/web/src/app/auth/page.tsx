"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

function isValidEmail(value: string): boolean {
  // Let the browser do most validation; this is a small guard.
  return /.+@.+\..+/.test(value);
}

function isValidUsername(value: string): boolean {
  return /^[a-zA-Z0-9_]{3,30}$/.test(value);
}

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canContinueWithGoogle = useMemo(() => {
    return !submitting;
  }, [submitting]);

  const canSendMagicLink = useMemo(() => {
    if (!email) return false;
    if (!isValidEmail(email)) return false;

    const trimmed = username.trim();
    if (!trimmed) return true;
    return isValidUsername(trimmed);
  }, [email, username]);

  async function sendMagicLink() {
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;

      const trimmedUsername = username.trim();
      const data = isValidUsername(trimmedUsername) ? { username: trimmedUsername } : undefined;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          ...(data ? { data } : {}),
        },
      });

      if (otpError) throw new Error(otpError.message);

      setInfo(
        "Magic link sent. Check your email to finish signing in (Supabase Local uses Inbucket)."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;

      const trimmedUsername = username.trim();
      if (isValidUsername(trimmedUsername)) {
        window.localStorage.setItem("uconnect.pending_username", trimmedUsername);
      } else {
        window.localStorage.removeItem("uconnect.pending_username");
      }

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (oauthError) throw new Error(oauthError.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-950 px-6 py-16">
      {/* Aurora background blobs — same vibe as the dashboard hero */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-indigo-600 opacity-30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-purple-600 opacity-30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-[26rem] w-[26rem] rounded-full bg-pink-500 opacity-25 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Soft outer glow */}
        <div
          aria-hidden
          className="absolute -inset-px rounded-3xl bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-pink-500/40 opacity-60 blur-xl"
        />

        <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
          {/* Gradient hero header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 px-8 pb-8 pt-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-400 opacity-40 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 -bottom-16 h-48 w-48 rounded-full bg-indigo-400 opacity-40 blur-3xl" />

            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Image
                  src="/assets/logo.svg"
                  alt="UConnect"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                  priority
                />
              </div>
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-100/90">
                UConnect
              </span>
            </div>

            <div className="relative mt-6">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Welcome back <span aria-hidden>👋</span>
              </h1>
              <p className="mt-2 text-sm text-purple-100/90">
                Sign in with a magic link or Google. No passwords, ever.
              </p>
            </div>
          </div>

          {/* Form body */}
          <div className="space-y-5 px-8 py-8">
            <div className="space-y-2">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="email"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-800/60 px-3.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500/70 focus:bg-slate-800 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="username"
              >
                Username <span className="text-slate-500 normal-case">(optional)</span>
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-800/60 px-3.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500/70 focus:bg-slate-800 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                placeholder="your_handle"
              />
              <p className="text-xs text-slate-500">
                Leave blank to set it later on your profile.
              </p>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
                {error}
              </div>
            ) : null}

            {info ? (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3.5 py-2.5 text-sm text-purple-200">
                {info}
              </div>
            ) : null}

            <button
              type="button"
              className="group relative flex h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 text-sm font-semibold text-white shadow-lg shadow-purple-900/40 transition-all hover:shadow-purple-900/60 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
              onClick={sendMagicLink}
              suppressHydrationWarning
              disabled={!canSendMagicLink || submitting}
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative flex items-center gap-2">
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Sending…
                  </>
                ) : (
                  <>
                    <span aria-hidden>✨</span>
                    Send magic link
                  </>
                )}
              </span>
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-slate-900 px-3 text-xs uppercase tracking-wider text-slate-500">
                  or
                </span>
              </div>
            </div>

            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-800/60 px-4 text-sm font-medium text-white transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={continueWithGoogle}
              suppressHydrationWarning
              disabled={!canContinueWithGoogle || submitting}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6.01-2.74-6.01-6.12S8.69 5.96 12 5.96c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.86 3.37 14.65 2.4 12 2.4 6.83 2.4 2.65 6.58 2.65 11.75S6.83 21.1 12 21.1c6.92 0 9.5-4.86 9.5-7.45 0-.5-.05-.88-.12-1.45H12z"
                />
                <path fill="#34A853" d="M12 21.1c2.7 0 4.97-.89 6.62-2.42l-3.23-2.5c-.86.6-2.02 1.02-3.39 1.02-2.61 0-4.82-1.76-5.61-4.13l-3.33 2.56C4.88 18.96 8.16 21.1 12 21.1z" />
                <path fill="#FBBC05" d="M6.39 13.07a5.5 5.5 0 0 1 0-3.5L3.06 7.01a9.34 9.34 0 0 0 0 8.62l3.33-2.56z" />
                <path fill="#4285F4" d="M21.5 13.65c0-.5-.05-.88-.12-1.45H12v3.9h5.5a4.7 4.7 0 0 1-2.11 3.08l3.23 2.5c1.89-1.74 2.88-4.31 2.88-7.03z" />
              </svg>
              Continue with Google
            </button>

            <p className="pt-2 text-center text-xs text-slate-500">
              By continuing, you agree to UConnect&apos;s terms and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
