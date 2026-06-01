'use client';

import { initialsFor, pickGradient } from '@/lib/avatarUtils';
import { useMemo } from 'react';
import type { DiscoveryUser, DistanceBucket } from '@/lib/hooks/useDiscovery';

type Props = {
    user: DiscoveryUser;
    disabled?: boolean;
    onSwipe?: (id: string, decision: 'YES' | 'NO') => void;
};

const DISTANCE_BUCKET_LABELS: Record<DistanceBucket, string> = {
    NEARBY: 'Nearby',
    WITHIN_5MI: '< 5 mi away',
    WITHIN_15MI: '< 15 mi away',
    WITHIN_30MI: '< 30 mi away',
    WITHIN_60MI: '< 60 mi away',
    WITHIN_120MI: '< 120 mi away',
    FAR: '120+ mi away',
};

function formatDistanceBucket(bucket: DistanceBucket | null): string | null {
    if (!bucket) return null;
    return DISTANCE_BUCKET_LABELS[bucket];
}

function locationLine(user: DiscoveryUser): string | null {
    const distance = formatDistanceBucket(user.distanceBucket);
    const parts = [user.city, distance].filter((p): p is string => !!p);
    return parts.length > 0 ? parts.join(' · ') : null;
}

const PLACEHOLDER_BIO = 'Hasn’t written a bio yet — say hi and find out more!';

export default function DiscoverCard({ user, disabled = false, onSwipe }: Props) {
    const displayName = user.displayName ?? user.username ?? 'Someone';
    const initials = useMemo(() => initialsFor(displayName), [displayName]);
    const gradient = useMemo(() => pickGradient(user.id), [user.id]);
    const location = locationLine(user);
    const sharedNameSet = useMemo(
        () => new Set(user.sharedInterestNames),
        [user.sharedInterestNames],
    );

    const orderedInterests = useMemo(() => {
        const shared = user.interests.filter(i => sharedNameSet.has(i.name));
        const others = user.interests.filter(i => !sharedNameSet.has(i.name));
        return [...shared, ...others].slice(0, 5);
    }, [user.interests, sharedNameSet]);

    return (
        <article
            id={`discover-card-${user.id}`}
            className="overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10"
        >
            <div className={`relative aspect-[4/5] w-full bg-gradient-to-br ${gradient}`}>
                {user.avatarUrl ? (
                    <img
                        src={user.avatarUrl}
                        alt={displayName}
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <span
                            aria-hidden
                            className="select-none text-[12rem] font-black tracking-tight text-white/25"
                        >
                            {initials}
                        </span>
                    </div>
                )}

                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/95 via-black/65 to-transparent" />

                <button
                    type="button"
                    aria-label="More options"
                    disabled
                    className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur transition-colors hover:bg-black/60"
                >
                    <span aria-hidden className="text-lg leading-none">⋯</span>
                </button>

                <div className="absolute inset-x-0 bottom-0 space-y-3 p-6 text-white">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-3xl font-bold leading-tight">{displayName}</h2>
                            <span
                                className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.7)]"
                                aria-hidden
                                title="Recently active"
                            />
                        </div>
                        {location ? (
                            <p className="mt-1 text-sm text-white/80">{location}</p>
                        ) : (
                            <p className="mt-1 text-sm text-white/60">Location not shared</p>
                        )}
                    </div>

                    {orderedInterests.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {orderedInterests.map(interest => {
                                const isShared = sharedNameSet.has(interest.name);
                                return (
                                    <span
                                        key={interest.id}
                                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                                            isShared
                                                ? 'bg-purple-500/90 text-white'
                                                : 'bg-white/15 text-white/90 backdrop-blur'
                                        }`}
                                        title={isShared ? 'Shared interest' : undefined}
                                    >
                                        {interest.name}
                                    </span>
                                );
                            })}
                        </div>
                    ) : null}

                    <p className={`text-sm leading-relaxed ${user.bio ? 'text-white/90' : 'italic text-white/60'}`}>
                        {user.bio ?? PLACEHOLDER_BIO}
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-center gap-8 px-6 py-6">
                <button
                    type="button"
                    aria-label={`Skip ${displayName}`}
                    disabled={disabled}
                    onClick={() => onSwipe?.(user.id, 'NO')}
                    className="group inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-white transition-all hover:bg-slate-700 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <svg
                        viewBox="0 0 24 24"
                        className="h-7 w-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        aria-hidden
                    >
                        <path d="M6 6 L18 18 M18 6 L6 18" />
                    </svg>
                </button>

                <button
                    type="button"
                    aria-label={`Connect with ${displayName}`}
                    disabled={disabled}
                    onClick={() => onSwipe?.(user.id, 'YES')}
                    className="group inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg shadow-rose-900/40 transition-all hover:scale-105 hover:from-pink-400 hover:to-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <svg
                        viewBox="0 0 24 24"
                        className="h-7 w-7"
                        fill="currentColor"
                        aria-hidden
                    >
                        <path d="M12 21s-7-4.5-9.5-9.5C.8 8.1 3 5 6.2 5c2 0 3.5 1.2 4.3 2.6.8-1.4 2.3-2.6 4.3-2.6C18 5 20.2 8.1 18.5 11.5 16 16.5 12 21 12 21z" />
                    </svg>
                </button>
            </div>
        </article>
    );
}
