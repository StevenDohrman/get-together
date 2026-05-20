import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiJson } from '@/lib/api';

export type Photo = {
    id: string;
    url: string;
    position: number;
};

export const MAX_PHOTOS = 6;

type ListResponse = { photos: Photo[] };
type CreateResponse = { photo: Photo };

export function usePhotos() {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const fetchPhotos = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await apiGet<ListResponse>('/me/photos');
            setPhotos((resp.photos ?? []).sort((a, b) => a.position - b.position));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load photos');
            setPhotos([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchPhotos();
    }, [fetchPhotos]);

    const add = useCallback(
        async (url: string) => {
            setBusy(true);
            setError(null);
            try {
                const resp = await apiJson<CreateResponse>('/me/photos', 'POST', { url });
                setPhotos(curr => [...curr, resp.photo].sort((a, b) => a.position - b.position));
                return resp.photo;
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to add photo');
                throw e;
            } finally {
                setBusy(false);
            }
        },
        [],
    );

    const remove = useCallback(async (id: string) => {
        setBusy(true);
        setError(null);
        try {
            await apiJson(`/me/photos/${id}`, 'DELETE');
            setPhotos(curr => curr.filter(p => p.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete photo');
            throw e;
        } finally {
            setBusy(false);
        }
    }, []);

    const reorder = useCallback(async (orderedIds: string[]) => {
        setBusy(true);
        setError(null);
        const previous = photos;
        // Optimistic: re-sequence locally so the UI doesn't flicker.
        const byId = new Map(photos.map(p => [p.id, p]));
        const next = orderedIds
            .map((id, idx) => {
                const p = byId.get(id);
                return p ? { ...p, position: idx } : null;
            })
            .filter((p): p is Photo => !!p);
        setPhotos(next);
        try {
            const resp = await apiJson<ListResponse>('/me/photos/order', 'PUT', {
                photoIds: orderedIds,
            });
            setPhotos((resp.photos ?? []).sort((a, b) => a.position - b.position));
        } catch (e) {
            setPhotos(previous);
            setError(e instanceof Error ? e.message : 'Failed to reorder photos');
            throw e;
        } finally {
            setBusy(false);
        }
    }, [photos]);

    return { photos, loading, error, busy, refetch: fetchPhotos, add, remove, reorder } as const;
}
