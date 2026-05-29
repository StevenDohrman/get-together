'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ErrorMessage from '@/components/ErrorMessage';
import Loading from '@/components/Loading';
import { apiJson } from '@/lib/api';
import { useProfile, type Profile } from '@/lib/hooks/useProfile';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import Link from 'next/link';
import { useCallback, useState } from 'react';

const MAX_BIO_LENGTH = 500;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

function isValidUsername(value: string): boolean {
    return (
        value.length === 0 ||
        (value.length >= 3 && value.length <= 30 && USERNAME_PATTERN.test(value))
    );
}

function SettingsForm({
    profile,
    onSignOut,
}: {
    profile: Profile;
    onSignOut: () => Promise<void>;
}) {
    const [username, setUsername] = useState(profile.username ?? '');
    const [displayName, setDisplayName] = useState(profile.displayName ?? '');
    const [bio, setBio] = useState(profile.bio ?? '');
    const [locationName, setLocationName] = useState(profile.savedLocation ?? '');
    const [saving, setSaving] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const saveSettings = useCallback(
        async (nextGeoLocation?: GeolocationCoordinates | null) => {
            setFormError(null);
            setInfo(null);

            const nextUsername = username.trim();
            const nextDisplayName = displayName.trim();
            const nextBio = bio.trim();

            if (!isValidUsername(nextUsername)) {
                setFormError(
                    'Username must be 3-30 chars and use letters, numbers, or underscore.',
                );
                return;
            }

            if (nextDisplayName.length > 80) {
                setFormError('Display name must be at most 80 characters.');
                return;
            }

            if (nextBio.length > MAX_BIO_LENGTH) {
                setFormError(`Bio must be at most ${MAX_BIO_LENGTH} characters.`);
                return;
            }

            setSaving(true);
            try {
                const payload: {
                    username: string | null;
                    displayName: string | null;
                    bio: string | null;
                    geoLocation?: GeolocationCoordinates | null;
                } = {
                    username: nextUsername.length === 0 ? null : nextUsername,
                    displayName: nextDisplayName.length === 0 ? null : nextDisplayName,
                    bio: nextBio.length === 0 ? null : nextBio,
                };

                if (nextGeoLocation !== undefined) {
                    payload.geoLocation = nextGeoLocation;
                }

                const updated = await apiJson<Profile>('/profile', 'PATCH', payload);
                setUsername(updated.username ?? '');
                setDisplayName(updated.displayName ?? '');
                setBio(updated.bio ?? '');
                setLocationName(updated.savedLocation ?? '');
                setInfo('Saved');
            } catch (e) {
                setFormError(e instanceof Error ? e.message : 'Update failed');
            } finally {
                setSaving(false);
            }
        },
        [bio, displayName, username],
    );

    const handleSignOut = useCallback(async () => {
        setSigningOut(true);
        try {
            await onSignOut();
        } finally {
            setSigningOut(false);
        }
    }, [onSignOut]);

    return (
        <div className="rounded-3xl border border-black/8 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,24,24,0.08)] backdrop-blur dark:border-white/12 dark:bg-white/5">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Signed in as
                    </p>
                    <p className="mt-1 text-sm text-black dark:text-zinc-50">
                        {profile.email ?? profile.supabaseUserId ?? 'Unknown'}
                    </p>
                </div>
                <div className="sm:text-right">
                    <button
                        type="button"
                        className="text-sm font-medium text-zinc-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-300"
                        onClick={() => void handleSignOut()}
                        disabled={signingOut}
                    >
                        {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                </div>
            </div>

            <div className="mt-6 space-y-5">
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
                            Required. Unique in the app (letters, numbers, underscore; 3–30 chars).
                        </p>
                    </div>

                    <button
                        type="button"
                        className="flex h-12 items-center justify-center rounded-2xl bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-black dark:hover:bg-white"
                        onClick={() => {
                            void saveSettings();
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
                        <div className="flex flex-wrap items-center gap-4">
                            {locationName !== null && locationName !== '' ? (
                                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                                    {locationName}
                                </p>
                            ) : (
                                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                                    Not set
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    if (!navigator.geolocation) {
                                        setFormError('Geolocation is not supported by your browser.');
                                        return;
                                    }

                                    navigator.geolocation.getCurrentPosition(
                                        (position) => {
                                            void saveSettings(position.coords);
                                        },
                                        (geoError: GeolocationPositionError) => {
                                            setFormError(
                                                geoError instanceof Error
                                                    ? geoError.message
                                                    : 'Failed to get location.',
                                            );
                                        },
                                    );
                                }}
                                disabled={saving}
                                className="inline-flex h-11 items-center justify-center rounded-2xl border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-zinc-50 dark:hover:bg-white dark:hover:text-black"
                            >
                                Update location
                            </button>
                        </div>
                    </div>
                </div>

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
            </div>

            {formError ? (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    {formError}
                </div>
            ) : null}

            {info ? (
                <div className="mt-4 rounded-2xl border border-black/8 bg-black/2 px-4 py-3 text-sm text-zinc-700 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200">
                    {info}
                </div>
            ) : null}
        </div>
    );
}

export default function SettingsPage() {
    const { profile, loading, error } = useProfile();

    const handleSignOut = useCallback(async () => {
        await getSupabaseBrowserClient().auth.signOut();
        window.location.href = '/auth';
    }, []);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex h-full items-center justify-center">
                    <Loading />
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
                            Settings
                        </h1>
                        <div className="mt-3">
                            <ErrorMessage message={error} />
                        </div>
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

    if (!profile) {
        return (
            <DashboardLayout>
                <div className="flex h-full items-center justify-center">
                    <div className="w-full max-w-md rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur">
                        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                            Settings
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

    return (
        <DashboardLayout>
            <div className="mx-auto w-full max-w-5xl space-y-6 text-zinc-50">
                <div className="rounded-3xl border border-black/8 bg-white/80 p-6 shadow-[0_24px_80px_rgba(24,24,24,0.08)] backdrop-blur dark:border-white/12 dark:bg-white/5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="max-w-2xl">
                            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                                Settings
                            </p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-4xl">
                                Account settings
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                                Update the account details that are already supported by the app:
                                username, display name, bio, and location.
                            </p>
                        </div>
                        <Link
                            href="/profile"
                            className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                        >
                            Back to profile
                        </Link>
                    </div>
                    <div className="mt-6 rounded-2xl border border-black/8 bg-white p-5 dark:border-white/12 dark:bg-black/30">
                        <SettingsForm
                            key={profile.appUserId ?? profile.supabaseUserId ?? profile.email ?? 'settings'}
                            profile={profile}
                            onSignOut={handleSignOut}
                        />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
