'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from './DashboardLayout';
import DiscoverCard from './DiscoverCard';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import { useDiscovery, type DiscoveryUser } from '@/lib/hooks/useDiscovery';
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

export default function DiscoverClient() {
    const { users, reason, loading, error, refetch } = useDiscovery({ initialLimit: 20 });
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
            } catch (e) {
                setVisible(previous);
                setActionError(e instanceof Error ? e.message : 'Failed to record swipe');
            } finally {
                setBusyId(null);
            }
        },
        [postSwipe, visible],
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
            </div>
        </DashboardLayout>
    );
}
