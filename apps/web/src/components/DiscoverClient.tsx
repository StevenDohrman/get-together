"use client";

import { useCallback, useEffect, useState } from 'react';
import { useDiscovery } from '@/lib/hooks/useDiscovery';
import { useSwipes } from '@/lib/hooks/useSwipes';
import DiscoverCard from './DiscoverCard';
import DiscoverFilters from './DiscoverFilters';

export default function DiscoverClient() {
    const [filters, setFilters] = useState<Record<string, unknown>>({});
    const { users, loading, error, loadMore, refetch } = useDiscovery({ initialLimit: 12, filters });
    const [visible, setVisible] = useState(users);
    const [busyId, setBusyId] = useState<string | null>(null);
    const { postSwipe, loading: swipeLoading } = useSwipes();

    useEffect(() => {
        setVisible(users);
    }, [users]);

    // After visible changes (e.g., optimistic remove), focus the first card for keyboard users
    useEffect(() => {
        if (visible.length === 0) return;
        const firstId = visible[0].id;
        const el = document.getElementById(`discover-card-${firstId}`) as HTMLElement | null;
        if (el) el.focus();
    }, [visible]);

    const handleSwipe = useCallback(async (id: string, decision: 'YES' | 'NO') => {
        setBusyId(id);
        // Optimistic remove
        setVisible(cur => cur.filter(u => u.id !== id));
        try {
            await postSwipe(id, decision);
        } catch (e: any) {
            // Revert on error and surface nothing fancy for now
            await refetch();
        } finally {
            setBusyId(null);
        }
    }, [postSwipe, refetch]);

    if (loading && visible.length === 0) return <div className="px-4 py-6">Loading...</div>;
    if (error) return <div className="px-4 py-6 text-red-400">{error}</div>;

    return (
        <div className="space-y-4 px-4 py-6">
            <DiscoverFilters onApply={f => setFilters(f)} />

            {visible.length === 0 && <div className="text-slate-400">No users found — try adjusting filters.</div>}
            {visible.map(user => (
                <DiscoverCard
                    key={user.id}
                    user={user}
                    onSwipe={(id, d) => void handleSwipe(id, d)}
                    disabled={!!busyId || swipeLoading}
                />
            ))}

            <div className="mt-4 flex items-center justify-between">
                <button
                    className="rounded bg-slate-700 px-3 py-2 text-sm text-white"
                    onClick={() => loadMore(12)}
                >
                    Load more
                </button>
                <button
                    className="rounded bg-slate-700 px-3 py-2 text-sm text-white"
                    onClick={() => void refetch()}
                >
                    Refresh
                </button>
            </div>
        </div>
    );
}
