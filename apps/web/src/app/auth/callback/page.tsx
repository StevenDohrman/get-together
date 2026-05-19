"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

function isValidUsername(value: string): boolean {
  return /^[a-zA-Z0-9_]{3,30}$/.test(value);
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
          <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-6 shadow-sm dark:border-white/12 dark:bg-black">
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Finishing sign-in…
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              You can close this tab if it doesn’t redirect.
            </p>
          </div>
        </div>
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
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-6 shadow-sm dark:border-white/12 dark:bg-black">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Finishing sign-in…
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          You can close this tab if it doesn’t redirect.
        </p>
        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
