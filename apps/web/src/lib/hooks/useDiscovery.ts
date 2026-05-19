import { useCallback, useEffect, useMemo, useState } from 'react';
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

export function useDiscovery(options?: { initialLimit?: number; filters?: Record<string, unknown> }) {
    const initialLimit = options?.initialLimit ?? 30;
    const filters = options?.filters ?? {};

    const [users, setUsers] = useState<DiscoveryUser[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [limit, setLimit] = useState<number>(initialLimit);

    const serializedFilters = useMemo(() => JSON.stringify(filters), [filters]);

    const buildQuery = useCallback((l: number, fStr: string) => {
        const params = new URLSearchParams();
        params.set('limit', String(l));
        try {
            const f = JSON.parse(fStr) as Record<string, unknown>;
            for (const [k, v] of Object.entries(f)) {
                if (v === undefined || v === null) continue;
                if (Array.isArray(v)) {
                    params.set(k, v.join(','));
                } else if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') {
                    params.set(k, String(v));
                } else {
                    // fallback to JSON string
                    params.set(k, JSON.stringify(v));
                }
            }
        } catch {
            // ignore parse errors
        }
        return params.toString();
    }, []);

    const fetchUsers = useCallback(async (l = limit, fStr = serializedFilters) => {
        setLoading(true);
        setError(null);
        try {
            const qs = buildQuery(l, fStr);
            const resp = await apiGet<DiscoveryResponse>(`/matching/discovery?${qs}`);
            setUsers(resp.users ?? []);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load discovery users');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [buildQuery, limit, serializedFilters]);

    useEffect(() => {
        void fetchUsers(limit, serializedFilters);
    }, [fetchUsers, limit, serializedFilters]);

    const loadMore = useCallback((more = 30) => {
        setLimit(prev => prev + more);
    }, []);

    const refetch = useCallback(() => void fetchUsers(limit, serializedFilters), [fetchUsers, limit, serializedFilters]);

    return {
        users,
        loading,
        error,
        limit,
        loadMore,
        refetch,
    } as const;
}
