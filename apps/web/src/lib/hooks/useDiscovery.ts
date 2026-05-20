import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type DiscoveryInterest = {
    id: string;
    slug: string;
    name: string;
    weight: number;
};

export type DiscoveryPhoto = {
    id: string;
    url: string;
    position: number;
};

export type DistanceBucket =
    | 'NEARBY'
    | 'WITHIN_5MI'
    | 'WITHIN_15MI'
    | 'WITHIN_30MI'
    | 'WITHIN_60MI'
    | 'WITHIN_120MI'
    | 'FAR';

export type DiscoveryUser = {
    id: string;
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    photos: DiscoveryPhoto[];
    city: string | null;
    /** Coarse distance bucket. Precise distance is never sent to clients. */
    distanceBucket: DistanceBucket | null;
    interests: DiscoveryInterest[];
    sharedInterestNames: string[];
    matchedGroupSize: number | null;
    sharedInterestCount: number;
    matchScore: number;
    rawMatchScore: number;
};

export type DiscoveryReason =
    | 'NO_SEEKINGS'
    | 'COMPATIBLE_SEEKINGS'
    | 'PROFILE_FALLBACK'
    | 'EMPTY';

type DiscoveryResponse = {
    users: DiscoveryUser[];
    reason: DiscoveryReason;
};

export function useDiscovery(options?: { initialLimit?: number }) {
    const initialLimit = options?.initialLimit ?? 30;

    const [users, setUsers] = useState<DiscoveryUser[]>([]);
    const [reason, setReason] = useState<DiscoveryReason>('EMPTY');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [limit, setLimit] = useState<number>(initialLimit);

    const fetchUsers = useCallback(async (l: number) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ limit: String(l) });
            const resp = await apiGet<DiscoveryResponse>(`/matching/discovery?${params.toString()}`);
            setUsers(resp.users ?? []);
            setReason(resp.reason ?? 'EMPTY');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load discovery users');
            setUsers([]);
            setReason('EMPTY');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchUsers(limit);
    }, [fetchUsers, limit]);

    const loadMore = useCallback((more = 30) => {
        setLimit(prev => prev + more);
    }, []);

    const refetch = useCallback(() => void fetchUsers(limit), [fetchUsers, limit]);

    return {
        users,
        reason,
        loading,
        error,
        limit,
        loadMore,
        refetch,
    } as const;
}
