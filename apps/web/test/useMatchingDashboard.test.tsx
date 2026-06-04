import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
    apiGet: jest.fn(),
    apiJson: jest.fn(),
}));

import { apiGet, apiJson } from '@/lib/api';
import { useMatchingDashboard, type MatchingDashboard } from '@/lib/hooks/useMatchingDashboard';

const dashboard: MatchingDashboard = {
    groupSeekings: [
        {
            id: 'seeking-1',
            targetGroupSize: 4,
            interests: [{ id: 'interest-1', slug: 'study', name: 'Study' }],
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
        },
    ],
    invitesPendingMyAnswer: [],
    openFormationsFromMySeekings: [],
    openFormationsWaitingOnOthers: [],
    connectionsCount: 7,
};

function TestComponent() {
    const { data, loading, error, createGroupSeeking, runFormation, respondToInvite } = useMatchingDashboard();
    if (loading) return <div>loading</div>;
    if (error) return <div role="alert">{error}</div>;
    return (
        <div>
            <div data-testid="seekings">{data.groupSeekings.length}</div>
            <div data-testid="connections">{data.connectionsCount}</div>
            <button onClick={() => void createGroupSeeking({ targetGroupSize: 3, interestIds: ['interest-1'] })}>
                create
            </button>
            <button onClick={() => void runFormation('seeking-1')}>run</button>
            <button onClick={() => void respondToInvite('proposal-1', true)}>accept</button>
        </div>
    );
}

describe('useMatchingDashboard', () => {
    beforeEach(() => {
        (apiGet as jest.Mock).mockReset();
        (apiJson as jest.Mock).mockReset();
    });

    it('loads dashboard sections and connection count', async () => {
        (apiGet as jest.Mock).mockResolvedValue(dashboard);

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByTestId('seekings')).toHaveTextContent('1'));
        expect(screen.getByTestId('connections')).toHaveTextContent('7');
        expect(apiGet).toHaveBeenCalledWith('/me/matching/dashboard');
    });

    it('posts group seeking creation and refreshes the dashboard', async () => {
        (apiGet as jest.Mock).mockResolvedValue(dashboard);
        (apiJson as jest.Mock).mockResolvedValue({ seeking: dashboard.groupSeekings[0] });

        render(<TestComponent />);
        await waitFor(() => expect(screen.getByTestId('seekings')).toHaveTextContent('1'));

        await userEvent.click(screen.getByText('create'));

        await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
        expect(apiJson).toHaveBeenCalledWith('/me/group-seekings', 'POST', {
            targetGroupSize: 3,
            interestIds: ['interest-1'],
        });
    });

    it('runs formation and responds to invites through matching endpoints', async () => {
        (apiGet as jest.Mock).mockResolvedValue(dashboard);
        (apiJson as jest.Mock)
            .mockResolvedValueOnce({ proposalId: 'proposal-1', reused: false })
            .mockResolvedValueOnce(undefined);

        render(<TestComponent />);
        await waitFor(() => expect(screen.getByTestId('seekings')).toHaveTextContent('1'));

        await userEvent.click(screen.getByText('run'));
        await waitFor(() =>
            expect(apiJson).toHaveBeenCalledWith('/matching/formation/run', 'POST', {
                userGroupSeekingId: 'seeking-1',
            }),
        );

        await userEvent.click(screen.getByText('accept'));
        await waitFor(() =>
            expect(apiJson).toHaveBeenCalledWith(
                '/matching/formation/proposals/proposal-1/invites/respond',
                'POST',
                { accept: true },
            ),
        );
    });

    it('resets dashboard data on load failure', async () => {
        (apiGet as jest.Mock).mockRejectedValue(new Error('Dashboard failed'));

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Dashboard failed'));
        expect(screen.queryByTestId('seekings')).not.toBeInTheDocument();
    });
});
