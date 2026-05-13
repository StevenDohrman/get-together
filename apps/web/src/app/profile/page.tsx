"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type User = {
  id: string;
  email: string | null;
  user_metadata?: {
    username?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRecordProp(obj: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(obj)) return null;
  const value = obj[key];
  return isRecord(value) ? value : null;
}

function getStringProp(obj: unknown, key: string): string | null {
  if (!isRecord(obj)) return null;
  const value = obj[key];
  return typeof value === "string" ? value : null;
}

function getUserFromMeResponse(payload: unknown): User | null {
  if (!isRecord(payload)) return null;
  const user = getRecordProp(payload, "user");
  if (!user) return null;
  const id = getStringProp(user, "id");
  if (!id) return null;
  const email = getStringProp(user, "email");
  const userMetadata = getRecordProp(user, "user_metadata");
  const username = userMetadata ? getStringProp(userMetadata, "username") ?? undefined : undefined;
  return { id, email, user_metadata: username ? { username } : undefined };
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setInfo(null);

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(sessionError.message);
        if (!sessionData.session) throw new Error("Not signed in");

        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) throw new Error(userError?.message ?? "Not signed in");

        const parsed = getUserFromMeResponse({ user: data.user });
        if (!parsed) throw new Error("Unexpected user");

        if (!cancelled) {
          setUser(parsed);
          setUsername(parsed.user_metadata?.username ?? "");
        }
      } catch (e) {
        if (!cancelled) {
          setUser(null);
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function save() {
    setError(null);
    setInfo(null);

    const next = username.trim();
    if (next.length < 3 || next.length > 30 || !/^[a-zA-Z0-9_]+$/.test(next)) {
      setError("Username must be 3–30 chars and use letters/numbers/underscore.");
      return;
    }

    setSaving(true);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: {
          username: next,
        },
      });

      if (updateError || !data.user) {
        throw new Error(updateError?.message ?? "Update failed");
      }

      const updated = getUserFromMeResponse({ user: data.user });
      if (!updated) throw new Error("Unexpected user");
      setUser(updated);
      setInfo("Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
        <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-6 shadow-sm dark:border-white/12 dark:bg-black">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Profile
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            You’re not signed in.
          </p>
          <a
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-white"
            href="/auth"
          >
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-6 shadow-sm dark:border-white/12 dark:bg-black">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Profile</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Signed in as {user.email ?? user.id}
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
            onClick={() => {
              supabase.auth.signOut().finally(() => {
                window.location.href = "/auth";
              });
            }}
          >
            Sign out
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-black dark:text-zinc-50" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              className="h-11 w-full rounded-xl border border-black/8 bg-white px-3 text-sm text-black outline-none ring-0 placeholder:text-zinc-400 focus:border-black/20 dark:border-white/12 dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-white/30"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={saving}
              placeholder="your_name"
            />
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
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
