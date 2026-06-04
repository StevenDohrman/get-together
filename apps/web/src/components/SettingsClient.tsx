'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import DashboardLayout from './DashboardLayout';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import { useProfile } from '@/lib/hooks/useProfile';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';

function formatDate(value?: string | null): string {
  if (!value) return 'Unknown';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function SensitiveValue({ value }: { value?: string | null }) {
  const displayValue = value ?? 'Unknown';
  const isKnown = displayValue !== 'Unknown';

  return (
    <span
      tabIndex={isKnown ? 0 : undefined}
      className="group/sensitive relative inline-flex max-w-full cursor-default items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      title={isKnown ? 'Hover or focus to reveal' : undefined}
    >
      <span
        className={
          isKnown
            ? 'max-w-full select-none truncate blur-sm transition duration-150 group-hover/sensitive:blur-0 group-focus/sensitive:blur-0 group-focus-visible/sensitive:blur-0'
            : 'max-w-full truncate'
        }
      >
        {displayValue}
      </span>
      {isKnown ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex max-w-full items-center rounded-md bg-slate-950/95 pr-2 text-slate-400 transition-opacity duration-150 group-hover/sensitive:opacity-0 group-focus/sensitive:opacity-0 group-focus-visible/sensitive:opacity-0"
        >
          Hidden until hover
        </span>
      ) : null}
    </span>
  );
}

export default function SettingsClient() {
  const { profile, loading, error, refetch } = useProfile();
  const [status, setStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'refresh' | 'signout' | null>(null);
  const loadedAt = useMemo(() => new Date().toISOString(), []);

  const accountLabel = useMemo(() => {
    if (profile?.displayName?.trim()) return profile.displayName.trim();
    if (profile?.username?.trim()) return profile.username.trim();
    return profile?.email ?? 'Your account';
  }, [profile]);

  async function refreshAccount() {
    setBusyAction('refresh');
    setActionError(null);
    setStatus(null);

    try {
      await getSupabaseBrowserClient().auth.refreshSession();
      await refetch();
      setStatus('Account settings are up to date.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to refresh account settings.');
    } finally {
      setBusyAction(null);
    }
  }

  async function signOut() {
    setBusyAction('signout');
    setActionError(null);
    setStatus(null);

    try {
      const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      window.location.href = '/auth';
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to sign out.');
      setBusyAction(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-300">
            Settings
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Account settings</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage sign-in state and account details supported by UConnect today.
              </p>
            </div>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-purple-400 hover:text-white"
            >
              Edit profile
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Account</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Details are read from your signed-in Supabase account and app profile.
                </p>
              </div>
              {loading ? (
                <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
                  Loading
                </span>
              ) : error ? (
                <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-100">
                  Unavailable
                </span>
              ) : (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Signed in
                </span>
              )}
            </div>

            {loading ? (
              <Loading />
            ) : error ? (
              <ErrorMessage message={error} />
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Name
                  </dt>
                  <dd className="mt-2 truncate text-sm font-medium text-white">{accountLabel}</dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Email
                  </dt>
                  <dd className="mt-2 truncate text-sm font-medium text-white">
                    <SensitiveValue value={profile?.email} />
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Username
                  </dt>
                  <dd className="mt-2 truncate text-sm font-medium text-white">
                    {profile?.username ? `@${profile.username}` : 'Not set'}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Profile id
                  </dt>
                  <dd className="mt-2 truncate text-sm font-medium text-white">
                    <SensitiveValue value={profile?.appUserId} />
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold text-white">Session</h2>
            <p className="mt-1 text-sm text-slate-400">
              Refresh your session after account changes or sign out on this device.
            </p>

            {status ? (
              <p className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                {status}
              </p>
            ) : null}
            {actionError ? (
              <div className="mt-5">
                <ErrorMessage message={actionError} />
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={refreshAccount}
                disabled={busyAction !== null}
                className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {busyAction === 'refresh' ? 'Refreshing...' : 'Refresh session'}
              </button>
              <button
                type="button"
                onClick={signOut}
                disabled={busyAction !== null}
                className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-red-400 hover:text-red-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
              >
                {busyAction === 'signout' ? 'Signing out...' : 'Sign out'}
              </button>
            </div>

            <p className="mt-5 text-xs leading-5 text-slate-500">
              Last loaded: {formatDate(loadedAt)}
            </p>
          </aside>
        </section>
      </div>
    </DashboardLayout>
  );
}
