'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from './DashboardLayout';
import DiscoverCard from './DiscoverCard';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import { initialsFor, pickGradient } from '@/lib/avatarUtils';
import { useDiscovery, type DiscoveryUser } from '@/lib/hooks/useDiscovery';
import { useLikedUsers, type LikedUser } from '@/lib/hooks/useLikedUsers';
import { useSwipes } from '@/lib/hooks/useSwipes';

const MAX_DOTS = 5;

function DeckProgress({ index, total }: { index: number; total: number }) {
    const dots = Math.min(MAX_DOTS, Math.max(1, total));
    return (
        <div
            className="mt-6 flex items-center justify-center gap-2"
            role="status"
            aria-label={`Card ${Math.min(index + 1, total)} of ${total}`}
        >
            {Array.from({ length: dots }).map((_, i) => (
                <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                        i === 0 ? 'w-8 bg-purple-500' : 'w-2 bg-slate-700'
                    }`}
                />
            ))}
        </div>
    );
}

function NoSeekingsEmpty() {
    return (
        <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
            <div className="text-5xl" aria-hidden>
                🎯
            </div>
            <h2 className="mt-4 text-2xl font-bold text-white">
                Tell us what kind of group you’re looking for
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Discover matches people who are seeking the same size group and share
                some of your interests. Add a group seeking on your dashboard and
                we’ll start surfacing people for you.
            </p>
            <Link
                href="/dashboard"
                className="mt-6 inline-block rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
            >
                Start a group seeking →
            </Link>
        </div>
    );
}

function CaughtUpEmpty({ onRefresh }: { onRefresh: () => void }) {
    return (
        <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
            <div className="text-5xl" aria-hidden>
                ✨
            </div>
            <h2 className="mt-4 text-2xl font-bold text-white">You’re all caught up</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
                No new matches right now. Check back soon as more people fill out
                their group seekings, or refresh to look again.
            </p>
            <button
                type="button"
                onClick={onRefresh}
                className="mt-6 inline-block rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
            >
                Refresh
            </button>
        </div>
    );
}

function formatLikedDate(iso: string): string {
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
    }).format(new Date(iso));
}

function LikedPeoplePanel({
    users,
    loading,
    error,
    onRefresh,
}: {
    users: LikedUser[];
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
}) {
    return (
        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-white">Liked by you</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        People you swiped yes on.
                    </p>
                </div>
                <button
                    type="button"
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-purple-400 hover:text-white"
                    onClick={onRefresh}
                    disabled={loading}
                >
                    Refresh
                </button>
            </div>

            {error ? (
                <div className="mt-4">
                    <ErrorMessage message={error} />
                </div>
            ) : null}

            {loading ? (
                <div className="mt-6">
                    <Loading />
                </div>
            ) : users.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-400">
                    No liked people yet. Swipe yes on someone in Discover and they will appear here.
                </p>
            ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {users.map((user) => {
                        const name = user.displayName ?? user.username ?? 'Someone';
                        const gradient = pickGradient(user.id);
                        const interests = user.interests.slice(0, 3);

                        return (
                            <article
                                key={user.id}
                                className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                            >
                                <div
                                    className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-sm font-bold text-white ${gradient}`}
                                >
                                    {user.avatarUrl ? (
                                        <div
                                            aria-label={`${name} profile photo`}
                                            role="img"
                                            className="absolute inset-0 bg-cover bg-center"
                                            style={{ backgroundImage: `url(${user.avatarUrl})` }}
                                        />
                                    ) : (
                                        initialsFor(name)
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-white">
                                                {name}
                                            </p>
                                            <p className="truncate text-xs text-slate-500">
                                                {user.username ? `@${user.username}` : 'No username set'}
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-[11px] text-slate-500">
                                            {formatLikedDate(user.likedAt)}
                                        </span>
                                    </div>
                                    {interests.length > 0 ? (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {interests.map((interest) => (
                                                <span
                                                    key={interest.id}
                                                    className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                                                >
                                                    {interest.name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default function DiscoverClient() {
    const { users, reason, loading, error, refetch } = useDiscovery({ initialLimit: 20 });
    const {
        users: likedUsers,
        loading: likedLoading,
        error: likedError,
        refetch: refetchLiked,
    } = useLikedUsers();
    const [visible, setVisible] = useState<DiscoveryUser[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const { postSwipe } = useSwipes();

    useEffect(() => {
        setVisible(users);
    }, [users]);

    const handleSwipe = useCallback(
        async (id: string, decision: 'YES' | 'NO') => {
            setBusyId(id);
            setActionError(null);
            const previous = visible;
            setVisible(cur => cur.filter(u => u.id !== id));
            try {
                await postSwipe(id, decision);
                if (decision === 'YES') await refetchLiked();
            } catch (e) {
                setVisible(previous);
                setActionError(e instanceof Error ? e.message : 'Failed to record swipe');
            } finally {
                setBusyId(null);
            }
        },
        [postSwipe, refetchLiked, visible],
    );

    const topCard = visible[0];

    return (
        <DashboardLayout>
            <div className="mx-auto w-full max-w-3xl">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-white">Find / Discover</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        People with compatible group seekings and shared interests.
                    </p>
                </header>

                {error ? (
                    <div className="mb-4">
                        <ErrorMessage message={error} />
                    </div>
                ) : null}

                {actionError ? (
                    <div className="mb-4">
                        <ErrorMessage message={actionError} />
                    </div>
                ) : null}

                {loading && visible.length === 0 ? (
                    <div className="flex justify-center py-16">
                        <Loading />
                    </div>
                ) : null}

                {!loading && reason === 'NO_SEEKINGS' ? <NoSeekingsEmpty /> : null}

                {!loading && reason !== 'NO_SEEKINGS' && visible.length === 0 ? (
                    <CaughtUpEmpty onRefresh={() => void refetch()} />
                ) : null}

                {topCard ? (
                    <div className="mx-auto max-w-md">
                        <DiscoverCard
                            user={topCard}
                            disabled={!!busyId}
                            onSwipe={(id, d) => void handleSwipe(id, d)}
                        />
                        <DeckProgress index={0} total={visible.length} />
                    </div>
                ) : null}

                <LikedPeoplePanel
                    users={likedUsers}
                    loading={likedLoading}
                    error={likedError}
                    onRefresh={() => void refetchLiked()}
                />
            </div>
        </DashboardLayout>
    );
}
