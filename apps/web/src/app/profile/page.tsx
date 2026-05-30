'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useInterests } from '@/lib/hooks/useInterests';
import { usePhotos, MAX_PHOTOS } from '@/lib/hooks/usePhotos';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  uploadUserPhoto,
} from '@/lib/uploadUserPhoto';

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
  } = useInterests();

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

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
                Photos and interests
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Manage your photo deck and interests here. Account details like
                username, display name, bio, and location live in Settings.
              </p>
            </div>
            <Link
              href="/settings"
              className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
            >
              Open settings
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/12 dark:bg-black/30">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-black dark:text-zinc-50">
                  Keep profile edits in Settings
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Username, display name, bio, and location are managed on the
                  settings page so this page can stay focused on photos and
                  interests.
                </p>
              </div>
              <Link
                href="/settings"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-black hover:text-white dark:border-white/15 dark:text-zinc-50 dark:hover:bg-white dark:hover:text-black"
              >
                Go to settings
              </Link>
            </div>
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
