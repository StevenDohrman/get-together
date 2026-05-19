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
    const [draggingId, setDraggingId] = useState<string | null>(null);

    // Guardrail: this hook auto-saves by default. We should only allow saves
    // after we've successfully hydrated from the server at least once.
    // Otherwise transient load failures can accidentally PUT an empty list.
    const hasHydrated = useRef<boolean>(false);

    const prevDraggingId = useRef<string | null>(null);

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
            const sortedSaved = savedInterests.slice().sort((a, b) => {
                if (b.weight !== a.weight) return b.weight - a.weight;
                return a.name.localeCompare(b.name);
            });
            setSelectedInterests(sortedSaved);
            lastSavedState.current = JSON.stringify(sortedSaved.map(i => ({ id: i.id, weight: i.weight })));
            lastFailedState.current = '';
            hasHydrated.current = true;
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load interests');
            setCatalog([]);
            // Preserve previous selection if we already have one; avoid clearing
            // during failures since this hook auto-saves.
            if (!hasHydrated.current) setSelectedInterests([]);
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
            // While a user is dragging a slider, keep the existing order so the
            // element doesn't jump away from their pointer.
            if (draggingId) return next;
            return next.sort((a, b) => {
                if (b.weight !== a.weight) return b.weight - a.weight;
                return a.name.localeCompare(b.name);
            });
        });
    }, [draggingId]);

    const startDragging = useCallback((id: string) => {
        setDraggingId(id);
    }, []);

    const stopDragging = useCallback(() => {
        setDraggingId(null);
    }, []);

    useEffect(() => {
        // Re-sort once dragging finishes.
        if (prevDraggingId.current && !draggingId) {
            setSelectedInterests(cur => cur.slice().sort((a, b) => {
                if (b.weight !== a.weight) return b.weight - a.weight;
                return a.name.localeCompare(b.name);
            }));
        }
        prevDraggingId.current = draggingId;
    }, [draggingId]);

    // Auto-save selectedInterests with debounce
    useEffect(() => {
        if (!hasHydrated.current) return;
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
        draggingId,
        startDragging,
        stopDragging,
        add,
        remove,
        updateWeight,
        refetch: fetchAll,
    } as const;
}
