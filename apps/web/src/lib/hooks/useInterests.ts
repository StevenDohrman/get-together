import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiJson } from '@/lib/api';

type Interest = {
    id: string;
    slug: string;
    name: string;
    createdAt: string;
};

type SelectedInterest = Interest & { weight: number };

type InterestsResponse = { interests: Interest[] };
type SelectedInterestsResponse = { interests: SelectedInterest[] };

const SAVE_DEBOUNCE = 700;

export function useInterests() {
    const [catalog, setCatalog] = useState<Interest[]>([]);
    const [selectedInterests, setSelectedInterests] = useState<SelectedInterest[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const saveTimeout = useRef<NodeJS.Timeout | null>(null);
    const lastSavedState = useRef<string>('');
    const lastFailedState = useRef<string>('');

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [{ interests }, { interests: savedInterests }] = await Promise.all([
                apiGet<InterestsResponse>('/interests'),
                apiGet<SelectedInterestsResponse>('/me/interests'),
            ]);
            setCatalog(interests);
            setSelectedInterests(savedInterests.slice().sort((a, b) => {
                if (b.weight !== a.weight) return b.weight - a.weight;
                return a.name.localeCompare(b.name);
            }));
            lastSavedState.current = JSON.stringify(savedInterests.map(i => ({ id: i.id, weight: i.weight })));
            lastFailedState.current = '';
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load interests');
            setCatalog([]);
            setSelectedInterests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    const add = useCallback((interest: Interest) => {
        setError(null);
        setInfo(null);
        setSelectedInterests(cur => {
            if (cur.some(i => i.id === interest.id)) return cur;
            return [...cur, { ...interest, weight: 5 }].sort((a, b) => {
                if (b.weight !== a.weight) return b.weight - a.weight;
                return a.name.localeCompare(b.name);
            });
        });
    }, []);

    const remove = useCallback((id: string) => {
        setError(null);
        setInfo(null);
        setSelectedInterests(cur => cur.filter(i => i.id !== id));
    }, []);

    const updateWeight = useCallback((id: string, weight: number) => {
        setError(null);
        setInfo(null);
        setSelectedInterests(cur => {
            const next = cur.map(i => i.id === id ? { ...i, weight } : i);
            return next.sort((a, b) => {
                if (b.weight !== a.weight) return b.weight - a.weight;
                return a.name.localeCompare(b.name);
            });
        });
    }, []);

    // Auto-save selectedInterests with debounce
    useEffect(() => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);

        const currentState = JSON.stringify(selectedInterests.map(i => ({ id: i.id, weight: i.weight })));
        if (currentState === lastSavedState.current) return;
        if (lastFailedState.current && currentState === lastFailedState.current) return;

        saveTimeout.current = setTimeout(() => {
            setSaving(true);
            setError(null);
            setInfo(null);
            lastSavedState.current = currentState;

            apiJson<SelectedInterestsResponse>('/me/interests', 'PUT', {
                interests: selectedInterests.map(i => ({ interestId: i.id, weight: Math.max(0, Math.min(10, i.weight)) })),
            })
                .then(({ interests }) => {
                    const sorted = interests.slice().sort((a, b) => {
                        if (b.weight !== a.weight) return b.weight - a.weight;
                        return a.name.localeCompare(b.name);
                    });
                    lastSavedState.current = JSON.stringify(sorted.map(i => ({ id: i.id, weight: i.weight })));
                    lastFailedState.current = '';
                    setSelectedInterests(sorted);
                    setSaving(false);
                })
                .catch((e) => {
                    lastFailedState.current = currentState;
                    setError(e instanceof Error ? e.message : 'Failed to save interests');
                    setSaving(false);
                });
        }, SAVE_DEBOUNCE);

        return () => {
            if (saveTimeout.current) clearTimeout(saveTimeout.current);
        };
    }, [selectedInterests]);

    return {
        catalog,
        selectedInterests,
        loading,
        saving,
        error,
        info,
        add,
        remove,
        updateWeight,
        refetch: fetchAll,
    } as const;
}
