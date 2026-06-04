import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
    apiGet: jest.fn(),
}));

import { apiGet } from '@/lib/api';
import { useGroups } from '@/lib/hooks/useGroups';

function TestComponent() {
    const { groups, loading, error } = useGroups();
    if (loading) return <div>loading</div>;
    if (error) return <div role="alert">{error}</div>;
    return (
        <div>
            {groups.map(group => (
                <div key={group.id} data-testid="group">
                    {group.name}:{group.memberCount}:{group.chatPath}
                </div>
            ))}
        </div>
    );
}

describe('useGroups', () => {
    beforeEach(() => {
        (apiGet as jest.Mock).mockReset();
    });

    it('loads my groups from the groups endpoint', async () => {
        (apiGet as jest.Mock).mockResolvedValue({
            groups: [
                {
                    id: 'group-1',
                    slug: 'study-squad',
                    name: 'Study Squad',
                    memberCount: 4,
                    myRole: 'MEMBER',
                    chatPath: '/groups/study-squad/chat',
                },
            ],
        });

        render(<TestComponent />);

        await waitFor(() =>
            expect(screen.getByText('Study Squad:4:/groups/study-squad/chat')).toBeInTheDocument(),
        );
        expect(apiGet).toHaveBeenCalledWith('/me/groups');
    });

    it('clears groups and shows the failure message when loading fails', async () => {
        (apiGet as jest.Mock).mockRejectedValue(new Error('Groups failed'));

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Groups failed'));
        expect(screen.queryAllByTestId('group')).toHaveLength(0);
    });
});
