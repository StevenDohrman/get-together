import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
    apiGet: jest.fn(),
}));

import { apiGet } from '@/lib/api';
import { useDiscovery, DiscoveryUser } from '@/lib/hooks/useDiscovery';

function TestComponent({ limit = 2 }: { limit?: number }) {
    const { users, loading, error } = useDiscovery({ initialLimit: limit });
    if (loading) return <div>loading</div>;
    if (error) return <div>error</div>;
    return (
        <div>
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
        const users: DiscoveryUser[] = [
            { id: 'a', displayName: 'Alice' },
            { id: 'b', displayName: 'Bob' },
        ];
        (apiGet as jest.Mock).mockResolvedValue({ users });

        render(<TestComponent />);

        await waitFor(() => expect(screen.queryAllByTestId('user').length).toBe(2));
        expect(screen.getByText('Alice')).toBeInTheDocument();
    });
});
