import { apiGet, apiJson } from '@/lib/api';

const getSession = jest.fn();

jest.mock('@/lib/supabaseBrowser', () => ({
    getSupabaseBrowserClient: () => ({
        auth: { getSession },
    }),
}));

function mockSession(token: string | null) {
    getSession.mockResolvedValue({
        data: {
            session: token ? { access_token: token } : null,
        },
    });
}

function mockJsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
    const status = init.status ?? 200;
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: init.statusText ?? '',
        json: jest.fn().mockResolvedValue(body),
    };
}

function mockEmptyResponse(init: { status?: number; statusText?: string } = {}) {
    const status = init.status ?? 204;
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: init.statusText ?? '',
        json: jest.fn().mockResolvedValue(undefined),
    };
}

describe('api helpers', () => {
    beforeEach(() => {
        getSession.mockReset();
        global.fetch = jest.fn();
    });

    it('rejects requests when the browser has no session token', async () => {
        mockSession(null);

        await expect(apiGet('/profile')).rejects.toThrow('Not signed in');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('sends authenticated GET requests and parses JSON', async () => {
        mockSession('token-1');
        (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ appUserId: 'user-1' }));

        await expect(apiGet('/profile')).resolves.toEqual({ appUserId: 'user-1' });

        const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toBe('http://localhost:4000/profile');
        expect(init.method).toBe('GET');
        expect(init.headers.get('Authorization')).toBe('Bearer token-1');
    });

    it('sends JSON bodies only when a body is provided', async () => {
        mockSession('token-2');
        (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ ok: true }));

        await apiJson('/matching/swipes', 'POST', { targetUserId: 'u1', decision: 'YES' });

        const [, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(init.body).toBe(JSON.stringify({ targetUserId: 'u1', decision: 'YES' }));
        expect(init.headers.get('Content-Type')).toBe('application/json');
    });

    it('omits content-type for bodyless mutations', async () => {
        mockSession('token-3');
        (global.fetch as jest.Mock).mockResolvedValue(mockEmptyResponse({ status: 204 }));

        await expect(apiJson('/photos/photo-1', 'DELETE')).resolves.toBeUndefined();

        const [, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(init.body).toBeUndefined();
        expect(init.headers.has('Content-Type')).toBe(false);
    });

    it('prefers API error messages from JSON responses', async () => {
        mockSession('token-4');
        (global.fetch as jest.Mock).mockResolvedValue(
            mockJsonResponse({ error: 'Create your profile first' }, { status: 400, statusText: 'Bad Request' }),
        );

        await expect(apiGet('/matching/discovery')).rejects.toThrow('Create your profile first');
    });
});
