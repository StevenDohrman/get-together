'use client';

import { apiGet, apiJson } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

type ProfilePayload = {
  supabaseUserId: string;
  email: string | null;
  appUserId: string | null;
  username: string | null;
  displayName: string | null;
};

type Interest = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
};

type SelectedInterest = Interest & {
  weight: number;
};

type InterestsResponse = {
  interests: Interest[];
};

type SelectedInterestsResponse = {
  interests: SelectedInterest[];
};

const MIN_WEIGHT = 0;
const MAX_WEIGHT = 10;
const DEFAULT_WEIGHT = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  return value;
}

function parseProfile(payload: unknown): ProfilePayload | null {
  if (!isRecord(payload)) return null;
  const supabaseUserId = payload.supabaseUserId;
  if (typeof supabaseUserId !== 'string') return null;
  return {
    supabaseUserId,
    email: typeof payload.email === 'string' ? payload.email : null,
    appUserId: typeof payload.appUserId === 'string' ? payload.appUserId : null,
    username: optString(payload.username),
    displayName: optString(payload.displayName),
  };
}

function clampWeight(value: number): number {
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, value));
}

function sortSelectedInterests(
  interests: SelectedInterest[],
): SelectedInterest[] {
  return [...interests].sort((left, right) => {
    if (right.weight !== left.weight) return right.weight - left.weight;
    return left.name.localeCompare(right.name);
  });
}

