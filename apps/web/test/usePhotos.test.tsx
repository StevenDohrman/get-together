import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
    apiGet: jest.fn(),
    apiJson: jest.fn(),
}));

import { apiGet, apiJson } from '@/lib/api';
import { usePhotos } from '@/lib/hooks/usePhotos';

function TestComponent() {
    const { photos, loading, error, busy, add, remove, reorder } = usePhotos();
    if (loading) return <div>loading</div>;
    return (
        <div>
            {error ? <div role="alert">{error}</div> : null}
            <div data-testid="busy">{busy ? 'busy' : 'idle'}</div>
            <div data-testid="photos">{photos.map(photo => photo.id).join(',')}</div>
            <button onClick={() => void add('https://example.test/new.jpg').catch(() => undefined)}>add</button>
            <button onClick={() => void remove('photo-1').catch(() => undefined)}>remove</button>
            <button onClick={() => void reorder(['photo-2', 'photo-1']).catch(() => undefined)}>reorder</button>
        </div>
    );
}

describe('usePhotos', () => {
    beforeEach(() => {
        (apiGet as jest.Mock).mockReset();
        (apiJson as jest.Mock).mockReset();
    });

    it('loads photos sorted by position', async () => {
        (apiGet as jest.Mock).mockResolvedValue({
            photos: [
                { id: 'photo-2', url: '/two.jpg', position: 1 },
                { id: 'photo-1', url: '/one.jpg', position: 0 },
            ],
        });

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByTestId('photos')).toHaveTextContent('photo-1,photo-2'));
        expect(apiGet).toHaveBeenCalledWith('/me/photos');
    });

    it('adds and removes photos through the photo endpoints', async () => {
        (apiGet as jest.Mock).mockResolvedValue({
            photos: [{ id: 'photo-1', url: '/one.jpg', position: 0 }],
        });
        (apiJson as jest.Mock)
            .mockResolvedValueOnce({ photo: { id: 'photo-2', url: '/two.jpg', position: 1 } })
            .mockResolvedValueOnce(undefined);

        render(<TestComponent />);
        await waitFor(() => expect(screen.getByTestId('photos')).toHaveTextContent('photo-1'));

        await userEvent.click(screen.getByText('add'));
        await waitFor(() => expect(screen.getByTestId('photos')).toHaveTextContent('photo-1,photo-2'));
        expect(apiJson).toHaveBeenCalledWith('/me/photos', 'POST', { url: 'https://example.test/new.jpg' });

        await userEvent.click(screen.getByText('remove'));
        await waitFor(() => expect(screen.getByTestId('photos')).toHaveTextContent('photo-2'));
        expect(apiJson).toHaveBeenCalledWith('/me/photos/photo-1', 'DELETE');
    });

    it('rolls back optimistic reorder when the API fails', async () => {
        (apiGet as jest.Mock).mockResolvedValue({
            photos: [
                { id: 'photo-1', url: '/one.jpg', position: 0 },
                { id: 'photo-2', url: '/two.jpg', position: 1 },
            ],
        });
        (apiJson as jest.Mock).mockRejectedValue(new Error('Reorder failed'));

        render(<TestComponent />);
        await waitFor(() => expect(screen.getByTestId('photos')).toHaveTextContent('photo-1,photo-2'));

        await userEvent.click(screen.getByText('reorder'));

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Reorder failed'));
        expect(screen.getByTestId('photos')).toHaveTextContent('photo-1,photo-2');
        expect(apiJson).toHaveBeenCalledWith('/me/photos/order', 'PUT', {
            photoIds: ['photo-2', 'photo-1'],
        });
    });
});
