import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
    apiGet: jest.fn(),
}));

import { apiGet } from '@/lib/api';
import { useProfile } from '@/lib/hooks/useProfile';

function TestComponent() {
    const { profile, loading, error } = useProfile();
    if (loading) return <div>loading</div>;
    if (error) return <div role="alert">{error}</div>;
    return (
        <div>
            <div data-testid="display-name">{profile?.displayName ?? 'missing'}</div>
            <div data-testid="photo-count">{profile?.photos?.length ?? 0}</div>
        </div>
    );
}

describe('useProfile', () => {
    beforeEach(() => {
        (apiGet as jest.Mock).mockReset();
    });

    it('loads profile details from the profile endpoint', async () => {
        (apiGet as jest.Mock).mockResolvedValue({
            appUserId: 'user-1',
            username: 'alaris',
            displayName: 'Alaris',
            bio: 'Looking for study groups.',
            photos: [{ id: 'photo-1', url: 'https://example.test/photo.jpg', position: 0 }],
            savedLocation: 'Bothell',
        });

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByTestId('display-name')).toHaveTextContent('Alaris'));
        expect(screen.getByTestId('photo-count')).toHaveTextContent('1');
        expect(apiGet).toHaveBeenCalledWith('/profile');
    });

    it('clears profile state when loading fails', async () => {
        (apiGet as jest.Mock).mockRejectedValue(new Error('Profile failed'));

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Profile failed'));
        expect(screen.queryByTestId('display-name')).not.toBeInTheDocument();
    });
});