function InterestCard(props: {
  interest: Interest;
  selected?: SelectedInterest;
  onToggle: () => void;
}) {
  const { interest, selected, onToggle } = props;

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-black/8 bg-zinc-50 px-4 py-4 dark:border-white/12 dark:bg-white/4">
      <div className="min-w-0">
        <p className="font-medium text-black dark:text-zinc-50">
          {interest.name}
        </p>
        {selected ? (
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
            Currently ranked {selected.weight}/10
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className="shrink-0 rounded-full border border-black/10 px-3 py-2 text-xs font-medium text-black transition-colors hover:bg-black hover:text-white dark:border-white/15 dark:text-zinc-50 dark:hover:bg-white dark:hover:text-black"
        onClick={onToggle}
      >
        {selected ? 'Selected' : 'Add'}
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<Interest[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<
    SelectedInterest[]
  >([]);
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [interestSaving, setInterestSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [interestInfo, setInterestInfo] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef<boolean>(false);
  const lastSavedState = useRef<string>('');
  const lastFailedState = useRef<string>('');

  const supabaseRef = useRef<ReturnType<typeof getSupabaseBrowserClient> | null>(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = getSupabaseBrowserClient();
    }
    return supabaseRef.current;
  }, []);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const signedInAs = profile?.email ?? profile?.supabaseUserId ?? '';

  const selectedById = useMemo(() => {
    return new Map(
      selectedInterests.map((interest) => [interest.id, interest]),
    );
  }, [selectedInterests]);

  const filteredCatalog = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    const base = !term
      ? catalog
      : catalog.filter((interest) => {
          return (
            interest.name.toLowerCase().includes(term) ||
            interest.slug.toLowerCase().includes(term)
          );
        });
    // Exclude interests that are already selected
    return base.filter((interest) => !selectedById.has(interest.id));
  }, [catalog, deferredSearchTerm, selectedById]);

  // When a user is actively dragging a slider, keep the current order
  // until they finish to avoid the element jumping away from the pointer.
  useEffect(() => {
    if (!draggingId) return;
    const finish = () => {
      setDraggingId(null);
      setSelectedInterests((cur) => sortSelectedInterests(cur));
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [draggingId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setInfo(null);

      try {
        const { data: sessionData, error: sessionError } =
          await getSupabase().auth.getSession();
        if (sessionError) throw new Error(sessionError.message);
        if (!sessionData.session) {
          if (!cancelled) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        const accessToken = sessionData.session.access_token;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/profile`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const body: unknown = await res.json();

        if (!res.ok) {
          const msg =
            typeof body === 'object' && body !== null && 'error' in body
              ? String((body as Record<string, unknown>).error)
              : 'Failed to load profile';
          throw new Error(msg);
        }

        const parsed = parseProfile(body);
        if (!parsed) throw new Error('Unexpected profile response');

        if (cancelled) return;

        setProfile(parsed);
        setUsername(parsed.username ?? '');
        setDisplayName(parsed.displayName ?? '');
        setLoading(false);
        setInterestsLoading(true);

        try {
          const [{ interests }, { interests: savedInterests }] =
            await Promise.all([
              apiGet<InterestsResponse>('/interests'),
              apiGet<SelectedInterestsResponse>('/me/interests'),
            ]);

          if (cancelled) return;

          setCatalog(interests);
          const sortedInterests = sortSelectedInterests(savedInterests);
          setSelectedInterests(sortedInterests);
          lastSavedState.current = JSON.stringify(
            sortedInterests.map((i) => ({ id: i.id, weight: i.weight })),
          );
          initialLoadDone.current = true;
        } catch (interestLoadError) {
          if (cancelled) return;

          setInterestError(
            interestLoadError instanceof Error
              ? interestLoadError.message
              : 'Failed to load interests',
          );
          setCatalog([]);
          setSelectedInterests([]);
        } finally {
          if (!cancelled) {
            setInterestsLoading(false);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setProfile(null);
          setError(e instanceof Error ? e.message : 'Failed to load profile');
          setLoading(false);
          setInterestsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getSupabase]);

  async function saveProfile() {
    setError(null);
    setInfo(null);

    const nextUsername = username.trim();
    const nextDisplay = displayName.trim();

    if (
      nextUsername.length > 0 &&
      (nextUsername.length < 3 ||
        nextUsername.length > 30 ||
        !/^[a-zA-Z0-9_]+$/.test(nextUsername))
    ) {
      setError(
        'Username must be 3–30 chars and use letters, numbers, or underscore.',
      );
      return;
    }

    if (nextDisplay.length > 80) {
      setError('Display name must be at most 80 characters.');
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await getSupabase().auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not signed in');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

      const payload: { username: string | null; displayName: string | null } = {
        username: nextUsername.length === 0 ? null : nextUsername,
        displayName: nextDisplay.length === 0 ? null : nextDisplay,
      };

      const res = await fetch(`${apiUrl}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const body: unknown = await res.json();

      if (!res.ok) {
        const msg =
          typeof body === 'object' && body !== null && 'error' in body
            ? String((body as Record<string, unknown>).error)
            : 'Update failed';
        throw new Error(msg);
      }

      const updated = parseProfile(body);
      if (!updated) throw new Error('Unexpected response');
      setProfile(updated);
      setUsername(updated.username ?? '');
      setDisplayName(updated.displayName ?? '');

      await getSupabase().auth.refreshSession();

      setInfo('Saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  function addInterest(interest: Interest) {
    setInterestError(null);
    setInterestInfo(null);
    setSelectedInterests((current) => {
      if (current.some((item) => item.id === interest.id)) {
        return current;
      }

      return sortSelectedInterests([
        ...current,
        {
          ...interest,
          weight: DEFAULT_WEIGHT,
        },
      ]);
    });
  }

  function removeInterest(interestId: string) {
    setInterestError(null);
    setInterestInfo(null);
    setSelectedInterests((current) =>
      current.filter((item) => item.id !== interestId),
    );
  }

  function updateInterestWeight(interestId: string, weight: number) {
    const nextWeight = clampWeight(weight);
    setInterestError(null);
    setInterestInfo(null);
    setSelectedInterests((current) => {
      const updated = current.map((item) =>
        item.id === interestId ? { ...item, weight: nextWeight } : item,
      );
      if (draggingId) return updated;
      return sortSelectedInterests(updated);
    });
  }

  useEffect(() => {
    if (!initialLoadDone.current) return;

    // Check if what we have actually differs from what was last saved
    const currentState = JSON.stringify(
      selectedInterests.map((i) => ({ id: i.id, weight: i.weight })),
    );
    if (currentState === lastSavedState.current) return;
    if (lastFailedState.current) {
      if (currentState === lastFailedState.current) return;
      lastFailedState.current = '';
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setInterestError(null);
      setInterestInfo(null);
      setInterestSaving(true);

      // Mark it as saved optimistically before the network request finishes
      lastSavedState.current = currentState;

      apiJson<SelectedInterestsResponse>('/me/interests', 'PUT', {
        interests: selectedInterests.map((interest) => ({
          interestId: interest.id,
          weight: clampWeight(interest.weight),
        })),
      })
        .then(({ interests }) => {
          // If we want to replace with backend sorted output:
          // We must update lastSavedState so the next render doesn't re-trigger save
          const sorted = sortSelectedInterests(interests);
          const newBackendState = JSON.stringify(
            sorted.map((i) => ({ id: i.id, weight: i.weight })),
          );

          if (!draggingId) {
            lastSavedState.current = newBackendState;
            setSelectedInterests(sorted);
          }
          lastFailedState.current = '';
          setInterestSaving(false);
        })
        .catch((e) => {
          lastFailedState.current = currentState;
          setInterestError(
            e instanceof Error ? e.message : 'Failed to save interests',
          );
          setInterestSaving(false);
        });
    }, 700);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [selectedInterests, draggingId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,#f4efe8,transparent_42%),linear-gradient(180deg,#fbf8f3_0%,#f5f1ea_100%)] px-6 py-16 text-zinc-900 dark:bg-[radial-gradient(circle_at_top,#202124,transparent_42%),linear-gradient(180deg,#0f1012_0%,#090a0c_100%)] dark:text-zinc-50">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading profile…
        </div>
      </div>
    );
  }

  if (!profile && !error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,#f4efe8,transparent_42%),linear-gradient(180deg,#fbf8f3_0%,#f5f1ea_100%)] px-6 py-16 text-zinc-900 dark:bg-[radial-gradient(circle_at_top,#202124,transparent_42%),linear-gradient(180deg,#0f1012_0%,#090a0c_100%)] dark:text-zinc-50">
        <div className="w-full max-w-md rounded-3xl border border-black/8 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,24,24,0.08)] backdrop-blur dark:border-white/12 dark:bg-white/5">
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

  if (!profile && error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,#f4efe8,transparent_42%),linear-gradient(180deg,#fbf8f3_0%,#f5f1ea_100%)] px-6 py-16 text-zinc-900 dark:bg-[radial-gradient(circle_at_top,#202124,transparent_42%),linear-gradient(180deg,#0f1012_0%,#090a0c_100%)] dark:text-zinc-50">
        <div className="w-full max-w-md rounded-3xl border border-black/8 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,24,24,0.08)] backdrop-blur dark:border-white/12 dark:bg-white/5">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Profile
          </h1>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
          <a
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl border border-black/8 px-4 text-sm font-medium text-black dark:border-white/12 dark:text-zinc-50"
            href="/auth"
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="flex flex-1 justify-center bg-[radial-gradient(circle_at_top,#f4efe8,transparent_42%),linear-gradient(180deg,#fbf8f3_0%,#f5f1ea_100%)] px-6 py-10 text-zinc-900 dark:bg-[radial-gradient(circle_at_top,#202124,transparent_42%),linear-gradient(180deg,#0f1012_0%,#090a0c_100%)] dark:text-zinc-50">
      <div className="w-full max-w-5xl space-y-6">
        <div className="rounded-3xl border border-black/8 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,24,24,0.08)] backdrop-blur dark:border-white/12 dark:bg-white/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                Profile
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-4xl">
                Shape your profile
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Update your display name, username, and rank the interests that
                matter most to you.
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
              onClick={() => {
                getSupabase().auth.signOut().finally(() => {
                  window.location.href = '/auth';
                });
              }}
            >
              Sign out
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/12 dark:bg-black/30">
            <div className="space-y-5">
              <div>
                <label
                  className="text-sm font-medium text-black dark:text-zinc-50"
                  htmlFor="displayName"
                >
                  Display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  className="mt-2 h-12 w-full rounded-2xl border border-black/8 bg-white px-4 text-sm text-black outline-none ring-0 placeholder:text-zinc-400 focus:border-black/20 dark:border-white/12 dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-white/30"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={saving}
                  placeholder="How you want to be shown"
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Optional. Does not need to be unique.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
                <div>
                  <label
                    className="text-sm font-medium text-black dark:text-zinc-50"
                    htmlFor="username"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    className="mt-2 h-12 w-full rounded-2xl border border-black/8 bg-white px-4 text-sm text-black outline-none ring-0 placeholder:text-zinc-400 focus:border-black/20 dark:border-white/12 dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-white/30"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={saving}
                    placeholder="unique_handle"
                  />
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Optional. Unique in the app (letters, numbers, underscore;
                    3–30 chars).
                  </p>
                </div>

                <button
                  type="button"
                  className="flex h-12 items-center justify-center rounded-2xl bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-black dark:hover:bg-white"
                  onClick={saveProfile}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Signed in as {signedInAs}
            </p>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            ) : null}

            {info ? (
              <div className="mt-4 rounded-2xl border border-black/8 bg-black/2 px-4 py-3 text-sm text-zinc-700 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200">
                {info}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-black/8 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,24,24,0.08)] backdrop-blur dark:border-white/12 dark:bg-white/5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              Interests
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Pick and rank your interests
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Search the catalog, add what fits, then score each one from 0 to
              10.
            </p>
            {interestSaving ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Saving your interests…
              </p>
            ) : null}
            {interestError ? (
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                {interestError}
              </p>
            ) : null}
            {interestInfo ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {interestInfo}
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/12 dark:bg-black/30">
              <label
                className="text-sm font-medium text-black dark:text-zinc-50"
                htmlFor="interest-search"
              >
                Search interests
              </label>
              <input
                id="interest-search"
                type="search"
                className="mt-2 h-11 w-full rounded-2xl border border-black/8 bg-white px-4 text-sm text-black outline-none ring-0 placeholder:text-zinc-400 focus:border-black/20 dark:border-white/12 dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-white/30"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for interests"
              />

              <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>{filteredCatalog.length} results</span>
                {interestsLoading ? <span>Loading catalog…</span> : null}
              </div>

              <div className="mt-4 max-h-128 space-y-3 overflow-auto pr-1">
                {filteredCatalog.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
                    No interests match that search.
                  </div>
                ) : (
                  filteredCatalog.map((interest) => {
                    const selected = selectedById.get(interest.id);
                    return (
                      <InterestCard
                        key={interest.id}
                        interest={interest}
                        selected={selected}
                        onToggle={() => {
                          if (selected) {
                            removeInterest(interest.id);
                          } else {
                            addInterest(interest);
                          }
                        }}
                      />
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/12 dark:bg-black/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-black dark:text-zinc-50">
                    Selected interests
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Adjust the score for each selected interest.
                  </p>
                </div>
                <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white dark:bg-zinc-50 dark:text-black">
                  {selectedInterests.length}
                </span>
              </div>

              <div className="mt-4 max-h-145 space-y-3 overflow-auto pr-1">
                {selectedInterests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
                    No interests selected yet.
                  </div>
                ) : (
                  selectedInterests.map((interest) => (
                    <div
                      key={interest.id}
                      className="rounded-2xl border border-black/8 bg-zinc-50 p-4 dark:border-white/12 dark:bg-white/4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-black dark:text-zinc-50">
                            {interest.name}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-300"
                          onClick={() => removeInterest(interest.id)}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <input
                          type="range"
                          min={MIN_WEIGHT}
                          max={MAX_WEIGHT}
                          step={1}
                          value={interest.weight}
                          onPointerDown={() => setDraggingId(interest.id)}
                          onChange={(e) =>
                            updateInterestWeight(
                              interest.id,
                              Number(e.target.value),
                            )
                          }
                          className="w-full accent-black dark:accent-zinc-50"
                          aria-label={`Importance for ${interest.name}`}
                        />
                        <div className="flex w-14 items-center justify-center rounded-full border border-black/10 bg-white px-2 py-1 text-sm font-semibold text-black dark:border-white/12 dark:bg-black dark:text-zinc-50">
                          {interest.weight}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
