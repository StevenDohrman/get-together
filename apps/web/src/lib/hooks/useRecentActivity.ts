import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type ActivityItem = {
    id: string;
    chatId: string;
    kind: 'GROUP_MESSAGE';
    group: { id: string; slug: string; name: string } | null;
    proposalId: string | null;
    sender: {
        id: string;
        username: string | null;
        displayName: string | null;
        isMe: boolean;
    };
    body: string;
    createdAt: string;
};

type Response = { items: ActivityItem[] };

export function useRecentActivity({ limit = 3 }: { limit?: number } = {}) {
    const [items, setItems] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchActivity = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set('limit', String(limit));
            const resp = await apiGet<Response>(`/me/activity?${params.toString()}`);
            setItems(resp.items ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        void fetchActivity();
    }, [fetchActivity]);

    return { items, loading, error, refetch: fetchActivity } as const;
}
