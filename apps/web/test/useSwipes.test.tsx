import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('@/lib/api', () => ({
  apiJson: jest.fn(),
}));

import { apiJson } from '@/lib/api';
import { useSwipes } from '@/lib/hooks/useSwipes';

function TestComponent() {
  const { postSwipe, loading } = useSwipes();
  return (
    <div>
      <button onClick={() => void postSwipe('u1', 'YES')}>yes</button>
      <div data-testid="loading">{loading ? 'loading' : 'idle'}</div>
    </div>
  );
}

describe('useSwipes', () => {
  beforeEach(() => {
    (apiJson as jest.Mock).mockReset();
  });

  it('posts swipe and toggles loading', async () => {
    (apiJson as jest.Mock).mockResolvedValue({ ok: true });

    render(<TestComponent />);
    const btn = screen.getByText('yes');
    await userEvent.click(btn);
    await waitFor(() => expect(apiJson).toHaveBeenCalledWith('/matching/swipes', 'POST', { targetUserId: 'u1', decision: 'YES' }));
    expect(screen.getByTestId('loading').textContent).toBe('idle');
  });
});
