import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
    apiGet: jest.fn(),
}));

import { apiGet } from '@/lib/api';
import { useDiscovery, type DiscoveryUser } from '@/lib/hooks/useDiscovery';

function userFixture(id: string, displayName: string): DiscoveryUser {
    return {
        id,
        username: null,
        displayName,
        bio: null,
        avatarUrl: null,
        photos: [],
        city: null,
        distanceBucket: null,
        interests: [],
        sharedInterestNames: [],
        matchedGroupSize: 3,
        sharedInterestCount: 1,
        matchScore: 0.9,
        rawMatchScore: 9,
    };
}

function TestComponent({ limit = 2 }: { limit?: number }) {
    const { users, reason, loading, error } = useDiscovery({ initialLimit: limit });
    if (loading) return <div>loading</div>;
    if (error) return <div>error</div>;
    return (
        <div>
            <div data-testid="reason">{reason}</div>
            {users.map(u => (
                <div key={u.id} data-testid="user">{u.displayName}</div>
            ))}
        </div>
    );
}

describe('useDiscovery', () => {
    beforeEach(() => {
        (apiGet as jest.Mock).mockReset();
    });

    it('loads users and renders them', async () => {
        const users: DiscoveryUser[] = [userFixture('a', 'Alice'), userFixture('b', 'Bob')];
        (apiGet as jest.Mock).mockResolvedValue({ users, reason: 'COMPATIBLE_SEEKINGS' });

        render(<TestComponent />);

        await waitFor(() => expect(screen.queryAllByTestId('user').length).toBe(2));
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByTestId('reason')).toHaveTextContent('COMPATIBLE_SEEKINGS');
    });

    it('surfaces the NO_SEEKINGS reason with no users', async () => {
        (apiGet as jest.Mock).mockResolvedValue({ users: [], reason: 'NO_SEEKINGS' });

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByTestId('reason')).toHaveTextContent('NO_SEEKINGS'));
        expect(screen.queryAllByTestId('user').length).toBe(0);
    });
});
