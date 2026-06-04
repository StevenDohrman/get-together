import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
    apiGet: jest.fn(),
}));

import { apiGet } from '@/lib/api';
import { useUserEvents } from '@/lib/hooks/useUserEvents';

function TestComponent({ includePublic = false, limit = 2 }: { includePublic?: boolean; limit?: number }) {
    const { events, loading, error } = useUserEvents({ includePublic, limit });
    if (loading) return <div>loading</div>;
    if (error) return <div role="alert">{error}</div>;
    return (
        <div>
            {events.map(event => (
                <div key={event.id} data-testid="event">
                    {event.title}:{event.reasons.join('+')}
                </div>
            ))}
        </div>
    );
}

describe('useUserEvents', () => {
    beforeEach(() => {
        (apiGet as jest.Mock).mockReset();
    });

    it('loads user events with configured query parameters', async () => {
        (apiGet as jest.Mock).mockResolvedValue({
            events: [
                {
                    id: 'event-1',
                    title: 'Study session',
                    description: null,
                    startsAt: '2026-06-04T18:00:00.000Z',
                    endsAt: null,
                    locationName: 'Library',
                    locationAddress: null,
                    ownerType: 'GROUP',
                    hostGroup: { id: 'group-1', slug: 'study', name: 'Study' },
                    reasons: ['HOST_GROUP'],
                    myRsvp: 'GOING',
                    subscribedGroupIds: [],
                    attendeeCount: 3,
                },
            ],
        });

        render(<TestComponent includePublic={false} limit={5} />);

        await waitFor(() => expect(screen.getByText('Study session:HOST_GROUP')).toBeInTheDocument());
        expect(apiGet).toHaveBeenCalledWith('/me/events?limit=5&includePublic=false');
    });

    it('clears events and surfaces API errors', async () => {
        (apiGet as jest.Mock).mockRejectedValue(new Error('Events failed'));

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Events failed'));
        expect(screen.queryAllByTestId('event')).toHaveLength(0);
    });
});
