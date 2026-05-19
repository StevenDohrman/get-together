import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type EventOwnerType = 'GROUP' | 'PUBLIC';

export type EventReason = 'HOST_GROUP' | 'SUBSCRIBED_GROUP' | 'PUBLIC' | 'ATTENDING';

export type UserEvent = {
    id: string;
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string | null;
    locationName: string | null;
    locationAddress: string | null;
    ownerType: EventOwnerType;
    hostGroup: { id: string; slug: string; name: string } | null;
    reasons: EventReason[];
    myRsvp: 'GOING' | 'MAYBE' | 'NOT_GOING' | null;
    subscribedGroupIds: string[];
    attendeeCount: number;
};

type EventsResponse = { events: UserEvent[] };

type Options = {
    limit?: number;
    includePublic?: boolean;
};

export function useUserEvents(options?: Options) {
    const limit = options?.limit ?? 20;
    const includePublic = options?.includePublic ?? true;

    const [events, setEvents] = useState<UserEvent[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set('limit', String(limit));
            params.set('includePublic', String(includePublic));
            const resp = await apiGet<EventsResponse>(`/me/events?${params.toString()}`);
            setEvents(resp.events ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [limit, includePublic]);

    useEffect(() => {
        void fetchEvents();
    }, [fetchEvents]);

    return { events, loading, error, refetch: fetchEvents } as const;
}
