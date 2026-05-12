"use client";

import { useMemo, useState } from "react";
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
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-6 shadow-sm dark:border-white/12 dark:bg-black">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Magic link or Google. No passwords.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-black dark:text-zinc-50" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className="h-11 w-full rounded-xl border border-black/8 bg-white px-3 text-sm text-black outline-none ring-0 placeholder:text-zinc-400 focus:border-black/20 dark:border-white/12 dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-white/30"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-black dark:text-zinc-50"
              htmlFor="username"
            >
              Username (optional)
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              className="h-11 w-full rounded-xl border border-black/8 bg-white px-3 text-sm text-black outline-none ring-0 placeholder:text-zinc-400 focus:border-black/20 dark:border-white/12 dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-white/30"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              placeholder="your_name"
            />
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              If you leave this blank, you can set it later.
            </p>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {info ? (
            <div className="rounded-xl border border-black/8 bg-black/2 px-3 py-2 text-sm text-zinc-700 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200">
              {info}
            </div>
          ) : null}

          <button
            type="button"
            className="flex h-11 w-full items-center justify-center rounded-xl bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-black dark:hover:bg-white"
            onClick={sendMagicLink}
            suppressHydrationWarning
            disabled={!canSendMagicLink || submitting}
          >
            {submitting ? "Sending…" : "Send magic link"}
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-black/8 dark:border-white/12" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-xs text-zinc-500 dark:bg-black dark:text-zinc-400">
                or
              </span>
            </div>
          </div>

          <button
            type="button"
            className="flex h-11 w-full items-center justify-center rounded-xl border border-black/8 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-black/4 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/12 dark:bg-black dark:text-zinc-50 dark:hover:bg-white/6"
            onClick={continueWithGoogle}
            suppressHydrationWarning
            disabled={!canContinueWithGoogle || submitting}
          >
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
