import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type ProfileInterest = {
    id: string;
    slug: string;
    name: string;
    weight: number;
};

type Response = { interests: ProfileInterest[] };

/**
 * Read-only view of the current user's selected profile interests. Use this
 * when you need the user's *own* interests (with weights) rather than the
 * global catalog — e.g. the group-seeking picker which must be limited to
 * interests the user has already picked for themselves.
 */
export function useMyProfileInterests() {
    const [interests, setInterests] = useState<ProfileInterest[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInterests = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await apiGet<Response>('/me/interests');
            setInterests(resp.interests ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setInterests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchInterests();
    }, [fetchInterests]);

    return { interests, loading, error, refetch: fetchInterests } as const;
}
