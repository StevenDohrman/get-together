"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

function isValidUsername(value: string): boolean {
  return /^[a-zA-Z0-9_]{3,30}$/.test(value);
}

function CallbackShell({
  title,
  description,
  error,
  showSpinner = true,
}: {
  title: string;
  description: string;
  error?: string | null;
  showSpinner?: boolean;
}) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-950 px-6 py-16">
      <div className="pointer-events-none absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-indigo-600 opacity-30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-purple-600 opacity-30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-[26rem] w-[26rem] rounded-full bg-pink-500 opacity-25 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div
          aria-hidden
          className="absolute -inset-px rounded-3xl bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-pink-500/40 opacity-60 blur-xl"
        />

        <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
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

            <div className="relative mt-6 flex items-center gap-3">
              {showSpinner && !error ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : null}
              <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
            </div>
            <p className="relative mt-2 text-sm text-purple-100/90">{description}</p>
          </div>

          <div className="px-8 py-6">
            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
                {error}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Hang tight — we&apos;re finishing things up.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <CallbackShell
          title="Finishing sign-in…"
          description="You can close this tab if it doesn't redirect."
        />
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const supabase = getSupabaseBrowserClient();
        const urlError = searchParams.get("error");
        const urlErrorCode = searchParams.get("error_code");
        const urlErrorDescription = searchParams.get("error_description");
        if (urlError) {
          const parts = [
            urlError,
            urlErrorCode ? `(${urlErrorCode})` : null,
            urlErrorDescription ? `— ${urlErrorDescription}` : null,
          ].filter(Boolean);
          throw new Error(parts.join(" "));
        }

        const code = searchParams.get("code");
        const { data: beforeSession } = await supabase.auth.getSession();

        // If we have a code, exchange it (OAuth/PKCE). If we already have a
        // session (e.g. refresh), skip exchanging.
        if (!beforeSession.session && code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw new Error(exchangeError.message);
        }

        const { data: afterSession, error: afterSessionError } =
          await supabase.auth.getSession();

        if (afterSessionError) throw new Error(afterSessionError.message);
        if (!afterSession.session) {
          throw new Error(
            "Sign-in did not complete (no session). Check Supabase Auth redirect URL settings and try again."
          );
        }

        const { data, error: userError } = await supabase.auth.getUser();
        if (userError) throw new Error(userError.message);

        const pending =
          window.localStorage.getItem("uconnect.pending_username") ??
          window.sessionStorage.getItem("uconnect.pending_username") ??
          "";
        if (data.user && isValidUsername(pending)) {
          const { error: updateError } = await supabase.auth.updateUser({
            data: { username: pending },
          });
          if (updateError) throw new Error(updateError.message);
        }
        window.localStorage.removeItem("uconnect.pending_username");
        window.sessionStorage.removeItem("uconnect.pending_username");

        if (!cancelled) {
          router.replace("/profile");
          router.refresh();
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to finish sign-in");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <CallbackShell
      title={error ? "Sign-in failed" : "Finishing sign-in…"}
      description={
        error
          ? "We hit a snag completing your sign-in."
          : "You can close this tab if it doesn't redirect."
      }
      error={error}
      showSpinner={!error}
    />
  );
}
