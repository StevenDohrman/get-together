import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
    apiGet: jest.fn(),
}));

import { apiGet } from '@/lib/api';
import { useLikedUsers } from '@/lib/hooks/useLikedUsers';

function TestComponent() {
    const { users, loading, error } = useLikedUsers();
    if (loading) return <div>loading</div>;
    if (error) return <div role="alert">{error}</div>;
    return (
        <div>
            {users.map(user => (
                <div key={user.id} data-testid="liked-user">
                    {user.displayName ?? user.username ?? user.id}
                </div>
            ))}
        </div>
    );
}

describe('useLikedUsers', () => {
    beforeEach(() => {
        (apiGet as jest.Mock).mockReset();
    });

    it('loads liked users from the matching endpoint', async () => {
        (apiGet as jest.Mock).mockResolvedValue({
            users: [
                {
                    id: 'user-1',
                    username: 'alaris',
                    displayName: 'Alaris',
                    bio: null,
                    avatarUrl: null,
                    photos: [],
                    likedAt: '2026-06-01T00:00:00.000Z',
                    interests: [],
                },
            ],
        });

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByText('Alaris')).toBeInTheDocument());
        expect(apiGet).toHaveBeenCalledWith('/matching/liked');
    });

    it('clears users and surfaces API failures', async () => {
        (apiGet as jest.Mock).mockRejectedValue(new Error('Not signed in'));

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not signed in'));
        expect(screen.queryAllByTestId('liked-user')).toHaveLength(0);
    });
});
