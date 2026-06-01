'use client';

import { apiJson } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useInterests } from '@/lib/hooks/useInterests';
import { usePhotos, MAX_PHOTOS } from '@/lib/hooks/usePhotos';
import DashboardLayout from '@/components/DashboardLayout';
import SectionHeader from '@/components/SectionHeader';
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  uploadUserPhoto,
} from '@/lib/uploadUserPhoto';

type ProfilePayload = {
  supabaseUserId: string;
  email: string | null;
  appUserId: string | null;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  savedLocation: string | null;
};

const MAX_BIO_LENGTH = 500;

type Interest = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
};

type SelectedInterest = Interest & {
  weight: number;
};

const MIN_WEIGHT = 0;
const MAX_WEIGHT = 10;

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
    bio: optString(payload.bio),
    savedLocation: optString(payload.savedLocation),
  };
}

function InterestCard(props: {
  interest: Interest;
  selected?: SelectedInterest;
  onToggle: () => void;
}) {
  const { interest, selected, onToggle } = props;

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-800/70 px-4 py-3 transition-colors hover:bg-slate-800">
      <div className="min-w-0">
        <p className="font-medium text-white">{interest.name}</p>
        {selected ? (
          <p className="mt-1 text-xs text-slate-400">
            Currently ranked {selected.weight}/10
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={
          selected
            ? 'shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700'
            : 'shrink-0 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-500'
        }
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
  const [bio, setBio] = useState('');
  const [locationName, setLocationName] = useState('');
  const [saving, setSaving] = useState(false);
  const {
    photos,
    loading: photosLoading,
    error: photosError,
    busy: photosBusy,
    add: addPhoto,
    remove: removePhoto,
    reorder: reorderPhotos,
  } = usePhotos();
  const [photoFormError, setPhotoFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    catalog,
    selectedInterests,
    loading: interestsLoading,
    saving: interestSaving,
    error: interestError,
    info: interestInfo,
    draggingId,
    startDragging,
    stopDragging,
    add: addInterest,
    remove: removeInterest,
    updateWeight: updateInterestWeight,
    refetch: refetchInterests,
  } = useInterests();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const supabaseRef = useRef<ReturnType<typeof getSupabaseBrowserClient> | null>(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = getSupabaseBrowserClient();
    }
    return supabaseRef.current;
  }, []);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const signedInAs = profile?.email ?? profile?.supabaseUserId ?? '';
  const primaryPhotoUrl = photos[0]?.url ?? null;
  const heroName = displayName.trim() || username.trim() || 'Your profile';
  const heroHandle = username.trim() ? `@${username.trim()}` : 'Add a username below';

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
    return base.filter((interest) => !selectedById.has(interest.id));
  }, [catalog, deferredSearchTerm, selectedById]);

  useEffect(() => {
    if (!draggingId) return;
    const finish = () => {
      stopDragging();
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [draggingId, stopDragging]);

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
        setBio(parsed.bio ?? '');
        setLocationName(parsed.savedLocation ?? '');
        setLoading(false);
        void refetchInterests();
      } catch (e) {
        if (!cancelled) {
          setProfile(null);
          setError(e instanceof Error ? e.message : 'Failed to load profile');
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getSupabase]);

  async function saveProfile(nextGeoLocation?: GeolocationCoordinates | null) {
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

    const nextBio = bio.trim();
    if (nextBio.length > MAX_BIO_LENGTH) {
      setError(`Bio must be at most ${MAX_BIO_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await getSupabase().auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not signed in');

      const payload: {
        username: string | null;
        displayName: string | null;
        bio: string | null;
        geoLocation?: GeolocationCoordinates | null;
      } = {
        username: nextUsername.length === 0 ? null : nextUsername,
        displayName: nextDisplay.length === 0 ? null : nextDisplay,
        bio: nextBio.length === 0 ? null : nextBio,
      };

      if (nextGeoLocation !== undefined) {
        payload.geoLocation = nextGeoLocation;
      }

      const updated = parseProfile(
        await apiJson<unknown>('/profile', 'PATCH', payload),
      );
      if (!updated) throw new Error('Unexpected response');
      setProfile(updated);
      setUsername(updated.username ?? '');
      setDisplayName(updated.displayName ?? '');
      setBio(updated.bio ?? '');
      setLocationName(updated.savedLocation ?? '');

      await getSupabase().auth.refreshSession();

      setInfo('Saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="h-3 w-3 animate-pulse rounded-full bg-slate-500" />
            <span>Loading profile…</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile && !error) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-400 opacity-40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-indigo-500 opacity-40 blur-3xl" />
            <div className="relative">
              <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
              <p className="mt-2 text-sm text-purple-100">You&apos;re not signed in.</p>
              <a
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
                href="/auth"
              >
                Go to sign in
              </a>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile && error) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6 shadow-lg">
            <h1 className="text-2xl font-bold tracking-tight text-white">Profile</h1>
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
            <a
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700"
              href="/auth"
            >
              Back to sign in
            </a>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-xl">
          <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-orange-400 opacity-50 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-12 h-72 w-72 rounded-full bg-pink-500 opacity-40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-indigo-500 opacity-40 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/15 ring-2 ring-white/30 backdrop-blur-sm">
                {primaryPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={primaryPhotoUrl}
                    alt="Primary profile photo"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">
                    👤
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-purple-100/80">
                  Your profile
                </p>
                <h1 className="mt-1 truncate text-4xl font-bold tracking-tight">
                  {heroName}
                </h1>
                <p className="mt-1 text-sm text-purple-100">{heroHandle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                getSupabase().auth.signOut().finally(() => {
                  window.location.href = '/auth';
                });
              }}
              className="self-start rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              Sign out
            </button>
          </div>

          <div className="relative mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-xl backdrop-blur-sm">
                📸
              </div>
              <div>
                <p className="text-2xl font-bold leading-none text-white">
                  {photos.length}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wider text-purple-100/80">
                  Photos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-xl backdrop-blur-sm">
                ⭐
              </div>
              <div>
                <p className="text-2xl font-bold leading-none text-white">
                  {selectedInterests.length}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wider text-purple-100/80">
                  Interests
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-xl backdrop-blur-sm">
                📍
              </div>
              <div>
                <p className="truncate text-2xl font-bold leading-none text-white">
                  {locationName ? locationName : 'Not set'}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wider text-purple-100/80">
                  Location
                </p>
              </div>
            </div>
          </div>
        </div>

        <section>
          <SectionHeader title="Profile info" />
          <div className="space-y-5 rounded-2xl bg-slate-800 p-6 shadow-lg">
            <div>
              <label
                className="text-sm font-semibold text-white"
                htmlFor="displayName"
              >
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                autoComplete="name"
                className="mt-2 h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={saving}
                placeholder="How you want to be shown"
              />
              <p className="mt-2 text-xs text-slate-400">
                Optional. Does not need to be unique.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  className="text-sm font-semibold text-white"
                  htmlFor="bio"
                >
                  Bio
                </label>
                <span className="text-xs text-slate-400">
                  {bio.length}/{MAX_BIO_LENGTH}
                </span>
              </div>
              <textarea
                id="bio"
                rows={4}
                maxLength={MAX_BIO_LENGTH}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={saving}
                placeholder="Tell people a bit about you. What are you into?"
              />
              <p className="mt-2 text-xs text-slate-400">
                Optional. Shown on your Discover card.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <label
                  className="text-sm font-semibold text-white"
                  htmlFor="username"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  className="mt-2 h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={saving}
                  placeholder="unique_handle"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Required. Unique in the app (letters, numbers, underscore; 3–30 chars).
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void saveProfile();
                }}
                disabled={saving}
                className="flex h-12 items-center justify-center rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>

            <div>
              <label
                className="text-sm font-semibold text-white"
                htmlFor="location"
              >
                Location
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="flex h-12 flex-1 items-center rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-white">
                  <span className="mr-2" aria-hidden>
                    📍
                  </span>
                  <span className={locationName ? 'text-white' : 'text-slate-500'}>
                    {locationName !== null && locationName !== '' ? locationName : 'Not set'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      setError('Geolocation is not supported by your browser.');
                      return;
                    }

                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        void saveProfile(position.coords);
                      },
                      (e: GeolocationPositionError) => {
                        setError(
                          e instanceof Error ? e.message : 'Failed to get location.',
                        );
                      },
                    );
                  }}
                  disabled={saving}
                  className="flex h-12 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Update location
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">Signed in as {signedInAs}</p>

            {error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {info ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
                {info}
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <SectionHeader title="Photo deck" />
          <div className="space-y-5 rounded-2xl bg-slate-800 p-6 shadow-lg">
            <div>
              <p className="text-sm text-slate-400">
                Add up to {MAX_PHOTOS} photos. The first photo is the one shown on
                your Discover card. JPEG, PNG, or WebP up to {Math.round(MAX_PHOTO_BYTES / (1024 * 1024))} MB each.
              </p>
              {photosError ? (
                <p className="mt-2 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                  {photosError}
                </p>
              ) : null}
            </div>

            <div>
              <input
                ref={photoFileInputRef}
                type="file"
                accept={ALLOWED_PHOTO_MIME_TYPES.join(',')}
                className="sr-only"
                disabled={uploading || photosBusy || photos.length >= MAX_PHOTOS}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (e.target) e.target.value = '';
                  if (!file) return;
                  setPhotoFormError(null);
                  if (photos.length >= MAX_PHOTOS) {
                    setPhotoFormError(`You already have ${MAX_PHOTOS} photos.`);
                    return;
                  }
                  setUploading(true);
                  try {
                    const { publicUrl } = await uploadUserPhoto(file);
                    await addPhoto(publicUrl);
                  } catch (err) {
                    setPhotoFormError(
                      err instanceof Error ? err.message : 'Failed to upload photo',
                    );
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => photoFileInputRef.current?.click()}
                disabled={uploading || photosBusy || photos.length >= MAX_PHOTOS}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-purple-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading
                  ? 'Uploading…'
                  : photos.length >= MAX_PHOTOS
                    ? `Photo deck full (${MAX_PHOTOS}/${MAX_PHOTOS})`
                    : `Upload photo (${photos.length}/${MAX_PHOTOS})`}
              </button>
            </div>
            {photoFormError ? (
              <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                {photoFormError}
              </p>
            ) : null}

            <div>
              {photosLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-slate-500" />
                  <span>Loading photos…</span>
                </div>
              ) : photos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center text-sm text-slate-400">
                  No photos yet. Add one above to start your deck.
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {photos.map((photo, idx) => {
                    const movePhoto = (delta: number) => {
                      const target = idx + delta;
                      if (target < 0 || target >= photos.length) return;
                      const next = photos.slice();
                      const [moved] = next.splice(idx, 1);
                      next.splice(target, 0, moved);
                      void reorderPhotos(next.map((p) => p.id));
                    };
                    return (
                      <li
                        key={photo.id}
                        className="overflow-hidden rounded-xl bg-slate-900/60 ring-1 ring-slate-800 transition-colors hover:bg-slate-900"
                      >
                        <div className="relative aspect-square w-full bg-slate-950">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt={`Photo slide ${idx + 1}`}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          {idx === 0 ? (
                            <span className="absolute left-2 top-2 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
                              Primary
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 p-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => movePhoto(-1)}
                              disabled={photosBusy || idx === 0}
                              className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Move photo up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => movePhoto(1)}
                              disabled={photosBusy || idx === photos.length - 1}
                              className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Move photo down"
                            >
                              ↓
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm('Delete this photo?')) return;
                              void removePhoto(photo.id);
                            }}
                            disabled={photosBusy}
                            className="text-xs font-semibold text-rose-400 transition-colors hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section>
          <SectionHeader title="Pick and rank your interests" />
          <div className="rounded-2xl bg-slate-800 p-6 shadow-lg">
            <div className="mb-5">
              <p className="text-sm text-slate-400">
                Search the catalog, add what fits, then score each one from 0 to 10.
              </p>
              {interestError ? (
                <p className="mt-2 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                  {interestError}
                </p>
              ) : null}
              {interestInfo ? (
                <p className="mt-2 text-sm text-slate-400">{interestInfo}</p>
              ) : null}
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
                <label
                  className="text-sm font-semibold text-white"
                  htmlFor="interest-search"
                >
                  Search interests
                </label>
                <input
                  id="interest-search"
                  type="search"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search for interests"
                />

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>{filteredCatalog.length} results</span>
                  {interestsLoading ? <span>Loading catalog…</span> : null}
                </div>

                <div className="mt-4 max-h-128 space-y-2 overflow-auto pr-1">
                  {filteredCatalog.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-8 text-sm text-slate-400">
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

              <div className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Selected interests
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Adjust the score for each selected interest.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      aria-live="polite"
                      className={`inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-opacity duration-150 ${interestSaving ? 'opacity-100' : 'pointer-events-none opacity-0'
                        }`}
                    >
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
                      Saving…
                    </span>
                    <span className="rounded-full bg-purple-600 px-3 py-1 text-xs font-bold text-white">
                      {selectedInterests.length}
                    </span>
                  </div>
                </div>

                <div className="mt-4 max-h-145 space-y-3 overflow-auto pr-1">
                  {selectedInterests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-8 text-sm text-slate-400">
                      No interests selected yet.
                    </div>
                  ) : (
                    selectedInterests.map((interest) => (
                      <div
                        key={interest.id}
                        className="rounded-xl bg-slate-800/80 p-4 ring-1 ring-slate-700/60"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-white">{interest.name}</p>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-semibold text-slate-400 transition-colors hover:text-rose-400"
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
                            onPointerDown={() => startDragging(interest.id)}
                            onChange={(e) =>
                              updateInterestWeight(
                                interest.id,
                                Number(e.target.value),
                              )
                            }
                            className="w-full accent-purple-500"
                            aria-label={`Importance for ${interest.name}`}
                          />
                          <div className="flex w-12 items-center justify-center rounded-full bg-purple-600 px-2 py-1 text-sm font-bold text-white">
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
        </section>
      </div>
    </DashboardLayout>
  );
}
