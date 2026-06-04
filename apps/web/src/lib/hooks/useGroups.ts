import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type GroupSummary = {
    id: string;
    slug: string;
    name: string;
    memberCount: number;
    myRole: string;
    chatPath: string;
};

type GroupsResponse = {
    groups: GroupSummary[];
};

function messageFromError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export function useGroups() {
    const [groups, setGroups] = useState<GroupSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGroups = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiGet<GroupsResponse>('/me/groups');
            setGroups(data.groups ?? []);
        } catch (err: unknown) {
            setError(messageFromError(err));
            setGroups([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchGroups();
    }, [fetchGroups]);

    return { groups, loading, error, refetch: fetchGroups } as const;
}
