import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
    apiGet: jest.fn(),
    apiJson: jest.fn(),
}));

import { apiGet, apiJson } from '@/lib/api';
import { useInterests } from '@/lib/hooks/useInterests';

const catalog = [
    { id: 'interest-1', slug: 'study', name: 'Study', createdAt: '2026-06-01T00:00:00.000Z' },
    { id: 'interest-2', slug: 'music', name: 'Music', createdAt: '2026-06-01T00:00:00.000Z' },
];

function TestComponent() {
    const {
        catalog: interestCatalog,
        selectedInterests,
        loading,
        saving,
        error,
        add,
        remove,
        updateWeight,
        startDragging,
        stopDragging,
    } = useInterests();
    if (loading) return <div>loading</div>;
    return (
        <div>
            {error ? <div role="alert">{error}</div> : null}
            <div data-testid="catalog">{interestCatalog.map(interest => interest.name).join(',')}</div>
            <div data-testid="selected">
                {selectedInterests.map(interest => `${interest.name}:${interest.weight}`).join(',')}
            </div>
            <div data-testid="saving">{saving ? 'saving' : 'idle'}</div>
            <button onClick={() => add(catalog[1])}>add music</button>
            <button onClick={() => remove('interest-1')}>remove study</button>
            <button onClick={() => updateWeight('interest-1', 2)}>lower study</button>
            <button onClick={() => startDragging('interest-1')}>start drag</button>
            <button onClick={() => stopDragging()}>stop drag</button>
        </div>
    );
}

describe('useInterests', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        (apiGet as jest.Mock).mockReset();
        (apiJson as jest.Mock).mockReset();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('loads catalog and saved interests sorted by weight', async () => {
        (apiGet as jest.Mock)
            .mockResolvedValueOnce({ interests: catalog })
            .mockResolvedValueOnce({
                interests: [
                    { ...catalog[0], weight: 3 },
                    { ...catalog[1], weight: 8 },
                ],
            });

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByTestId('catalog')).toHaveTextContent('Study,Music'));
        expect(screen.getByTestId('selected')).toHaveTextContent('Music:8,Study:3');
        expect(apiGet).toHaveBeenCalledWith('/interests');
        expect(apiGet).toHaveBeenCalledWith('/me/interests');
    });

    it('adds, removes, and auto-saves selected interests', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        (apiGet as jest.Mock)
            .mockResolvedValueOnce({ interests: catalog })
            .mockResolvedValueOnce({ interests: [{ ...catalog[0], weight: 6 }] });
        (apiJson as jest.Mock).mockResolvedValue({
            interests: [{ ...catalog[1], weight: 5 }],
        });

        render(<TestComponent />);
        await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('Study:6'));

        await user.click(screen.getByText('add music'));
        expect(screen.getByTestId('selected')).toHaveTextContent('Study:6,Music:5');

        await user.click(screen.getByText('remove study'));
        expect(screen.getByTestId('selected')).toHaveTextContent('Music:5');

        await act(async () => {
            jest.advanceTimersByTime(700);
        });

        await waitFor(() =>
            expect(apiJson).toHaveBeenCalledWith('/me/interests', 'PUT', {
                interests: [{ interestId: 'interest-2', weight: 5 }],
            }),
        );
    });

    it('holds sort order while dragging and resorts after drag stops', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        (apiGet as jest.Mock)
            .mockResolvedValueOnce({ interests: catalog })
            .mockResolvedValueOnce({
                interests: [
                    { ...catalog[0], weight: 9 },
                    { ...catalog[1], weight: 5 },
                ],
            });
        (apiJson as jest.Mock).mockResolvedValue({
            interests: [
                { ...catalog[1], weight: 5 },
                { ...catalog[0], weight: 2 },
            ],
        });

        render(<TestComponent />);
        await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('Study:9,Music:5'));

        await user.click(screen.getByText('start drag'));
        await user.click(screen.getByText('lower study'));
        expect(screen.getByTestId('selected')).toHaveTextContent('Study:2,Music:5');

        await user.click(screen.getByText('stop drag'));
        await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('Music:5,Study:2'));
    });

    it('surfaces load failures without saving empty selections', async () => {
        (apiGet as jest.Mock).mockRejectedValue(new Error('Interests failed'));

        render(<TestComponent />);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Interests failed'));
        expect(screen.getByTestId('catalog')).toHaveTextContent('');
        expect(screen.getByTestId('selected')).toHaveTextContent('');
        expect(apiJson).not.toHaveBeenCalled();
    });
});
