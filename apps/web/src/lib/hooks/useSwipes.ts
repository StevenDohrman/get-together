import { useCallback, useState } from 'react';
import { apiJson } from '@/lib/api';

type SwipeDecision = 'YES' | 'NO';

type SwipeResult = {
    ok: boolean;
    formationResults?: unknown[];
};

export function useSwipes() {
    const [loading, setLoading] = useState(false);

    const postSwipe = useCallback(async (targetUserId: string, decision: SwipeDecision) => {
        setLoading(true);
        try {
            const result = await apiJson<SwipeResult>('/matching/swipes', 'POST', { targetUserId, decision });
            return result;
        } finally {
            setLoading(false);
        }
    }, []);

    return { postSwipe, loading } as const;
}
