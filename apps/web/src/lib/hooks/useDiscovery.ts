import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type DiscoveryUser = {
    id: string;
    displayName?: string;
    age?: number;
    city?: string;
    state?: string;
    avatarUrl?: string | null;
    interests?: string[];
    bio?: string | null;
    online?: boolean;
};

type DiscoveryResponse = { users: DiscoveryUser[] };

export function useDiscovery(initialLimit = 30) {
    const [users, setUsers] = useState<DiscoveryUser[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [limit, setLimit] = useState<number>(initialLimit);

    const fetchUsers = useCallback(async (l = limit) => {
        setLoading(true);
        setError(null);
        try {
            const resp = await apiGet<DiscoveryResponse>(`/matching/discovery?limit=${l}`);
            setUsers(resp.users ?? []);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load discovery users');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        void fetchUsers(limit);
    }, [fetchUsers, limit]);

    const loadMore = useCallback((more = 30) => {
        setLimit(prev => prev + more);
    }, []);

    const refetch = useCallback(() => void fetchUsers(limit), [fetchUsers, limit]);

    return {
        users,
        loading,
        error,
        limit,
        loadMore,
        refetch,
    } as const;
}
