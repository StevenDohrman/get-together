import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
    apiGet: jest.fn(),
}));

import { apiGet } from '@/lib/api';
import { useRecentActivity } from '@/lib/hooks/useRecentActivity';

function TestComponent({ limit = 3 }: { limit?: number }) {
    const { items, loading, error } = useRecentActivity({ limit });
    if (loading) return <div>loading</div>;
    if (error) return <div role="alert">{error}</div>;
    return (
        <div>
            {items.map(item => (
                <div key={item.id} data-testid="activity-item">
                    {item.body}
                </div>
            ))}
        </div>
    );
}

describe('useRecentActivity', () => {
    beforeEach(() => {
        (apiGet as jest.Mock).mockReset();
    });

    it('loads activity with the requested limit', async () => {
        (apiGet as jest.Mock).mockResolvedValue({
            items: [
                {
                    id: 'activity-1',
                    chatId: 'chat-1',
                    kind: 'GROUP_MESSAGE',
                    group: { id: 'group-1', slug: 'group-one', name: 'Group One' },
                    proposalId: null,
                    sender: { id: 'user-1', username: 'alaris', displayName: 'Alaris', isMe: true },
                    body: 'See you at noon',
                    createdAt: '2026-06-01T00:00:00.000Z',
                },
            ],
        });

        render(<TestComponent limit={5} />);

        await waitFor(() => expect(screen.getByText('See you at noon')).toBeInTheDocument());
        expect(apiGet).toHaveBeenCalledWith('/me/activity?limit=5');
    });

    it('clears activity when loading fails', async () => {
        (apiGet as jest.Mock).mockRejectedValue(new Error('Activity failed'));

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Activity failed'));
        expect(screen.queryAllByTestId('activity-item')).toHaveLength(0);
    });
});
