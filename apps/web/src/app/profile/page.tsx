'use client';

import { apiJson } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useInterests } from '@/lib/hooks/useInterests';
import { usePhotos, MAX_PHOTOS } from '@/lib/hooks/usePhotos';
import DashboardLayout from '@/components/DashboardLayout';
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
    bio: optString(payload.bio),
    savedLocation: optString(payload.savedLocation),
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

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        // Trigger interests hook to (re)fetch using current auth token
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
          <div className="text-sm text-zinc-400">Loading profile…</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile && !error) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Profile
            </h1>
            <p className="mt-2 text-sm text-zinc-400">You’re not signed in.</p>
            <a
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-50 px-4 text-sm font-medium text-black transition-colors hover:bg-white"
              href="/auth"
            >
              Go to sign in
            </a>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile && error) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Profile
            </h1>
            <p className="mt-2 text-sm text-red-300">{error}</p>
            <a
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/12 px-4 text-sm font-medium text-zinc-50"
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
      <div className="mx-auto w-full max-w-5xl space-y-6 text-zinc-50">
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

              <div>
                <div className="flex items-center justify-between">
                  <label
                    className="text-sm font-medium text-black dark:text-zinc-50"
                    htmlFor="bio"
                  >
                    Bio
                  </label>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {bio.length}/{MAX_BIO_LENGTH}
                  </span>
                </div>
                <textarea
                  id="bio"
                  rows={4}
                  maxLength={MAX_BIO_LENGTH}
                  className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-black outline-none ring-0 placeholder:text-zinc-400 focus:border-black/20 dark:border-white/12 dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-white/30"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={saving}
                  placeholder="Tell people a bit about you. What are you into?"
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Optional. Shown on your Discover card.
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
                    Required. Unique in the app (letters, numbers, underscore;
                    3–30 chars).
                  </p>
                </div>

                <button
                  type="button"
                  className="flex h-12 items-center justify-center rounded-2xl bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-black dark:hover:bg-white"
                  onClick={() => {
                    void saveProfile();
                  }}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
                <div>
                  <label
                    className="text-sm font-medium text-black dark:text-zinc-50"
                    htmlFor="location"
                  >
                    Location
                  </label>
                  <div className="flex gap-4">
                    {locationName !== null && locationName !== '' ? (
                      <p className="mt-2">{locationName}</p>
                    ) : (
                      <p className="mt-2">Not set</p>
                    )}
                    <button
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setError(
                            'Geolocation is not supported by your browser.',
                          );
                          return;
                        }

                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            void saveProfile(position.coords);
                          },
                          (e: GeolocationPositionError) => {
                            setError(
                              e instanceof Error
                                ? e.message
                                : 'Failed to get location.',
                            );
                          },
                        );
                      }}
                      disabled={saving}
                      className="flex items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-black dark:hover:bg-white"
                    >
                      Update Location
                    </button>
                  </div>
                </div>
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
              Photo deck
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Your photo slides
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Add up to {MAX_PHOTOS} photos. The first photo is the one shown on
              your Discover card. JPEG, PNG, or WebP up to {Math.round(MAX_PHOTO_BYTES / (1024 * 1024))} MB each.
            </p>
            {photosError ? (
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                {photosError}
              </p>
            ) : null}
          </div>

          <div className="mt-5">
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
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-black dark:hover:bg-white"
            >
              {uploading
                ? 'Uploading…'
                : photos.length >= MAX_PHOTOS
                  ? `Photo deck full (${MAX_PHOTOS}/${MAX_PHOTOS})`
                  : `Upload photo (${photos.length}/${MAX_PHOTOS})`}
            </button>
          </div>
          {photoFormError ? (
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">
              {photoFormError}
            </p>
          ) : null}

          <div className="mt-5">
            {photosLoading ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading photos…
              </p>
            ) : photos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
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
                      className="overflow-hidden rounded-2xl border border-black/8 bg-zinc-50 dark:border-white/12 dark:bg-white/4"
                    >
                      <div className="relative aspect-square w-full bg-zinc-200 dark:bg-zinc-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={`Photo slide ${idx + 1}`}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        {idx === 0 ? (
                          <span className="absolute left-2 top-2 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
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
                            className="rounded-md border border-black/10 px-2 py-1 text-xs text-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:text-zinc-50 dark:hover:bg-white dark:hover:text-black"
                            aria-label="Move photo up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => movePhoto(1)}
                            disabled={photosBusy || idx === photos.length - 1}
                            className="rounded-md border border-black/10 px-2 py-1 text-xs text-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:text-zinc-50 dark:hover:bg-white dark:hover:text-black"
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
                          className="text-xs font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
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
                          onPointerDown={() => startDragging(interest.id)}
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
    </DashboardLayout>
  );
}
